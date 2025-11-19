/**
 * Main extraction service using OpenAI Responses API
 * Handles structured extraction with retries and progress tracking
 */

import OpenAI from "openai"
import { extractPdfText } from "./pdf-extractor"
import { SYSTEM_INSTRUCTIONS, EXTRACTION_PROMPTS } from "./prompts"
import type {
  LeaseExtractionResult,
  ExtractionProgress,
  ExtractionStatus,
} from "./types"
import { documentIngestionService } from "../rag/ingestion/document-ingestion-service"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const MAX_RETRIES = 3
const EXTRACTION_MODEL =
  process.env.OPENAI_EXTRACTION_MODEL?.trim() || "gpt-5-mini"
const EXTRACTION_CONCURRENCY = Math.max(
  1,
  Number(process.env.EXTRACTION_CONCURRENCY || "2")
)

export type ProgressCallback = (progress: ExtractionProgress) => void

export class ExtractionService {
  private progressCallback?: ProgressCallback

  constructor(progressCallback?: ProgressCallback) {
    this.progressCallback = progressCallback
  }

  private emitProgress(
    status: ExtractionStatus,
    message: string,
    progress: number,
    currentField?: string,
    error?: string
  ) {
    if (this.progressCallback) {
      this.progressCallback({
        status,
        message,
        progress,
        currentField,
        error,
      })
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  async extractFromPdf(
    buffer: Buffer,
    fileName: string
  ): Promise<LeaseExtractionResult> {
    const startTime = Date.now()
    let totalRetries = 0

    try {
      this.emitProgress("uploading", "Réception du document...", 0)

      this.emitProgress("parsing_pdf", "Analyse du document PDF...", 5)
      const pdfData = await extractPdfText(buffer, {
        onStatus: (message) => this.emitProgress("parsing_pdf", message, 8),
      })

      this.emitProgress(
        "parsing_pdf",
        `Document analysé: ${pdfData.pageCount} pages`,
        10
      )

      const documentId = this.generateDocumentId()
      const extractionDate = new Date().toISOString()

      const result: Partial<LeaseExtractionResult> = {
        documentId,
        fileName,
        extractionDate,
        rawText: pdfData.text,
        pageCount: pdfData.pageCount,
      }

      const totalSections = EXTRACTION_PROMPTS.length
      let completedSections = 0

      await processWithConcurrency(
        EXTRACTION_PROMPTS,
        EXTRACTION_CONCURRENCY,
        async ({ section, prompt, retryable }) => {
          const statusKey = `extracting_${section}` as ExtractionStatus
          const startProgress =
            10 + Math.floor((completedSections / totalSections) * 80)

          this.emitProgress(
            statusKey,
            `Extraction: ${this.getSectionLabel(section)}...`,
            startProgress,
            section
          )

          let sectionData = null
          let attempts = 0
          let lastError: Error | null = null

          while (attempts < MAX_RETRIES && !sectionData) {
            try {
              sectionData = await this.extractSection(
                pdfData.text,
                section,
                prompt
              )
            } catch (error) {
              lastError = error as Error
              attempts++
              totalRetries++

              if (attempts < MAX_RETRIES && retryable) {
                console.warn(
                  `Retry ${attempts}/${MAX_RETRIES} for section ${section}:`,
                  error
                )
                await this.delay(1000 * attempts)
              } else {
                console.error(`Failed to extract section ${section}:`, error)
                sectionData = this.getDefaultSectionData(section)
              }
            }
          }

          result[section as keyof LeaseExtractionResult] = sectionData
          completedSections++

          const progressPercent =
            10 + Math.floor((completedSections / totalSections) * 80)
          this.emitProgress(
            statusKey,
            `Extraction: ${this.getSectionLabel(section)} terminée`,
            progressPercent,
            section,
            lastError ? lastError.message : undefined
          )
        }
      )

      this.emitProgress("validating", "Validation des données...", 90)

      const metadata = this.calculateMetadata(
        result as LeaseExtractionResult,
        Date.now() - startTime,
        totalRetries
      )

      const finalResult: LeaseExtractionResult = {
        ...(result as LeaseExtractionResult),
        extractionMetadata: metadata,
      }

      this.ingestForRag(finalResult, pdfData.pages)

      this.emitProgress("completed", "Extraction terminée avec succès", 100)

      return finalResult
    } catch (error) {
      console.error("Extraction failed:", error)
      this.emitProgress(
        "failed",
        "Échec de l'extraction",
        0,
        undefined,
        error instanceof Error ? error.message : "Unknown error"
      )
      throw error
    }
  }

  private async extractSection(
    documentText: string,
    section: string,
    prompt: string
  ): Promise<any> {
    const response = await openai.responses.create({
      model: EXTRACTION_MODEL,
      instructions: SYSTEM_INSTRUCTIONS,
      input: [
        {
          role: "user",
          content: `Document text:\n\n${this.truncateText(documentText, 50000)}\n\n${prompt}`,
        },
      ],
      text: {
        format: {
          type: "json_object",
        },
      },
      reasoning: {
        effort: "minimal",
      },
    })

    let outputText = ""
    for (const item of response.output) {
      if (item.type === "message" && "content" in item) {
        for (const content of item.content) {
          if (content.type === "output_text" && "text" in content) {
            outputText += content.text
          }
        }
      }
    }

    if (!outputText) {
      throw new Error(`No output received for section ${section}`)
    }

    try {
      return JSON.parse(outputText)
    } catch (error) {
      console.error(`Failed to parse JSON for section ${section}:`, outputText)
      throw new Error(`Invalid JSON response for section ${section}`)
    }
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text
    }
    return text.slice(0, maxLength) + "\n\n[... document truncated ...]"
  }

  private getDefaultSectionData(section: string): any {
    const missingValue = {
      value: null,
      confidence: "missing" as const,
      source: "not found",
    }

    switch (section) {
      case "regime":
        return {
          regime: { ...missingValue, value: "unknown" },
        }
      case "parties":
        return {
          landlord: {
            name: missingValue,
            email: missingValue,
            phone: missingValue,
            address: missingValue,
          },
          landlordRepresentative: null,
          tenant: {
            name: missingValue,
            email: missingValue,
            phone: missingValue,
            address: missingValue,
          },
        }
      default:
        return {}
    }
  }

  private calculateMetadata(
    result: LeaseExtractionResult,
    processingTimeMs: number,
    retries: number
  ) {
    let totalFields = 0
    let extractedFields = 0
    let missingFields = 0
    let lowConfidenceFields = 0
    let confidenceSum = 0

    const countFields = (obj: any) => {
      for (const key in obj) {
        if (obj[key] && typeof obj[key] === "object") {
          if ("confidence" in obj[key]) {
            totalFields++
            const conf = obj[key].confidence

            if (conf === "missing") {
              missingFields++
            } else {
              extractedFields++
              if (conf === "low") {
                lowConfidenceFields++
              }
            }

            const confValue =
              conf === "high"
                ? 1
                : conf === "medium"
                  ? 0.7
                  : conf === "low"
                    ? 0.4
                    : 0
            confidenceSum += confValue
          } else {
            countFields(obj[key])
          }
        }
      }
    }

    countFields(result)

    return {
      totalFields,
      extractedFields,
      missingFields,
      lowConfidenceFields,
      averageConfidence: totalFields > 0 ? confidenceSum / totalFields : 0,
      processingTimeMs,
      retries,
    }
  }

  private getSectionLabel(section: string): string {
    const labels: Record<string, string> = {
      regime: "Régime du bail",
      parties: "Parties",
      premises: "Description des locaux",
      calendar: "Calendrier",
      supportMeasures: "Mesures d'accompagnement",
      rent: "Loyer",
      indexation: "Indexation",
      taxes: "Impôts et taxes",
      charges: "Charges et honoraires",
      insurance: "Assurances",
      securities: "Sûretés",
      inventory: "États des lieux",
      maintenance: "Entretien et travaux",
      restitution: "Restitution",
      transfer: "Cession et sous-location",
      environmentalAnnexes: "Annexes environnementales",
      otherAnnexes: "Autres annexes",
      other: "Autres informations",
    }
    return labels[section] || section
  }

  private generateDocumentId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  private async ingestForRag(
    result: LeaseExtractionResult,
    pages: string[]
  ): Promise<void> {
    try {
      await documentIngestionService.ingest({
        documentId: result.documentId,
        fileName: result.fileName,
        pageCount: result.pageCount,
        pages,
        rawText: result.rawText,
        metadata: {
          extractionMetadata: result.extractionMetadata,
        },
      })
    } catch (error) {
      console.error("RAG ingestion failed:", error)
    }
  }
}

async function processWithConcurrency<T>(
  items: T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<void>
): Promise<void> {
  if (items.length === 0) {
    return
  }
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
