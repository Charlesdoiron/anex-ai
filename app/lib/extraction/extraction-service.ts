/**
 * Main extraction service using OpenAI Responses API
 * Handles structured extraction with retries and progress tracking
 */

import { extractPdfText } from "./pdf-extractor"
import type { PdfExtractionResult } from "./pdf-extractor"
import {
  SYSTEM_INSTRUCTIONS,
  EXTRACTION_PROMPTS,
  type ExtractionPrompt,
} from "./prompts"
import type {
  LeaseExtractionResult,
  ExtractionProgress,
  ExtractionStatus,
  ExtractionStageDurations,
  ConfidenceLevel,
  ExtractionSection,
} from "./types"
import { postProcessExtraction } from "./post-process"
import { getExtractionServiceOptions } from "./prompt-service"
import { computeRentScheduleFromExtraction } from "../lease/from-extraction"
import { documentIngestionService } from "../rag/ingestion/document-ingestion-service"
import { getOpenAIClient } from "@/app/lib/openai/client"
import {
  collectResponseText,
  truncateText,
} from "@/app/lib/openai/response-utils"

const openai = getOpenAIClient()

const MAX_RETRIES = 3
const EXTRACTION_MODEL =
  process.env.OPENAI_EXTRACTION_MODEL?.trim() || "gpt-5-mini"
const EXTRACTION_CONCURRENCY = Math.max(
  1,
  Number(process.env.EXTRACTION_CONCURRENCY || "6")
)
const SECTIONS_PER_CALL = Math.max(
  1,
  Number(process.env.EXTRACTION_SECTIONS_PER_CALL || "4")
)

const CONFIDENCE_VALUES: ConfidenceLevel[] = [
  "high",
  "medium",
  "low",
  "missing",
]

type SectionExtractionValue = unknown
type SectionExtractionMap = Record<string, SectionExtractionValue>
type ExtractionSectionsMap = Pick<LeaseExtractionResult, ExtractionSection>
type LeaseSectionKey = keyof ExtractionSectionsMap

interface BatchExtractionResult {
  data?: SectionExtractionMap
  retries: number
  error?: Error
}

interface SectionExtractionResult {
  data?: SectionExtractionValue
  retries: number
  error?: Error
}

export type ProgressCallback = (progress: ExtractionProgress) => void
export type PartialResultCallback = (
  partialResult: Partial<LeaseExtractionResult>
) => void

export interface ExtractionServiceOptions {
  systemInstructions?: string
  prompts?: ExtractionPrompt[]
  enableRagIngestion?: boolean
}

export class ExtractionService {
  private progressCallback?: ProgressCallback
  private partialResultCallback?: PartialResultCallback
  private systemInstructions: string
  private extractionPrompts: ExtractionPrompt[]
  private readonly ragIngestionEnabled: boolean
  private promptsLoaded = false
  private promptsLoadingPromise: Promise<void> | null = null

  constructor(
    progressCallback?: ProgressCallback,
    partialResultCallback?: PartialResultCallback,
    options?: ExtractionServiceOptions
  ) {
    this.progressCallback = progressCallback
    this.partialResultCallback = partialResultCallback
    this.systemInstructions = options?.systemInstructions ?? SYSTEM_INSTRUCTIONS
    this.extractionPrompts = options?.prompts ?? EXTRACTION_PROMPTS
    this.ragIngestionEnabled = options?.enableRagIngestion !== false
    this.promptsLoaded = Boolean(
      options?.systemInstructions && options?.prompts
    )
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
    const stageTimings: ExtractionStageDurations = {
      pdfProcessingMs: 0,
      extractionMs: 0,
      ingestionMs: 0,
    }

    this.emitProgress("uploading", "Réception du document...", 0)

    const pdfStart = Date.now()
    this.emitProgress("parsing_pdf", "Analyse du document PDF...", 5)
    const pdfData = await extractPdfText(buffer, {
      onStatus: (message) => this.emitProgress("parsing_pdf", message, 8),
    })
    stageTimings.pdfProcessingMs = Date.now() - pdfStart

    this.emitProgress(
      "parsing_pdf",
      `Document analysé: ${pdfData.pageCount} pages`,
      10
    )

    return this.processParsedDocument(
      pdfData,
      fileName,
      startTime,
      stageTimings
    )
  }

  async extractFromParsedDocument(
    parsedDocument: PdfExtractionResult,
    fileName: string
  ): Promise<LeaseExtractionResult> {
    const startTime = Date.now()
    const stageTimings: ExtractionStageDurations = {
      pdfProcessingMs: 0,
      extractionMs: 0,
      ingestionMs: 0,
    }

    return this.processParsedDocument(
      parsedDocument,
      fileName,
      startTime,
      stageTimings
    )
  }

  private async processParsedDocument(
    pdfData: PdfExtractionResult,
    fileName: string,
    startTime: number,
    stageTimings: ExtractionStageDurations
  ): Promise<LeaseExtractionResult> {
    await this.ensurePromptsLoaded()
    let totalRetries = 0

    try {
      const documentId = this.generateDocumentId()
      const extractionDate = new Date().toISOString()

      const result: Partial<LeaseExtractionResult> = {
        documentId,
        fileName,
        extractionDate,
        rawText: pdfData.text,
        pageCount: pdfData.pageCount,
        usedOcrEngine: pdfData.usedOcrEngine ?? null,
      }
      const sectionStore = result as Partial<ExtractionSectionsMap>
      const getSectionValue = <K extends LeaseSectionKey>(key: K) =>
        sectionStore[key]
      const setSectionValue = <K extends LeaseSectionKey>(
        key: K,
        value: ExtractionSectionsMap[K]
      ) => {
        sectionStore[key] = value
      }

      const totalSections = this.extractionPrompts.length
      const groupedPrompts = chunkItems(
        this.extractionPrompts,
        SECTIONS_PER_CALL
      )
      let completedSections = 0

      const extractionStart = Date.now()
      await processWithConcurrency(
        groupedPrompts,
        EXTRACTION_CONCURRENCY,
        async (promptGroup) => {
          if (!promptGroup.length) {
            return
          }

          const sectionResults: SectionExtractionMap = {}
          const sectionErrors: Record<string, string | undefined> = {}

          for (const { section } of promptGroup) {
            const statusKey = `extracting_${section}` as ExtractionStatus
            const startProgress = this.computeSectionProgress(
              completedSections,
              totalSections
            )
            this.emitProgress(
              statusKey,
              `Extraction: ${this.getSectionLabel(section)}...`,
              startProgress,
              section
            )
          }

          const batchResult = await this.runBatchExtraction(
            pdfData.text,
            promptGroup
          )
          totalRetries += batchResult.retries

          const missingPrompts: ExtractionPrompt[] = []

          if (batchResult.data) {
            for (const prompt of promptGroup) {
              const batchData = batchResult.data[prompt.section]
              if (batchData === undefined) {
                missingPrompts.push(prompt)
                sectionErrors[prompt.section] = "Batch response missing data"
              } else {
                sectionResults[prompt.section] = batchData
              }
            }
          } else {
            missingPrompts.push(...promptGroup)
            if (batchResult.error) {
              for (const prompt of promptGroup) {
                sectionErrors[prompt.section] = batchResult.error.message
              }
            }
          }

          for (const prompt of missingPrompts) {
            const singleResult = await this.runSingleExtraction(
              pdfData.text,
              prompt
            )
            totalRetries += singleResult.retries
            if (singleResult.data !== undefined) {
              sectionResults[prompt.section] = singleResult.data
              if (singleResult.error) {
                sectionErrors[prompt.section] = singleResult.error.message
              }
            } else {
              sectionResults[prompt.section] = this.getDefaultSectionData(
                prompt.section
              )
              if (!sectionErrors[prompt.section]) {
                sectionErrors[prompt.section] =
                  singleResult.error?.message || "Extraction failed"
              }
            }
          }

          for (const prompt of promptGroup) {
            const sectionKey = prompt.section as LeaseSectionKey
            const sectionValue =
              (sectionResults[prompt.section] as
                | ExtractionSectionsMap[typeof sectionKey]
                | undefined) ??
              getSectionValue(sectionKey) ??
              (this.getDefaultSectionData(
                prompt.section
              ) as ExtractionSectionsMap[typeof sectionKey])
            setSectionValue(sectionKey, sectionValue)

            completedSections++
            const progressPercent = this.computeSectionProgress(
              completedSections,
              totalSections
            )
            const statusKey = `extracting_${prompt.section}` as ExtractionStatus
            this.emitProgress(
              statusKey,
              `Extraction: ${this.getSectionLabel(prompt.section)} terminée`,
              progressPercent,
              prompt.section,
              sectionErrors[prompt.section]
            )

            if (this.partialResultCallback) {
              this.partialResultCallback({
                ...result,
                extractionMetadata: {
                  totalFields: 0,
                  extractedFields: 0,
                  missingFields: 0,
                  lowConfidenceFields: 0,
                  averageConfidence: 0,
                  processingTimeMs: Date.now() - startTime,
                  retries: totalRetries,
                  stageDurations: {
                    pdfProcessingMs: stageTimings.pdfProcessingMs,
                    extractionMs: Date.now() - extractionStart,
                    ingestionMs: 0,
                  },
                },
              } as Partial<LeaseExtractionResult>)
            }
          }
        }
      )
      stageTimings.extractionMs = Date.now() - extractionStart

      this.emitProgress("validating", "Validation des données...", 90)

      const baseResult = result as LeaseExtractionResult

      const processedResult = postProcessExtraction(baseResult)

      const metadata = this.calculateMetadata(
        processedResult,
        Date.now() - startTime,
        totalRetries,
        stageTimings
      )

      let rentSchedule: LeaseExtractionResult["rentSchedule"] = undefined

      try {
        const schedule =
          await computeRentScheduleFromExtraction(processedResult)
        rentSchedule = schedule ?? undefined
      } catch (error) {
        console.error("Rent schedule computation failed:", error)
        rentSchedule = undefined
      }

      const finalResult: LeaseExtractionResult = {
        ...processedResult,
        extractionMetadata: metadata,
        ...(rentSchedule ? { rentSchedule } : {}),
      }

      this.emitProgress("completed", "Extraction terminée avec succès", 100)

      this.ingestForRag(finalResult, pdfData.pages ?? []).catch((err) =>
        console.error("Background RAG ingestion failed:", err)
      )

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

  private computeSectionProgress(
    completedSections: number,
    totalSections: number
  ): number {
    if (totalSections === 0) {
      return 100
    }
    return 10 + Math.floor((completedSections / totalSections) * 80)
  }

  private async runBatchExtraction(
    documentText: string,
    prompts: ExtractionPrompt[]
  ): Promise<BatchExtractionResult> {
    let attempts = 0
    let retries = 0
    let lastError: Error | undefined
    const isRetryable = prompts.some((prompt) => prompt.retryable)

    while (attempts < MAX_RETRIES) {
      try {
        const data = await this.extractSectionsBatch(documentText, prompts)
        return { data, retries }
      } catch (error) {
        lastError = error as Error
        attempts++
        retries += prompts.length

        console.warn(
          `Batch extraction retry ${attempts}/${MAX_RETRIES} for sections [${prompts
            .map((p) => p.section)
            .join(", ")}]:`,
          error
        )

        if (attempts >= MAX_RETRIES || !isRetryable) {
          break
        }

        await this.delay(1000 * attempts)
      }
    }

    return { retries, error: lastError }
  }

  private async runSingleExtraction(
    documentText: string,
    prompt: ExtractionPrompt
  ): Promise<SectionExtractionResult> {
    let attempts = 0
    let retries = 0
    let lastError: Error | undefined

    while (attempts < MAX_RETRIES) {
      try {
        const data = await this.extractSection(
          documentText,
          prompt.section,
          prompt.prompt
        )
        return { data, retries, error: lastError }
      } catch (error) {
        lastError = error as Error
        attempts++
        retries += 1

        console.warn(
          `Retry ${attempts}/${MAX_RETRIES} for section ${prompt.section}:`,
          error
        )

        if (attempts >= MAX_RETRIES || !prompt.retryable) {
          break
        }

        await this.delay(1000 * attempts)
      }
    }

    return { retries, error: lastError }
  }

  private async extractSectionsBatch(
    documentText: string,
    prompts: ExtractionPrompt[]
  ): Promise<SectionExtractionMap> {
    const sectionNames = prompts.map((prompt) => prompt.section)
    const sectionsPrompt = prompts
      .map(
        ({ section, prompt }) =>
          `SECTION "${section}":\n${prompt}\nReturn this section under the "${section}" key.`
      )
      .join("\n\n")

    const response = await openai.responses.create({
      model: EXTRACTION_MODEL,
      instructions: this.systemInstructions,
      input: [
        {
          role: "user",
          content: `Document text:\n\n${truncateText(
            documentText,
            50000
          )}\n\nExtract all sections simultaneously and respond with a single JSON object whose top-level keys exactly match: ${sectionNames
            .map((name) => `"${name}"`)
            .join(", ")}.\n\n${sectionsPrompt}`,
        },
      ],
      text: {
        format: {
          type: "json_object",
        },
      },
      reasoning: {
        effort: "low",
      },
    })

    const outputText = collectResponseText(response)

    if (!outputText) {
      throw new Error(
        `No output received for sections [${sectionNames.join(", ")}]`
      )
    }

    const parsed = JSON.parse(outputText)

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Batch response is not a JSON object")
    }
    return parsed as SectionExtractionMap
  }

  private async extractSection(
    documentText: string,
    section: string,
    prompt: string
  ): Promise<SectionExtractionValue> {
    const response = await openai.responses.create({
      model: EXTRACTION_MODEL,
      instructions: this.systemInstructions,
      input: [
        {
          role: "user",
          content: `Document text:\n\n${truncateText(
            documentText,
            50000
          )}\n\n${prompt}`,
        },
      ],
      text: {
        format: {
          type: "json_object",
        },
      },
      reasoning: {
        effort: "low",
      },
    })

    const outputText = collectResponseText(response)

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

  private getDefaultSectionData(section: string): unknown {
    const missingValue = {
      value: null,
      confidence: "missing" as const,
      source: "Document entier",
      rawText: "Non mentionné",
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
            siren: missingValue,
            email: missingValue,
            phone: missingValue,
            address: missingValue,
          },
          landlordRepresentative: null,
          tenant: {
            name: missingValue,
            siren: missingValue,
            email: missingValue,
            phone: missingValue,
            address: missingValue,
          },
        }
      case "premises":
        return {
          purpose: missingValue,
          designation: missingValue,
          address: missingValue,
          buildingYear: missingValue,
          floors: { ...missingValue, value: [] },
          lotNumbers: { ...missingValue, value: [] },
          surfaceArea: missingValue,
          isPartitioned: missingValue,
          hasFurniture: missingValue,
          furnishingConditions: missingValue,
          signageConditions: missingValue,
          hasOutdoorSpace: missingValue,
          hasArchiveSpace: missingValue,
          parkingSpaces: missingValue,
          twoWheelerSpaces: missingValue,
          bikeSpaces: missingValue,
          shareWithCommonAreas: missingValue,
          shareWithoutCommonAreas: missingValue,
          totalBuildingShare: missingValue,
        }
      case "calendar":
        return {
          signatureDate: missingValue,
          duration: missingValue,
          effectiveDate: missingValue,
          earlyAccessDate: missingValue,
          endDate: missingValue,
          nextTriennialDate: missingValue,
          noticePeriod: missingValue,
          terminationConditions: missingValue,
          renewalConditions: missingValue,
        }
      case "supportMeasures":
        return {
          hasRentFreeperiod: missingValue,
          rentFreePeriodMonths: missingValue,
          rentFreePeriodAmount: missingValue,
          hasOtherMeasures: missingValue,
          otherMeasuresDescription: missingValue,
        }
      case "rent":
        return {
          annualRentExclTaxExclCharges: missingValue,
          quarterlyRentExclTaxExclCharges: missingValue,
          annualRentPerSqmExclTaxExclCharges: missingValue,
          annualParkingRentExclCharges: missingValue,
          quarterlyParkingRentExclCharges: missingValue,
          annualParkingRentPerUnitExclCharges: missingValue,
          isSubjectToVAT: missingValue,
          paymentFrequency: missingValue,
          latePaymentPenaltyConditions: missingValue,
          latePaymentPenaltyAmount: missingValue,
        }
      case "indexation":
        return {
          hasIndexationClause: missingValue,
          indexationType: missingValue,
          referenceQuarter: missingValue,
          firstIndexationDate: missingValue,
          indexationFrequency: missingValue,
        }
      case "taxes":
        return {
          propertyTaxRebilled: missingValue,
          propertyTaxAmount: missingValue,
          teomAmount: missingValue,
          officeTaxAmount: missingValue,
        }
      case "charges":
        return {
          annualChargesProvisionExclTax: missingValue,
          quarterlyChargesProvisionExclTax: missingValue,
          annualChargesProvisionPerSqmExclTax: missingValue,
          annualRIEFeeExclTax: missingValue,
          quarterlyRIEFeeExclTax: missingValue,
          annualRIEFeePerSqmExclTax: missingValue,
          managementFeesOnTenant: missingValue,
          rentManagementFeesOnTenant: missingValue,
        }
      case "insurance":
        return {
          annualInsuranceAmountExclTax: missingValue,
          insurancePremiumRebilled: missingValue,
          hasWaiverOfRecourse: missingValue,
          insuranceCertificateAnnexed: missingValue,
        }
      case "securities":
        return {
          securityDepositDescription: missingValue,
          securityDepositAmount: missingValue,
          otherSecurities: { ...missingValue, value: [] },
        }
      case "inventory":
        return {
          entryInventoryConditions: missingValue,
          hasPreExitInventory: missingValue,
          preExitInventoryConditions: missingValue,
          exitInventoryConditions: missingValue,
        }
      case "maintenance":
        return {
          tenantMaintenanceConditions: missingValue,
          landlordWorksList: { ...missingValue, value: [] },
          tenantWorksList: { ...missingValue, value: [] },
          workConditionsImposedOnTenant: missingValue,
          hasAccessionClause: missingValue,
        }
      case "restitution":
        return {
          restitutionConditions: missingValue,
          restorationConditions: missingValue,
        }
      case "transfer":
        return {
          sublettingConditions: missingValue,
          currentSubleaseInfo: missingValue,
          assignmentConditions: missingValue,
          divisionPossible: missingValue,
        }
      case "environmentalAnnexes":
        return {
          hasDPE: missingValue,
          dpeNote: missingValue,
          hasAsbestosDiagnostic: missingValue,
          hasEnvironmentalAnnex: missingValue,
          hasRiskAndPollutionStatement: missingValue,
        }
      case "otherAnnexes":
        return {
          hasInternalRegulations: missingValue,
          hasPremisesPlan: missingValue,
          hasChargesInventory: missingValue,
          hasAnnualChargesSummary: missingValue,
          hasThreeYearWorksBudget: missingValue,
          hasPastWorksSummary: missingValue,
        }
      case "other":
        return {
          isSignedAndInitialed: missingValue,
          civilCodeDerogations: { ...missingValue, value: [] },
          commercialCodeDerogations: { ...missingValue, value: [] },
        }
      default:
        return {}
    }
  }

  private calculateMetadata(
    result: LeaseExtractionResult,
    processingTimeMs: number,
    retries: number,
    stageDurations: ExtractionStageDurations
  ) {
    let totalFields = 0
    let extractedFields = 0
    let missingFields = 0
    let lowConfidenceFields = 0
    let confidenceSum = 0

    const countFields = (node: unknown) => {
      if (!node || typeof node !== "object") {
        return
      }

      const entries = Object.values(node as Record<string, unknown>)
      for (const value of entries) {
        if (isConfidenceField(value)) {
          totalFields++
          const conf = value.confidence

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
          countFields(value)
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
      stageDurations,
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
    if (!this.ragIngestionEnabled) {
      return
    }

    try {
      const metadataPayload = result.extractionMetadata
        ? {
            extractionMetadata: {
              ...result.extractionMetadata,
              stageDurations: {
                ...result.extractionMetadata.stageDurations,
              },
            },
          }
        : undefined

      await documentIngestionService.ingest({
        documentId: result.documentId,
        fileName: result.fileName,
        pageCount: result.pageCount,
        pages,
        rawText: result.rawText,
        metadata: metadataPayload,
      })
    } catch (error) {
      console.error("RAG ingestion failed:", error)
    }
  }

  private async ensurePromptsLoaded(): Promise<void> {
    if (this.promptsLoaded) {
      return
    }
    if (!this.promptsLoadingPromise) {
      this.promptsLoadingPromise = (async () => {
        const { systemInstructions, prompts } =
          await getExtractionServiceOptions()
        this.systemInstructions = systemInstructions
        this.extractionPrompts = prompts
        this.promptsLoaded = true
        this.promptsLoadingPromise = null
      })().catch((error) => {
        this.promptsLoadingPromise = null
        throw error
      })
    }
    await this.promptsLoadingPromise
  }
}

function isConfidenceField(
  value: unknown
): value is { confidence: ConfidenceLevel } & Record<string, unknown> {
  if (!value || typeof value !== "object") {
    return false
  }
  const confidence = (value as { confidence?: unknown }).confidence
  return (
    typeof confidence === "string" &&
    CONFIDENCE_VALUES.includes(confidence as ConfidenceLevel)
  )
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

function chunkItems<T>(items: T[], size: number): T[][] {
  if (items.length === 0) {
    return []
  }

  const groupSize = size <= 0 ? items.length : size
  const groups: T[][] = []

  for (let i = 0; i < items.length; i += groupSize) {
    groups.push(items.slice(i, i + groupSize))
  }

  return groups
}
