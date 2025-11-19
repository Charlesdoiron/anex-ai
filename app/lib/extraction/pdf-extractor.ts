/**
 * PDF text extraction using pdf-parse
 * Uses GPT-Vision fallback for scanned documents
 */

import OpenAI from "openai"
import { createRequire } from "module"

interface PdfMetadataInfo {
  Title?: string
  Author?: string
  Subject?: string
  Keywords?: string
  Creator?: string
  Producer?: string
  CreationDate?: string
  ModDate?: string
  [key: string]: unknown
}

export interface PdfExtractionOptions {
  onStatus?: (message: string) => void
}

export interface PdfExtractionResult {
  text: string
  pageCount: number
  pages: string[]
  metadata?: {
    title?: string
    author?: string
    subject?: string
    keywords?: string
    creator?: string
    producer?: string
    creationDate?: Date
    modificationDate?: Date
  }
  usedVisionOcr?: boolean
}

const require = createRequire(import.meta.url)

const PAGE_DELIMITER = "\n___PAGE_BREAK___\n"
const VISION_OCR_ENABLED = process.env.PDF_ENABLE_VISION_OCR !== "false"
const VISION_MODEL = process.env.OPENAI_VISION_MODEL || "gpt-5-mini"
const VISION_RENDER_SCALE = Number(
  process.env.PDF_VISION_RENDER_SCALE || "1.75"
)
const VISION_MIN_TOTAL_CHARS = Number(
  process.env.PDF_VISION_MIN_TOTAL_CHARS || "200"
)
const VISION_MIN_AVG_CHARS_PER_PAGE = Number(
  process.env.PDF_VISION_MIN_AVG_CHARS_PER_PAGE || "30"
)
const VISION_MIN_NON_WHITESPACE_RATIO = Number(
  process.env.PDF_VISION_MIN_NON_WHITESPACE_RATIO || "0.2"
)
const VISION_MAX_RETRIES = Number(process.env.PDF_VISION_MAX_RETRIES || "2")
const VISION_CONCURRENCY = Math.max(
  1,
  Number(process.env.PDF_VISION_CONCURRENCY || "3")
)

const openAiApiKey = process.env.OPENAI_API_KEY
const visionClient = openAiApiKey ? new OpenAI({ apiKey: openAiApiKey }) : null

export async function extractPdfText(
  buffer: Buffer,
  options?: PdfExtractionOptions
): Promise<PdfExtractionResult> {
  try {
    const notify = options?.onStatus
    const pdfModule = require("pdf-parse") as {
      PDFParse?: new (options: Record<string, unknown>) => {
        getText: (params?: Record<string, unknown>) => Promise<{
          text?: string
          total?: number
          pages: Array<{ text: string }>
        }>
        getInfo: () => Promise<{
          total?: number
          info?: PdfMetadataInfo
          getDateNode?: () => Record<string, Date | undefined>
        }>
        destroy: () => Promise<void>
      }
    }

    const PdfParseCtor = pdfModule?.PDFParse

    if (typeof PdfParseCtor !== "function") {
      const keys =
        pdfModule && typeof pdfModule === "object" ? Object.keys(pdfModule) : []
      console.error("pdf-parse export keys:", keys)
      throw new Error(
        "pdf-parse v2 requires the PDFParse class. Unable to load parser."
      )
    }

    const parser = new PdfParseCtor({ data: buffer })

    try {
      const textResult = await parser.getText({
        pageJoiner: PAGE_DELIMITER,
        parseHyperlinks: false,
        lineEnforce: true,
        lineThreshold: 6,
        itemJoiner: " ",
      })

      const infoResult = await parser.getInfo()
      const pageCount =
        infoResult?.total ?? textResult.total ?? textResult.pages?.length ?? 1

      let pages = normalizePagesFromTextResult(textResult, pageCount)
      let usedVisionOcr = false

      if (VISION_OCR_ENABLED && visionClient && shouldFallbackToVision(pages)) {
        notify?.("Texte illisible, lancement de la transcription vision…")
        const visionPages = await runVisionPipeline(parser, pageCount, notify)
        if (
          visionPages.length > 0 &&
          shouldReplaceWithVision(pages, visionPages)
        ) {
          pages = ensurePageCount(visionPages, pageCount)
          usedVisionOcr = true
          notify?.("Transcription vision terminée, reprise du traitement…")
        }
      }

      const safePages = ensureAtLeastOnePage(pages)
      const combinedText = safePages.join("\n\n").trim()

      return {
        text: combinedText,
        pageCount,
        pages: safePages,
        metadata: formatMetadata(
          infoResult?.info as PdfMetadataInfo,
          infoResult?.getDateNode?.()
        ),
        usedVisionOcr,
      }
    } finally {
      await parser.destroy()
    }
  } catch (error) {
    console.error("PDF extraction error:", error)
    throw new Error(
      `Failed to extract text from PDF: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    )
  }
}

function splitIntoPages(text: string | undefined): string[] {
  if (!text) {
    return []
  }
  return text.split(PAGE_DELIMITER)
}

function cleanPageText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function normalizePagesFromTextResult(
  textResult: {
    pages?: Array<{ num?: number; text?: string }>
    text?: string
  },
  pageCount: number
): string[] {
  const pagesFromResult =
    Array.isArray(textResult.pages) && textResult.pages.length > 0
      ? [...textResult.pages]
          .sort(
            (a, b) =>
              (typeof a.num === "number" ? a.num : 0) -
              (typeof b.num === "number" ? b.num : 0)
          )
          .map((page) => cleanPageText(page?.text || ""))
      : splitIntoPages(textResult.text).map(cleanPageText)

  return ensurePageCount(pagesFromResult, pageCount)
}

function ensurePageCount(pages: string[], pageCount: number): string[] {
  if (pageCount <= 0) {
    return pages
  }
  const result = [...pages]
  if (result.length > pageCount) {
    return result.slice(0, pageCount)
  }
  while (result.length < pageCount) {
    result.push("")
  }
  return result
}

function ensureAtLeastOnePage(pages: string[]): string[] {
  if (pages.length === 0) {
    return [""]
  }
  if (pages.every((page) => page.length === 0)) {
    return [""]
  }
  return pages
}

function shouldFallbackToVision(pages: string[]): boolean {
  if (!pages.length) {
    return true
  }
  const totalChars = pages.reduce((acc, page) => acc + page.length, 0)
  const nonWhitespaceChars = pages.reduce(
    (acc, page) => acc + page.replace(/\s+/g, "").length,
    0
  )
  const avgChars = totalChars / Math.max(pages.length, 1)
  const ratio = totalChars === 0 ? 0 : nonWhitespaceChars / totalChars
  return (
    totalChars < VISION_MIN_TOTAL_CHARS ||
    avgChars < VISION_MIN_AVG_CHARS_PER_PAGE ||
    ratio < VISION_MIN_NON_WHITESPACE_RATIO
  )
}

function shouldReplaceWithVision(
  originalPages: string[],
  ocrPages: string[]
): boolean {
  if (!ocrPages.length) {
    return false
  }
  if (originalPages.every((page) => page.length === 0)) {
    return true
  }
  const originalChars = originalPages.reduce(
    (acc, page) => acc + page.replace(/\s+/g, "").length,
    0
  )
  const ocrChars = ocrPages.reduce(
    (acc, page) => acc + page.replace(/\s+/g, "").length,
    0
  )
  return ocrChars > originalChars * 1.2
}

async function runVisionPipeline(
  parser: any,
  pageCount: number,
  notify?: (message: string) => void
): Promise<string[]> {
  if (!visionClient) {
    console.warn("Vision OCR requested but OpenAI client is unavailable.")
    return []
  }

  try {
    notify?.("Conversion des pages en images pour GPT-Vision…")
    const screenshotResult = await parser.getScreenshot({
      imageBuffer: true,
      imageDataUrl: false,
      scale: VISION_RENDER_SCALE,
    })

    if (!screenshotResult?.pages?.length) {
      return []
    }

    const totalPages = screenshotResult.pages.length
    const ocrPages: string[] = new Array(totalPages).fill("")

    const screenshotPages = screenshotResult.pages as Array<{
      data: Uint8Array
    }>

    await processWithConcurrency(
      screenshotPages,
      VISION_CONCURRENCY,
      async (page, index) => {
        const imageBuffer = Buffer.from(page.data)
        const base64 = imageBuffer.toString("base64")
        const imageUrl = `data:image/png;base64,${base64}`
        const pageNumber = index + 1
        notify?.(`Transcription vision page ${pageNumber}/${totalPages}…`)
        const text = await extractTextFromVisionPage(
          imageUrl,
          pageNumber,
          totalPages
        )
        ocrPages[index] = cleanPageText(text)
      }
    )

    return ensurePageCount(ocrPages, pageCount)
  } catch (error) {
    console.error("Vision OCR pipeline failed:", error)
    return []
  }
}

async function extractTextFromVisionPage(
  imageUrl: string,
  pageNumber: number,
  totalPages: number
): Promise<string> {
  if (!visionClient) {
    return ""
  }

  let attempt = 0
  while (attempt <= VISION_MAX_RETRIES) {
    try {
      const response = await visionClient.responses.create({
        model: VISION_MODEL,
        instructions:
          "You are an expert transcription assistant. " +
          "Return only the exact text you read, preserving line breaks whenever possible. " +
          "Do not summarize, translate, or add commentary.",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `Transcris fidèlement la page ${pageNumber}/${totalPages}.`,
              },
              {
                type: "input_image",
                image_url: imageUrl,
                detail: "high",
              },
            ] as any,
          },
        ] as any,
        text: {
          format: {
            type: "text",
          },
        },
      })

      const outputText = extractTextFromResponse(response)
      if (outputText.trim().length > 0) {
        return outputText
      }
      throw new Error("Vision model returned empty text")
    } catch (error) {
      attempt += 1
      console.warn(
        `Vision OCR failed for page ${pageNumber} (attempt ${attempt}):`,
        error
      )
      if (attempt > VISION_MAX_RETRIES) {
        return ""
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000))
    }
  }
  return ""
}

function extractTextFromResponse(response: any): string {
  if (!response?.output) {
    return ""
  }
  let text = ""
  for (const item of response.output) {
    if (item.type === "message" && Array.isArray(item.content)) {
      for (const content of item.content) {
        if (
          content.type === "output_text" &&
          typeof content.text === "string"
        ) {
          text += content.text
        }
      }
    }
  }
  return text.trim()
}

async function processWithConcurrency<T>(
  items: T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<void>
): Promise<void> {
  const limit = Math.max(1, concurrency)
  let cursor = 0
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (true) {
        const index = cursor++
        if (index >= items.length) {
          break
        }
        await task(items[index], index)
      }
    }
  )
  await Promise.all(workers)
}

function formatMetadata(
  info?: PdfMetadataInfo,
  dateNode?: Record<string, Date | undefined>
) {
  if (!info && !dateNode) {
    return undefined
  }
  return {
    title: info?.Title,
    author: info?.Author,
    subject: info?.Subject,
    keywords: info?.Keywords,
    creator: info?.Creator,
    producer: info?.Producer,
    creationDate: dateNode?.CreationDate ?? parsePdfDate(info?.CreationDate),
    modificationDate: dateNode?.ModDate ?? parsePdfDate(info?.ModDate),
  }
}

function parsePdfDate(value?: string | Date): Date | undefined {
  if (!value) {
    return undefined
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value
  }
  if (typeof value !== "string") {
    return undefined
  }
  if (value.startsWith("D:")) {
    const raw = value.slice(2)
    const year = raw.slice(0, 4)
    const month = raw.slice(4, 6) || "01"
    const day = raw.slice(6, 8) || "01"
    const hours = raw.slice(8, 10) || "00"
    const minutes = raw.slice(10, 12) || "00"
    const seconds = raw.slice(12, 14) || "00"
    return new Date(`${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`)
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}
