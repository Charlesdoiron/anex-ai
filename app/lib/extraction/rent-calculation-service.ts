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

// Use gpt-5.2 for rent calculation as it requires accurate extraction of critical values
const EXTRACTION_MODEL = process.env.OPENAI_RENT_CALC_MODEL?.trim() || "gpt-5.2"
const MAX_RETRIES = 2

// Max characters to send to the model
// gpt-5.2 has a large context window (200k+ tokens), so we can be generous
// 600k chars ≈ 150k tokens, leaving room for prompts (~10k) and response (~20k)
const MAX_DOCUMENT_CHARS = 600_000

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
                MAX_DOCUMENT_CHARS
              )}\n\n${RENT_CALCULATION_EXTRACTION_PROMPT}\n\nRespond with a valid JSON object.`,
            },
          ],
          text: {
            format: {
              type: "json_object",
            },
          },
          reasoning: {
            effort: "medium",
          },
        })

        const outputText = collectResponseText(response)
        if (!outputText) {
          throw new Error("Aucune réponse reçue du modèle")
        }

        const parsed = JSON.parse(outputText) as RentCalculationExtractedData
        const normalized = this.normalizeExtractedData(parsed)

        // Fallback: if indexation not extracted, try dedicated extraction
        if (
          !normalized.indexation?.indexationType?.value &&
          !normalized.indexation?.referenceQuarter?.value
        ) {
          console.log(
            "[RentCalc] Indexation not found, trying dedicated extraction..."
          )
          const indexFallback = await this.extractIndexationOnly(documentText)
          if (indexFallback.indexationType || indexFallback.referenceQuarter) {
            normalized.indexation = {
              indexationType: {
                value: indexFallback.indexationType,
                confidence: indexFallback.indexationType ? "high" : "missing",
                source: "Extraction dédiée (fallback)",
                rawText: indexFallback.indexationType || "Non mentionné",
              },
              referenceQuarter: {
                value: indexFallback.referenceQuarter,
                confidence: indexFallback.referenceQuarter ? "high" : "missing",
                source: "Extraction dédiée (fallback)",
                rawText: indexFallback.referenceQuarter || "Non mentionné",
              },
            }
          }
        }

        return { data: normalized, retries }
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

  /**
   * Dedicated extraction for indexation only - called as fallback if main extraction fails
   */
  private async extractIndexationOnly(documentText: string): Promise<{
    indexationType: string | null
    referenceQuarter: string | null
  }> {
    const INDEXATION_PROMPT = `Extraire UNIQUEMENT les informations d'indexation du bail.

CHERCHER DANS :
- Section "9. INDICE DE REFERENCE" ou "INDICE" dans le TITRE II
- Article "CLAUSE D'INDEXATION" dans le TITRE I
- Mentions de "ILAT", "ILC", "ICC"

CHAMPS À EXTRAIRE :

1. indexationType : L'acronyme de l'indice ("ILC", "ILAT", ou "ICC")
   - "loyers des activités tertiaires" ou "ILAT" → "ILAT"
   - "loyers commerciaux" ou "ILC" → "ILC"
   - "coût de la construction" ou "ICC" → "ICC"

2. referenceQuarter : Trimestre de référence au format "[ACRONYME] T[1-4] [ANNÉE 2 CHIFFRES] ([VALEUR])"
   Exemple : "ILAT 3T 2015, soit 107,98" → "ILAT T3 15 (107,98)"

RÉPONDRE AU FORMAT JSON :
{
  "indexationType": "ILAT" | "ILC" | "ICC" | null,
  "referenceQuarter": "ILAT T3 15 (107,98)" | null
}

Respond with a valid JSON object.`

    try {
      const response = await openai.responses.create({
        model: EXTRACTION_MODEL,
        instructions:
          "Tu es un expert en analyse de baux commerciaux. Extrais uniquement les informations d'indexation.",
        input: [
          {
            role: "user",
            content: `Document:\n\n${truncateText(documentText, MAX_DOCUMENT_CHARS)}\n\n${INDEXATION_PROMPT}`,
          },
        ],
        text: { format: { type: "json_object" } },
        reasoning: { effort: "medium" },
      })

      const outputText = collectResponseText(response)
      const parsed = JSON.parse(outputText)
      return {
        indexationType: parsed.indexationType || null,
        referenceQuarter: parsed.referenceQuarter || null,
      }
    } catch (error) {
      console.error("Indexation fallback extraction failed:", error)
      return { indexationType: null, referenceQuarter: null }
    }
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

      // Infer payment frequency using contextual signals
      const paymentFrequency = this.inferPaymentFrequency(data)

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
      const { baseIndexValue: inseeBaseIndex, knownIndexPoints } =
        buildIndexInputsForLease(
          startDate,
          horizonYears,
          series,
          explicitReferenceQuarter
        )

      // NOTE: We do NOT use the explicit index value from the lease document (e.g., "107,98")
      // because INSEE rebased these series multiple times (base 2004 → 2010 → etc.).
      // The document value may be on a different base than our database, which would
      // corrupt the ratios (base vs. future indices). We must use INSEE DB values
      // consistently for both base AND subsequent indices.
      const baseIndexValue = inseeBaseIndex

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
    const quarterlyParking = rent.quarterlyParkingRentExclCharges.value

    if (paymentFrequency === "quarterly") {
      // Priority: quarterly if explicit, then annual / 4
      if (typeof quarterlyParking === "number") return quarterlyParking
      if (typeof annualParking === "number") return annualParking / 4
    } else {
      // Monthly: derive from annual or quarterly
      if (typeof annualParking === "number") return annualParking / 12
      if (typeof quarterlyParking === "number") return quarterlyParking / 3
    }

    return null
  }

  /**
   * Calculate end date as J-1 (day before anniversary).
   * Example: start 01/01/2016 + 12 years = 31/12/2027 (not 01/01/2028)
   * This follows French lease convention where the end date is the day before the anniversary.
   */
  private toEndDate(startDateISO: string, durationYears: number): string {
    const start = new Date(startDateISO)
    const end = new Date(
      Date.UTC(
        start.getUTCFullYear() + Math.max(1, durationYears),
        start.getUTCMonth(),
        start.getUTCDate()
      )
    )
    // J-1: subtract one day to get the day before the anniversary
    end.setUTCDate(end.getUTCDate() - 1)
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

    // Normalize paymentFrequency - handle "Non mentionné" string as null
    let paymentFrequencyField = parsed?.rent?.paymentFrequency ?? missing
    if (
      paymentFrequencyField.value &&
      typeof paymentFrequencyField.value === "string" &&
      paymentFrequencyField.value !== "monthly" &&
      paymentFrequencyField.value !== "quarterly"
    ) {
      paymentFrequencyField = missing
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
        paymentFrequency: paymentFrequencyField,
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

    return this.normalizePeriodicAmounts(extractedData)
  }

  private normalizePeriodicAmounts(
    data: RentCalculationExtractedData
  ): RentCalculationExtractedData {
    const cloned: RentCalculationExtractedData = {
      ...data,
      charges: data.charges ? { ...data.charges } : undefined,
      taxes: data.taxes ? { ...data.taxes } : undefined,
    }

    // Charges: compute annual from quarterly when missing (no LLM arithmetic)
    if (cloned.charges) {
      const annual = cloned.charges.annualChargesProvisionExclTax
      const quarterly = cloned.charges.quarterlyChargesProvisionExclTax
      if (
        (annual?.value === null || annual?.value === undefined) &&
        typeof quarterly?.value === "number" &&
        quarterly.value > 0
      ) {
        cloned.charges.annualChargesProvisionExclTax = {
          ...annual,
          value: this.roundCurrency(quarterly.value * 4),
          confidence: annual?.confidence ?? quarterly.confidence,
          source: quarterly.source
            ? `${quarterly.source} (annualisé ×4)`
            : "Annualisé (×4) à partir du montant trimestriel",
          rawText: quarterly.rawText ?? annual?.rawText,
        }
      }
    }

    // Taxes: normalize to ANNUAL amounts based on periodicity in rawText
    if (cloned.taxes) {
      cloned.taxes.propertyTaxAmount = this.annualizeIfPeriodic(
        cloned.taxes.propertyTaxAmount
      )
      cloned.taxes.officeTaxAmount = this.annualizeIfPeriodic(
        cloned.taxes.officeTaxAmount
      )
    }

    return cloned
  }

  private annualizeIfPeriodic(
    field: ExtractedValue<number | null>
  ): ExtractedValue<number | null> {
    if (typeof field.value !== "number" || field.value <= 0) {
      return field
    }

    const period = this.detectAmountPeriod(field.rawText)
    const factor = period === "quarter" ? 4 : period === "month" ? 12 : 1

    if (factor === 1) {
      return field
    }

    const parsed = this.parseMoneyFromRawText(field.rawText)
    if (typeof parsed === "number") {
      // Guardrail: avoid double-annualising if the model already returned an annual value.
      if (this.isClose(field.value, parsed * factor, 0.02)) {
        return field
      }
      // Prefer annualising only when the extracted value matches the amount in rawText.
      if (!this.isClose(field.value, parsed, 0.02)) {
        return field
      }
    }

    return {
      ...field,
      value: this.roundCurrency(field.value * factor),
      source: field.source
        ? `${field.source} (annualisé ×${factor})`
        : `Annualisé (×${factor})`,
    }
  }

  private detectAmountPeriod(
    rawText: ExtractedValue<unknown>["rawText"]
  ): "year" | "quarter" | "month" | null {
    if (typeof rawText !== "string") return null
    const text = rawText.toLowerCase()

    // Prefer explicit periodicity markers
    if (
      text.includes("par trimestre") ||
      text.includes("trimestriel") ||
      text.includes("trimestrielle") ||
      /\b\/\s*trimestre\b/.test(text)
    ) {
      return "quarter"
    }
    if (
      text.includes("par mois") ||
      text.includes("mensuel") ||
      text.includes("mensuelle") ||
      text.includes("mensuellement") ||
      /\b\/\s*mois\b/.test(text)
    ) {
      return "month"
    }
    if (
      text.includes("par an") ||
      text.includes("annuel") ||
      text.includes("annuelle") ||
      text.includes("annuellement") ||
      /\b\/\s*an\b/.test(text)
    ) {
      return "year"
    }
    return null
  }

  private parseMoneyFromRawText(
    rawText: ExtractedValue<unknown>["rawText"]
  ): number | null {
    if (typeof rawText !== "string" || !rawText.trim()) return null

    const euroMatch =
      rawText.match(/([\d\s\u00A0.,]+)\s*(?:€|euros?|eur)\b/i) ?? null
    const genericMatch = rawText.match(/(\d[\d\s\u00A0.,]*)/) ?? null
    const captured = (euroMatch?.[1] || genericMatch?.[1] || "").trim()
    if (!captured) return null

    let normalized = captured.replace(/[\s\u00A0]/g, "")

    // French OCR often uses "." as thousands and "," as decimals (e.g., "1.917,35")
    if (normalized.includes(",") && normalized.includes(".")) {
      normalized = normalized.replace(/\./g, "")
    }

    normalized = normalized.replace(",", ".")
    const num = Number.parseFloat(normalized)
    return Number.isFinite(num) ? num : null
  }

  private isClose(a: number, b: number, epsilon: number): boolean {
    return Math.abs(a - b) <= epsilon
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

  /**
   * Infer payment frequency using multiple contextual signals.
   * More reliable than a rigid fallback.
   */
  private inferPaymentFrequency(
    data: RentCalculationExtractedData
  ): "monthly" | "quarterly" {
    const extracted = data.rent.paymentFrequency.value
    const rawText = data.rent.paymentFrequency.rawText?.toLowerCase() || ""

    // 1. Explicit value from extraction
    if (extracted === "monthly" || extracted === "quarterly") {
      return extracted
    }

    // 2. Analyze rawText for frequency indicators
    const quarterlyIndicators = [
      "trimestriel",
      "trimestre",
      "terme",
      "à terme",
      "terme échu",
      "par trimestre",
      "chaque trimestre",
    ]
    const monthlyIndicators = [
      "mensuel",
      "mois",
      "par mois",
      "chaque mois",
      "mensuellement",
    ]

    const hasQuarterlyHint = quarterlyIndicators.some((ind) =>
      rawText.includes(ind)
    )
    const hasMonthlyHint = monthlyIndicators.some((ind) =>
      rawText.includes(ind)
    )

    if (hasQuarterlyHint && !hasMonthlyHint) return "quarterly"
    if (hasMonthlyHint && !hasQuarterlyHint) return "monthly"

    // 3. Check if quarterly rent was explicitly provided (strong signal)
    const hasQuarterlyRent =
      typeof data.rent.quarterlyRentExclTaxExclCharges.value === "number"
    const hasAnnualRent =
      typeof data.rent.annualRentExclTaxExclCharges.value === "number"

    if (hasQuarterlyRent) {
      return "quarterly"
    }

    // 4. Check if deposit is 3 months (common for quarterly payments)
    const depositAmount = data.securities?.securityDepositAmount?.value
    const annualRent = data.rent.annualRentExclTaxExclCharges.value
    if (
      typeof depositAmount === "number" &&
      typeof annualRent === "number" &&
      annualRent > 0
    ) {
      const monthlyRent = annualRent / 12
      const depositMonths = Math.round(depositAmount / monthlyRent)
      // 3 months deposit is very common for quarterly commercial leases
      if (depositMonths === 3) {
        return "quarterly"
      }
    }

    // 5. Check if annual rent / 4 gives a round number (suggests quarterly)
    if (hasAnnualRent && annualRent) {
      const quarterlyRent = annualRent / 4
      const monthlyRent = annualRent / 12

      // A "round" number has fewer decimals
      const quarterlyDecimals = this.countSignificantDecimals(quarterlyRent)
      const monthlyDecimals = this.countSignificantDecimals(monthlyRent)

      if (quarterlyDecimals < monthlyDecimals) {
        return "quarterly"
      } else if (monthlyDecimals < quarterlyDecimals) {
        return "monthly"
      }
    }

    // 6. Default: French commercial leases are predominantly quarterly
    // This is the weakest signal, only used when nothing else is available
    return "quarterly"
  }

  /**
   * Count significant decimal places in a number (ignoring trailing zeros)
   */
  private countSignificantDecimals(value: number): number {
    const str = value.toFixed(4)
    const parts = str.split(".")
    if (parts.length < 2) return 0

    const decimals = parts[1].replace(/0+$/, "")
    return decimals.length
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

  // Intentionally no "parseIndexValueFromReference": we avoid mixing index bases.
}
