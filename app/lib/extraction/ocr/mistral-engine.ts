/**
 * Mistral OCR Engine using mistral-ocr-latest model
 * Provides high-quality document OCR with structure preservation
 */

import { Mistral } from "@mistralai/mistralai"

export interface MistralOcrResult {
  text: string
  pages: MistralOcrPage[]
  usedEngine: "mistral"
}

export interface MistralOcrPage {
  pageNumber: number
  markdown: string
  images?: Array<{
    id: string
    topLeftX: number
    topLeftY: number
    bottomRightX: number
    bottomRightY: number
    imageBase64?: string
  }>
}

let mistralClient: Mistral | null = null

function getClient(): Mistral | null {
  // Read API key dynamically (allows dotenv to load first)
  const mistralApiKey = process.env.MISTRAL_API_KEY
  if (!mistralApiKey) {
    return null
  }
  if (!mistralClient) {
    mistralClient = new Mistral({ apiKey: mistralApiKey })
  }
  return mistralClient
}

export class MistralOcrEngine {
  private static isAvailable: boolean | null = null

  static async checkAvailability(): Promise<boolean> {
    if (this.isAvailable !== null) return this.isAvailable

    const client = getClient()
    if (!client) {
      this.isAvailable = false
      return false
    }

    this.isAvailable = true
    return true
  }

  /**
   * Process entire PDF document at once (more efficient for Mistral)
   */
  static async processPdf(pdfBuffer: Buffer): Promise<MistralOcrResult> {
    const client = getClient()
    if (!client) {
      throw new Error("Mistral API key not configured")
    }

    const base64Pdf = pdfBuffer.toString("base64")
    const documentUrl = `data:application/pdf;base64,${base64Pdf}`

    try {
      const response = await client.ocr.process({
        model: "mistral-ocr-latest",
        document: {
          type: "document_url",
          documentUrl,
        },
        includeImageBase64: false,
      })

      const pages: MistralOcrPage[] = []
      let fullText = ""

      if (response.pages && Array.isArray(response.pages)) {
        for (const page of response.pages) {
          const pageNumber = page.index ?? pages.length + 1
          const markdown = page.markdown ?? ""

          pages.push({
            pageNumber,
            markdown,
            images: page.images?.map((img: any) => ({
              id: img.id,
              topLeftX: img.topLeftX,
              topLeftY: img.topLeftY,
              bottomRightX: img.bottomRightX,
              bottomRightY: img.bottomRightY,
            })),
          })

          fullText += `Page ${pageNumber} sur ${response.pages.length}\n\n`
          fullText += markdown + "\n\n"
        }
      }

      return {
        text: fullText.trim(),
        pages,
        usedEngine: "mistral",
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Mistral OCR failed: ${message}`)
    }
  }

  /**
   * Process a single image (for page-by-page processing)
   */
  static async processImage(imageBuffer: Buffer): Promise<string> {
    const client = getClient()
    if (!client) {
      throw new Error("Mistral API key not configured")
    }

    const base64Image = imageBuffer.toString("base64")
    const imageUrl = `data:image/png;base64,${base64Image}`

    try {
      const response = await client.ocr.process({
        model: "mistral-ocr-latest",
        document: {
          type: "image_url",
          imageUrl,
        },
        includeImageBase64: false,
      })

      if (response.pages && response.pages.length > 0) {
        return response.pages[0].markdown ?? ""
      }

      return ""
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Mistral OCR image failed: ${message}`)
    }
  }
}
