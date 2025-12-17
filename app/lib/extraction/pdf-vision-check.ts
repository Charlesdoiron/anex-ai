import { createRequire } from "module"

import { OCR_CONFIG } from "./ocr/config"
import { TesseractEngine } from "./ocr/tesseract-engine"
import { TesseractJsEngine } from "./ocr/tesseract-js-engine"
import { getOptionalOpenAIClient } from "@/app/lib/openai/client"
import { collectResponseText } from "@/app/lib/openai/response-utils"

export type VisionCheckConfidence = "high" | "medium" | "low"

export interface PdfVisionCheckAnswer {
  answer: string
  evidence: string
  confidence: VisionCheckConfidence
}

export interface PdfVisionPageCheckResult {
  pageNumber: number
  pageCount: number
  tesseractText: string
  visionAnswer: PdfVisionCheckAnswer
}

const require = createRequire(import.meta.url)

function getVisionModel(): string {
  return (
    process.env.OPENAI_PDF_VISION_VERIFY_MODEL?.trim() ||
    OCR_CONFIG.VISION_MODEL
  )
}

// Lazy-initialized client (not at module load time, so dotenv can load first)
let _visionClient: ReturnType<typeof getOptionalOpenAIClient> | undefined

function getVisionClient() {
  if (_visionClient === undefined) {
    _visionClient = getOptionalOpenAIClient()
  }
  return _visionClient
}

export async function checkPdfPageWithVision(params: {
  pdfBuffer: Buffer
  pageNumber: number
  question: string
}): Promise<PdfVisionPageCheckResult> {
  const { pdfBuffer, pageNumber, question } = params

  const visionClient = getVisionClient()
  if (!visionClient) {
    throw new Error("OpenAI client unavailable (OPENAI_API_KEY not set).")
  }

  if (!Number.isInteger(pageNumber) || pageNumber <= 0) {
    throw new Error("pageNumber must be a positive integer (1-based).")
  }

  const pdfModule = require("pdf-parse") as {
    PDFParse?: new (options: Record<string, unknown>) => {
      getInfo: () => Promise<{ total?: number }>
      getScreenshot: (params: {
        imageBuffer: boolean
        imageDataUrl: boolean
        scale: number
      }) => Promise<{
        pages: Array<{ data: Uint8Array }>
      }>
      destroy: () => Promise<void>
    }
  }

  const PdfParseCtor = pdfModule?.PDFParse
  if (typeof PdfParseCtor !== "function") {
    throw new Error("pdf-parse PDFParse constructor not available.")
  }

  const parser = new PdfParseCtor({ data: pdfBuffer })

  try {
    const info = await parser.getInfo()
    const pageCount = info?.total ?? 0

    if (pageCount <= 0) {
      throw new Error("Unable to determine PDF page count.")
    }

    if (pageNumber > pageCount) {
      throw new Error(`pageNumber out of range (1-${pageCount}).`)
    }

    const screenshot = await parser.getScreenshot({
      imageBuffer: true,
      imageDataUrl: false,
      scale: OCR_CONFIG.VISION_RENDER_SCALE,
    })

    const page = screenshot.pages[pageNumber - 1]
    if (!page?.data) {
      throw new Error(`Unable to render screenshot for page ${pageNumber}.`)
    }

    const imageBuffer = Buffer.from(page.data)

    const tesseractText = await ocrImageWithTesseract(imageBuffer)

    const imageUrl = `data:image/png;base64,${imageBuffer.toString("base64")}`
    const visionAnswer = await askVisionToDescribe(imageUrl, question)

    return {
      pageNumber,
      pageCount,
      tesseractText: cleanText(tesseractText),
      visionAnswer,
    }
  } finally {
    await parser.destroy()
  }
}

async function ocrImageWithTesseract(imageBuffer: Buffer): Promise<string> {
  const useJsEngine = OCR_CONFIG.IS_SERVERLESS
  const available = useJsEngine
    ? await TesseractJsEngine.checkAvailability()
    : await TesseractEngine.checkAvailability()

  if (!available) {
    throw new Error("Tesseract OCR is not available on this system.")
  }

  const result = useJsEngine
    ? await TesseractJsEngine.recognize(imageBuffer)
    : await TesseractEngine.recognize(imageBuffer)

  return result.text
}

async function askVisionToDescribe(
  imageUrl: string,
  question: string
): Promise<PdfVisionCheckAnswer> {
  const visionClient = getVisionClient()
  if (!visionClient) {
    throw new Error("OpenAI client unavailable (OPENAI_API_KEY not set).")
  }

  const prompt = `Tu vas lire une page de bail (image).

Objectif: répondre à la question ci-dessous en te basant UNIQUEMENT sur ce que tu vois dans l'image.

Question:
${question}

Contraintes:
- Cite un extrait exact (evidence) incluant le(s) nombre(s) ou libellé(s) pertinents.
- Si plusieurs montants sont présents, liste-les et explique brièvement à quoi ils se rapportent.
- Ne calcule rien (pas de ×4, pas de mois→euros, etc.).

Réponds au format JSON avec les champs: { "answer": "...", "evidence": "...", "confidence": "high"|"medium"|"low" }`

  const response = await visionClient.responses.create({
    model: getVisionModel(),
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          { type: "input_image", image_url: imageUrl, detail: "high" },
        ] as any,
      },
    ] as any,
    text: { format: { type: "json_object" } },
    reasoning: { effort: "medium" },
  })

  const outputText = collectResponseText(response)
  if (!outputText) {
    throw new Error("Vision model returned an empty response.")
  }

  const parsed = JSON.parse(outputText) as Partial<PdfVisionCheckAnswer>
  const confidence: VisionCheckConfidence =
    parsed.confidence === "high" || parsed.confidence === "medium"
      ? parsed.confidence
      : "low"

  return {
    answer: typeof parsed.answer === "string" ? parsed.answer : "",
    evidence: typeof parsed.evidence === "string" ? parsed.evidence : "",
    confidence,
  }
}

function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}
