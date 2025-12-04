/**
 * Lightweight extraction service for rent calculation
 * Only extracts the minimum required fields for INSEE-indexed rent schedule
 */

import type { Response } from "openai/resources/responses/responses"

import { extractPdfText } from "./pdf-extractor"
import {
  RENT_CALCULATION_SYSTEM_INSTRUCTIONS,
  RENT_CALCULATION_EXTRACTION_PROMPT,
} from "./rent-calculation-prompts"
import type { ExtractedValue, ConfidenceLevel } from "./types"
import { computeLeaseRentSchedule } from "../lease/rent-schedule-calculator"
import {
  buildIndexInputsForLease,
  getInseeRentalIndexSeries,
} from "../lease/insee-rental-index-service"
import type {
  ComputeLeaseRentScheduleResult,
  ComputeLeaseRentScheduleInput,
} from "../lease/types"
import { getOpenAIClient } from "@/app/lib/openai/client"

const openai = getOpenAIClient()

const EXTRACTION_MODEL =
  process.env.OPENAI_EXTRACTION_MODEL?.trim() || "gpt-5-mini"
const MAX_RETRIES = 2

export interface RentCalculationExtractedData {
  calendar: {
    effectiveDate: ExtractedValue<string | null>
    signatureDate: ExtractedValue<string | null>
    duration: ExtractedValue<number | null>
  }
  rent: {
    annualRentExclTaxExclCharges: ExtractedValue<number | null>
    quarterlyRentExclTaxExclCharges: ExtractedValue<number | null>
    annualParkingRentExclCharges: ExtractedValue<number | null>
    paymentFrequency: ExtractedValue<"monthly" | "quarterly" | null>
  }
}

export interface RentCalculationResult {
  documentId: string
  fileName: string
  extractionDate: string
  pageCount: number
  toolType: "calculation-rent"

  extractedData: RentCalculationExtractedData
  rentSchedule: ComputeLeaseRentScheduleResult | null
  scheduleInput: ComputeLeaseRentScheduleInput | null

  metadata: {
    processingTimeMs: number
    retries: number
    extractionSuccess: boolean
    scheduleSuccess: boolean
    errorMessage?: string
  }
}

export interface RentCalculationProgress {
  status:
    | "uploading"
    | "parsing_pdf"
    | "extracting"
    | "computing"
    | "completed"
    | "failed"
  message: string
  progress: number
  error?: string
}

export type RentCalculationProgressCallback = (
  progress: RentCalculationProgress
) => void

export class RentCalculationExtractionService {
  private progressCallback?: RentCalculationProgressCallback

  constructor(progressCallback?: RentCalculationProgressCallback) {
    this.progressCallback = progressCallback
  }

  private emitProgress(
    status: RentCalculationProgress["status"],
    message: string,
    progress: number,
    error?: string
  ) {
    this.progressCallback?.({ status, message, progress, error })
  }

  async extractAndCompute(
    buffer: Buffer,
    fileName: string
  ): Promise<RentCalculationResult> {
    const startTime = Date.now()
    let retries = 0

    const documentId = this.generateDocumentId()
    const extractionDate = new Date().toISOString()

    try {
      this.emitProgress("uploading", "Réception du document...", 0)

      this.emitProgress("parsing_pdf", "Analyse du document PDF...", 10)
      const pdfData = await extractPdfText(buffer, {
        onStatus: (message) => this.emitProgress("parsing_pdf", message, 15),
      })

      this.emitProgress(
        "parsing_pdf",
        `Document analysé: ${pdfData.pageCount} pages`,
        25
      )

      this.emitProgress("extracting", "Extraction des données de loyer...", 30)

      const extractedData = await this.extractRentData(pdfData.text, retries)
      retries = extractedData.retries

      this.emitProgress("computing", "Calcul de l'échéancier de loyers...", 70)

      const { schedule, scheduleInput, errorMessage } =
        await this.computeSchedule(extractedData.data)

      const processingTimeMs = Date.now() - startTime

      this.emitProgress("completed", "Extraction et calcul terminés", 100)

      return {
        documentId,
        fileName,
        extractionDate,
        pageCount: pdfData.pageCount,
        toolType: "calculation-rent",
        extractedData: extractedData.data,
        rentSchedule: schedule,
        scheduleInput,
        metadata: {
          processingTimeMs,
          retries,
          extractionSuccess: true,
          scheduleSuccess: schedule !== null,
          errorMessage,
        },
      }
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Erreur inconnue"

      this.emitProgress("failed", "Échec de l'extraction", 0, errorMsg)

      return {
        documentId,
        fileName,
        extractionDate,
        pageCount: 0,
        toolType: "calculation-rent",
        extractedData: this.getDefaultExtractedData(),
        rentSchedule: null,
        scheduleInput: null,
        metadata: {
          processingTimeMs: Date.now() - startTime,
          retries,
          extractionSuccess: false,
          scheduleSuccess: false,
          errorMessage: errorMsg,
        },
      }
    }
  }

  private async extractRentData(
    documentText: string,
    currentRetries: number
  ): Promise<{ data: RentCalculationExtractedData; retries: number }> {
    let attempts = 0
    let retries = currentRetries
    let lastError: Error | undefined

    while (attempts < MAX_RETRIES) {
      try {
        const response = await openai.responses.create({
          model: EXTRACTION_MODEL,
          instructions: RENT_CALCULATION_SYSTEM_INSTRUCTIONS,
          input: [
            {
              role: "user",
              content: `Document text:\n\n${this.truncateText(
                documentText,
                40000
              )}\n\n${RENT_CALCULATION_EXTRACTION_PROMPT}`,
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

        const outputText = this.collectResponseText(response)
        if (!outputText) {
          throw new Error("Aucune réponse reçue du modèle")
        }

        const parsed = JSON.parse(outputText) as RentCalculationExtractedData
        return { data: this.normalizeExtractedData(parsed), retries }
      } catch (error) {
        lastError = error as Error
        attempts++
        retries++

        if (attempts >= MAX_RETRIES) {
          break
        }

        await this.delay(1000 * attempts)
      }
    }

    console.error("Rent data extraction failed:", lastError)
    return { data: this.getDefaultExtractedData(), retries }
  }

  private async computeSchedule(data: RentCalculationExtractedData): Promise<{
    schedule: ComputeLeaseRentScheduleResult | null
    scheduleInput: ComputeLeaseRentScheduleInput | null
    errorMessage?: string
  }> {
    try {
      const startDate =
        data.calendar.effectiveDate.value || data.calendar.signatureDate.value

      if (!startDate) {
        return {
          schedule: null,
          scheduleInput: null,
          errorMessage:
            "Date de début manquante (effectiveDate ou signatureDate)",
        }
      }

      const paymentFrequency = data.rent.paymentFrequency.value
      if (paymentFrequency !== "monthly" && paymentFrequency !== "quarterly") {
        return {
          schedule: null,
          scheduleInput: null,
          errorMessage: "Fréquence de paiement manquante ou invalide",
        }
      }

      const series = await getInseeRentalIndexSeries()
      const horizonYears = 3
      const { baseIndexValue, knownIndexPoints } = buildIndexInputsForLease(
        startDate,
        horizonYears,
        series
      )

      if (!baseIndexValue) {
        return {
          schedule: null,
          scheduleInput: null,
          errorMessage: "Impossible de récupérer l'indice INSEE de base",
        }
      }

      const officeRentPerPeriod = this.deriveOfficeRentPerPeriod(
        data.rent,
        paymentFrequency
      )

      if (!officeRentPerPeriod) {
        return {
          schedule: null,
          scheduleInput: null,
          errorMessage: "Loyer bureaux manquant",
        }
      }

      const parkingRentPerPeriod = this.deriveParkingRentPerPeriod(
        data.rent,
        paymentFrequency
      )

      const durationYears = data.calendar.duration.value ?? horizonYears
      const endDate = this.toEndDate(startDate, durationYears)

      const scheduleInput: ComputeLeaseRentScheduleInput = {
        startDate,
        endDate,
        paymentFrequency,
        baseIndexValue,
        knownIndexPoints,
        officeRentHT: officeRentPerPeriod,
        parkingRentHT: parkingRentPerPeriod || undefined,
        horizonYears,
      }

      const schedule = computeLeaseRentSchedule(scheduleInput)

      return { schedule, scheduleInput }
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Erreur lors du calcul"
      console.error("Schedule computation failed:", error)
      return { schedule: null, scheduleInput: null, errorMessage: errorMsg }
    }
  }

  private deriveOfficeRentPerPeriod(
    rent: RentCalculationExtractedData["rent"],
    paymentFrequency: "monthly" | "quarterly"
  ): number | null {
    const annualRent = rent.annualRentExclTaxExclCharges.value
    const quarterlyRent = rent.quarterlyRentExclTaxExclCharges.value

    if (paymentFrequency === "quarterly") {
      if (typeof quarterlyRent === "number") return quarterlyRent
      if (typeof annualRent === "number") return annualRent / 4
    } else {
      if (typeof annualRent === "number") return annualRent / 12
      if (typeof quarterlyRent === "number") return quarterlyRent / 3
    }

    return null
  }

  private deriveParkingRentPerPeriod(
    rent: RentCalculationExtractedData["rent"],
    paymentFrequency: "monthly" | "quarterly"
  ): number | null {
    const annualParking = rent.annualParkingRentExclCharges.value
    if (typeof annualParking !== "number") return null

    return paymentFrequency === "quarterly"
      ? annualParking / 4
      : annualParking / 12
  }

  private toEndDate(startDateISO: string, durationYears: number): string {
    const start = new Date(startDateISO)
    const end = new Date(
      Date.UTC(
        start.getUTCFullYear() + Math.max(1, durationYears),
        start.getUTCMonth(),
        start.getUTCDate()
      )
    )
    return end.toISOString().split("T")[0]!
  }

  private normalizeExtractedData(
    parsed: RentCalculationExtractedData
  ): RentCalculationExtractedData {
    const missing: ExtractedValue<null> = {
      value: null,
      confidence: "missing" as ConfidenceLevel,
    }

    return {
      calendar: {
        effectiveDate: parsed?.calendar?.effectiveDate ?? missing,
        signatureDate: parsed?.calendar?.signatureDate ?? missing,
        duration: parsed?.calendar?.duration ?? missing,
      },
      rent: {
        annualRentExclTaxExclCharges:
          parsed?.rent?.annualRentExclTaxExclCharges ?? missing,
        quarterlyRentExclTaxExclCharges:
          parsed?.rent?.quarterlyRentExclTaxExclCharges ?? missing,
        annualParkingRentExclCharges:
          parsed?.rent?.annualParkingRentExclCharges ?? missing,
        paymentFrequency: parsed?.rent?.paymentFrequency ?? missing,
      },
    }
  }

  private getDefaultExtractedData(): RentCalculationExtractedData {
    const missing: ExtractedValue<null> = {
      value: null,
      confidence: "missing" as ConfidenceLevel,
    }

    return {
      calendar: {
        effectiveDate: missing,
        signatureDate: missing,
        duration: missing,
      },
      rent: {
        annualRentExclTaxExclCharges: missing,
        quarterlyRentExclTaxExclCharges: missing,
        annualParkingRentExclCharges: missing,
        paymentFrequency: missing,
      },
    }
  }

  private collectResponseText(response: Response): string {
    if (!response?.output) return ""

    let outputText = ""
    for (const item of response.output) {
      if (item.type === "message" && Array.isArray(item.content)) {
        for (const content of item.content) {
          if (
            content.type === "output_text" &&
            typeof content.text === "string"
          ) {
            outputText += content.text
          }
        }
      }
    }
    return outputText
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength) + "\n\n[... document truncated ...]"
  }

  private generateDocumentId(): string {
    return `rent_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
