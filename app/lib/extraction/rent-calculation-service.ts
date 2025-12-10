/**
 * Lightweight extraction service for rent calculation
 * Only extracts the minimum required fields for INSEE-indexed rent schedule
 */

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
import {
  DEFAULT_LEASE_INDEX_TYPE,
  toLeaseIndexType,
  type ComputeLeaseRentScheduleInput,
  type ComputeLeaseRentScheduleResult,
} from "../lease/types"
import { getOpenAIClient } from "@/app/lib/openai/client"
import {
  collectResponseText,
  truncateText,
} from "@/app/lib/openai/response-utils"

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
  premises?: {
    designation: ExtractedValue<string | null>
    address: ExtractedValue<string | null>
    surfaceArea: ExtractedValue<number | null>
    parkingSpaces: ExtractedValue<number | null>
  }
  rent: {
    annualRentExclTaxExclCharges: ExtractedValue<number | null>
    quarterlyRentExclTaxExclCharges: ExtractedValue<number | null>
    annualParkingRentExclCharges: ExtractedValue<number | null>
    annualRentPerSqmExclTaxExclCharges: ExtractedValue<number | null>
    quarterlyParkingRentExclCharges: ExtractedValue<number | null>
    annualParkingRentPerUnitExclCharges: ExtractedValue<number | null>
    paymentFrequency: ExtractedValue<"monthly" | "quarterly" | null>
  }
  indexation?: {
    indexationType: ExtractedValue<string | null>
    referenceQuarter: ExtractedValue<string | null>
  }
  supportMeasures?: {
    rentFreePeriodMonths: ExtractedValue<number | null>
    rentFreePeriodAmount: ExtractedValue<number | null>
    otherMeasuresDescription: ExtractedValue<string | null>
  }
  securities?: {
    securityDepositDescription: ExtractedValue<string | null>
    securityDepositAmount: ExtractedValue<number | null>
  }
  charges?: {
    annualChargesProvisionExclTax: ExtractedValue<number | null>
    quarterlyChargesProvisionExclTax: ExtractedValue<number | null>
    annualChargesProvisionPerSqmExclTax: ExtractedValue<number | null>
  }
  taxes?: {
    propertyTaxAmount: ExtractedValue<number | null>
    officeTaxAmount: ExtractedValue<number | null>
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
              content: `Document text:\n\n${truncateText(
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

        const outputText = collectResponseText(response)
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

      const indexType =
        toLeaseIndexType(data.indexation?.indexationType?.value) ??
        DEFAULT_LEASE_INDEX_TYPE

      const DEFAULT_HORIZON_YEARS = 3
      const durationYears =
        data.calendar.duration.value ?? DEFAULT_HORIZON_YEARS
      const horizonYears = durationYears

      // Parse reference quarter from extraction (e.g., "ILC 2ème trimestre 2016" → 2)
      const referenceQuarterText = data.indexation?.referenceQuarter?.value
      const explicitReferenceQuarter =
        this.parseReferenceQuarter(referenceQuarterText)

      const series = await getInseeRentalIndexSeries(indexType)
      const { baseIndexValue, knownIndexPoints } = buildIndexInputsForLease(
        startDate,
        horizonYears,
        series,
        explicitReferenceQuarter
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

      const endDate = this.toEndDate(startDate, durationYears)

      // Derive franchise months
      const rawFranchiseMonths =
        data.supportMeasures?.rentFreePeriodMonths?.value
      const franchiseMonths =
        typeof rawFranchiseMonths === "number" && rawFranchiseMonths > 0
          ? Math.round(rawFranchiseMonths)
          : 0

      // Derive deposit months
      const depositMonths = this.deriveDepositMonths(data)

      // Derive charges and taxes
      const { chargesPerPeriod, taxesPerPeriod } =
        this.deriveChargesAndTaxesPerPeriod(data, paymentFrequency)

      // Default charges/taxes growth rate: 2% per year (as per client template)
      const DEFAULT_CHARGES_GROWTH_RATE = 0.02

      const scheduleInput: ComputeLeaseRentScheduleInput = {
        startDate,
        endDate,
        paymentFrequency,
        baseIndexValue,
        indexType,
        knownIndexPoints,
        officeRentHT: officeRentPerPeriod,
        parkingRentHT: parkingRentPerPeriod || undefined,
        chargesHT: chargesPerPeriod || undefined,
        taxesHT: taxesPerPeriod || undefined,
        horizonYears,
        franchiseMonths: franchiseMonths > 0 ? franchiseMonths : undefined,
        depositMonths: depositMonths > 0 ? depositMonths : undefined,
        chargesGrowthRate: DEFAULT_CHARGES_GROWTH_RATE,
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

  private deriveDepositMonths(data: RentCalculationExtractedData): number {
    // Try to extract months from description (e.g., "3 mois de loyer")
    const description = data.securities?.securityDepositDescription?.value
    if (description) {
      const monthsMatch = description.match(/(\d+)\s*mois/i)
      if (monthsMatch) {
        return parseInt(monthsMatch[1], 10)
      }
    }

    // Calculate from amount and rent if available
    const depositAmount = data.securities?.securityDepositAmount?.value
    if (typeof depositAmount !== "number" || depositAmount <= 0) {
      return 0
    }

    const annualRent = data.rent.annualRentExclTaxExclCharges.value
    const quarterlyRent = data.rent.quarterlyRentExclTaxExclCharges.value

    let monthlyRent: number | null = null
    if (typeof annualRent === "number" && annualRent > 0) {
      monthlyRent = annualRent / 12
    } else if (typeof quarterlyRent === "number" && quarterlyRent > 0) {
      monthlyRent = quarterlyRent / 3
    }

    if (monthlyRent && monthlyRent > 0) {
      return Math.round(depositAmount / monthlyRent)
    }

    return 0
  }

  private deriveChargesAndTaxesPerPeriod(
    data: RentCalculationExtractedData,
    paymentFrequency: "monthly" | "quarterly"
  ): { chargesPerPeriod: number | null; taxesPerPeriod: number | null } {
    const annualCharges = data.charges?.annualChargesProvisionExclTax?.value
    const quarterlyCharges =
      data.charges?.quarterlyChargesProvisionExclTax?.value
    const propertyTax = data.taxes?.propertyTaxAmount?.value
    const officeTax = data.taxes?.officeTaxAmount?.value

    let chargesPerPeriod: number | null = null
    let taxesPerPeriod: number | null = null

    if (paymentFrequency === "quarterly") {
      if (typeof quarterlyCharges === "number") {
        chargesPerPeriod = quarterlyCharges
      } else if (typeof annualCharges === "number") {
        chargesPerPeriod = annualCharges / 4
      }

      if (typeof propertyTax === "number" || typeof officeTax === "number") {
        const annualTaxes = (propertyTax ?? 0) + (officeTax ?? 0)
        taxesPerPeriod = annualTaxes / 4
      }
    } else {
      if (typeof annualCharges === "number") {
        chargesPerPeriod = annualCharges / 12
      } else if (typeof quarterlyCharges === "number") {
        chargesPerPeriod = quarterlyCharges / 3
      }

      if (typeof propertyTax === "number" || typeof officeTax === "number") {
        const annualTaxes = (propertyTax ?? 0) + (officeTax ?? 0)
        taxesPerPeriod = annualTaxes / 12
      }
    }

    return {
      chargesPerPeriod:
        chargesPerPeriod !== null ? this.roundCurrency(chargesPerPeriod) : null,
      taxesPerPeriod:
        taxesPerPeriod !== null ? this.roundCurrency(taxesPerPeriod) : null,
    }
  }

  private roundCurrency(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100
  }

  private normalizeExtractedData(
    parsed: RentCalculationExtractedData
  ): RentCalculationExtractedData {
    const missing: ExtractedValue<null> = {
      value: null,
      confidence: "missing" as ConfidenceLevel,
      rawText: "Non mentionné",
    }

    const extractedData: RentCalculationExtractedData = {
      calendar: {
        effectiveDate: parsed?.calendar?.effectiveDate ?? missing,
        signatureDate: parsed?.calendar?.signatureDate ?? missing,
        duration: parsed?.calendar?.duration ?? missing,
      },
      premises: {
        designation: parsed?.premises?.designation ?? missing,
        address: parsed?.premises?.address ?? missing,
        surfaceArea: parsed?.premises?.surfaceArea ?? missing,
        parkingSpaces: parsed?.premises?.parkingSpaces ?? missing,
      },
      rent: {
        annualRentExclTaxExclCharges:
          parsed?.rent?.annualRentExclTaxExclCharges ?? missing,
        quarterlyRentExclTaxExclCharges:
          parsed?.rent?.quarterlyRentExclTaxExclCharges ?? missing,
        annualRentPerSqmExclTaxExclCharges:
          parsed?.rent?.annualRentPerSqmExclTaxExclCharges ?? missing,
        annualParkingRentExclCharges:
          parsed?.rent?.annualParkingRentExclCharges ?? missing,
        quarterlyParkingRentExclCharges:
          parsed?.rent?.quarterlyParkingRentExclCharges ?? missing,
        annualParkingRentPerUnitExclCharges:
          parsed?.rent?.annualParkingRentPerUnitExclCharges ?? missing,
        paymentFrequency: parsed?.rent?.paymentFrequency ?? missing,
      },
      indexation: {
        indexationType: parsed?.indexation?.indexationType ?? missing,
        referenceQuarter: parsed?.indexation?.referenceQuarter ?? missing,
      },
      supportMeasures: {
        rentFreePeriodMonths:
          parsed?.supportMeasures?.rentFreePeriodMonths ?? missing,
        rentFreePeriodAmount:
          parsed?.supportMeasures?.rentFreePeriodAmount ?? missing,
        otherMeasuresDescription:
          parsed?.supportMeasures?.otherMeasuresDescription ?? missing,
      },
      securities: {
        securityDepositDescription:
          parsed?.securities?.securityDepositDescription ?? missing,
        securityDepositAmount:
          parsed?.securities?.securityDepositAmount ?? missing,
      },
      charges: {
        annualChargesProvisionExclTax:
          parsed?.charges?.annualChargesProvisionExclTax ?? missing,
        quarterlyChargesProvisionExclTax:
          parsed?.charges?.quarterlyChargesProvisionExclTax ?? missing,
        annualChargesProvisionPerSqmExclTax:
          parsed?.charges?.annualChargesProvisionPerSqmExclTax ?? missing,
      },
      taxes: {
        propertyTaxAmount: parsed?.taxes?.propertyTaxAmount ?? missing,
        officeTaxAmount: parsed?.taxes?.officeTaxAmount ?? missing,
      },
    }

    return extractedData
  }

  private getDefaultExtractedData(): RentCalculationExtractedData {
    const missing: ExtractedValue<null> = {
      value: null,
      confidence: "missing" as ConfidenceLevel,
      rawText: "Non mentionné",
    }

    return {
      calendar: {
        effectiveDate: missing,
        signatureDate: missing,
        duration: missing,
      },
      premises: {
        designation: missing,
        address: missing,
        surfaceArea: missing,
        parkingSpaces: missing,
      },
      rent: {
        annualRentExclTaxExclCharges: missing,
        quarterlyRentExclTaxExclCharges: missing,
        annualRentPerSqmExclTaxExclCharges: missing,
        annualParkingRentExclCharges: missing,
        quarterlyParkingRentExclCharges: missing,
        annualParkingRentPerUnitExclCharges: missing,
        paymentFrequency: missing,
      },
      indexation: {
        indexationType: missing,
        referenceQuarter: missing,
      },
      supportMeasures: {
        rentFreePeriodMonths: missing,
        rentFreePeriodAmount: missing,
        otherMeasuresDescription: missing,
      },
      securities: {
        securityDepositDescription: missing,
        securityDepositAmount: missing,
      },
      charges: {
        annualChargesProvisionExclTax: missing,
        quarterlyChargesProvisionExclTax: missing,
        annualChargesProvisionPerSqmExclTax: missing,
      },
      taxes: {
        propertyTaxAmount: missing,
        officeTaxAmount: missing,
      },
    }
  }

  private generateDocumentId(): string {
    return `rent_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private parseReferenceQuarter(
    referenceQuarterText: string | null | undefined
  ): number | null {
    if (!referenceQuarterText) return null

    const text = referenceQuarterText.toLowerCase()

    // Match patterns like "T1", "1T", "1er trimestre", "2ème trimestre", "Q1", etc.
    if (
      /\b(premier|1er)\s+(trimestre|quartier)/i.test(text) ||
      /[tq]1\b/i.test(text)
    ) {
      return 1
    }
    if (
      /\b(deuxi[èe]me|2[èe]me)\s+(trimestre|quartier)/i.test(text) ||
      /[tq]2\b/i.test(text)
    ) {
      return 2
    }
    if (
      /\b(troisi[èe]me|3[èe]me)\s+(trimestre|quartier)/i.test(text) ||
      /[tq]3\b/i.test(text)
    ) {
      return 3
    }
    if (
      /\b(quatri[èe]me|4[èe]me)\s+(trimestre|quartier)/i.test(text) ||
      /[tq]4\b/i.test(text)
    ) {
      return 4
    }

    return null
  }
}
