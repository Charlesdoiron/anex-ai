import type { LeaseExtractionResult } from "@/app/lib/extraction/types"
import { computeLeaseRentSchedule } from "./rent-schedule-calculator"
import {
  buildIndexInputsForLease,
  getInseeRentalIndexSeries,
  parseISODateSafe,
  getQuarter,
} from "./insee-rental-index-service"
import {
  DEFAULT_LEASE_INDEX_TYPE,
  toLeaseIndexType,
  type ComputeLeaseRentScheduleInput,
  type ComputeLeaseRentScheduleResult,
} from "./types"

export async function computeRentScheduleFromExtraction(
  extraction: LeaseExtractionResult
): Promise<ComputeLeaseRentScheduleResult | null> {
  try {
    const input = await buildScheduleInputFromExtraction(extraction)
    if (!input) {
      console.warn(
        "[RentSchedule] Impossible de construire l'input pour le calcul de l'échéancier. " +
          "Vérifiez que les données nécessaires (dates, loyer, fréquence de paiement) sont présentes."
      )
      return null
    }

    return computeLeaseRentSchedule(input)
  } catch (error) {
    console.error(
      "[RentSchedule] Erreur lors du calcul de l'échéancier:",
      error
    )
    return null
  }
}

async function buildScheduleInputFromExtraction(
  extraction: LeaseExtractionResult
): Promise<ComputeLeaseRentScheduleInput | null> {
  const calendar = extraction.calendar
  const rent = extraction.rent
  const charges = extraction.charges
  const taxes = extraction.taxes
  const support = extraction.supportMeasures
  const securities = extraction.securities

  const effectiveDate = calendar?.effectiveDate?.value
  const signatureDate = calendar?.signatureDate?.value

  const startDate =
    (effectiveDate || signatureDate || extraction.extractionDate) ?? null

  if (!startDate) {
    console.warn(
      "[RentSchedule] Date de début manquante (effectiveDate, signatureDate, extractionDate)"
    )
    return null
  }

  const paymentFrequency = rent?.paymentFrequency?.value
  if (paymentFrequency !== "monthly" && paymentFrequency !== "quarterly") {
    console.warn(
      `[RentSchedule] Fréquence de paiement invalide: ${paymentFrequency} (attendu: monthly ou quarterly)`
    )
    return null
  }

  const detectedIndexType =
    toLeaseIndexType(extraction.indexation?.indexationType?.value) ??
    DEFAULT_LEASE_INDEX_TYPE

  const durationYears = calendar?.duration?.value ?? 9
  const horizonYears = durationYears // Use actual lease duration instead of fixed 3 years

  // Retry fetching INSEE series in case of cold start issues
  let series = await getInseeRentalIndexSeries(detectedIndexType)

  // If series is empty, retry once after a short delay (cold start mitigation)
  if (series.length === 0) {
    console.warn(
      `[RentSchedule] Série INSEE vide pour ${detectedIndexType}, retry après 500ms...`
    )
    await new Promise((resolve) => setTimeout(resolve, 500))
    series = await getInseeRentalIndexSeries(detectedIndexType)
  }

  const indexStartDate = effectiveDate || signatureDate || startDate
  if (!indexStartDate) {
    console.warn("[RentSchedule] Date de début pour l'index manquante")
    return null
  }

  // Extract reference quarter from lease if specified
  const referenceQuarterText = extraction.indexation?.referenceQuarter?.value
  const referenceQuarter = parseReferenceQuarter(
    referenceQuarterText,
    indexStartDate
  )

  // Note: We do NOT use the explicit index value from the lease document (e.g., "107.98")
  // because INSEE has rebased their indices multiple times (base 2004 → 2010 → etc.)
  // The document value may be on a different base than our database.
  // We MUST use INSEE database values consistently for both base AND future indices.
  const { baseIndexValue, knownIndexPoints } = buildIndexInputsForLease(
    indexStartDate,
    horizonYears,
    series,
    referenceQuarter
  )

  if (!baseIndexValue) {
    console.warn(
      `[RentSchedule] Impossible de déterminer baseIndexValue. ` +
        `Série INSEE: ${series.length} points, date: ${indexStartDate}`
    )
    return null
  }

  const { officeRentPerPeriod, parkingRentPerPeriod } = deriveBaseRentPerPeriod(
    rent,
    paymentFrequency
  )

  if (!officeRentPerPeriod) {
    console.warn(
      "[RentSchedule] Loyer bureaux manquant (annualRentExclTaxExclCharges ou quarterlyRentExclTaxExclCharges)"
    )
    return null
  }

  const { chargesPerPeriod, taxesPerPeriod } = deriveChargesAndTaxesPerPeriod(
    charges,
    taxes,
    paymentFrequency
  )

  const rawFranchiseMonths = support?.rentFreePeriodMonths?.value
  const franchiseMonths =
    typeof rawFranchiseMonths === "number" && rawFranchiseMonths > 0
      ? Math.round(rawFranchiseMonths)
      : 0

  // Derive deposit months from extracted security deposit
  const depositMonths = deriveDepositMonths(securities, rent, paymentFrequency)

  const endDate = toEndDate(startDate, durationYears)

  return {
    startDate,
    endDate,
    paymentFrequency,
    baseIndexValue,
    indexType: detectedIndexType,
    knownIndexPoints,
    officeRentHT: officeRentPerPeriod,
    parkingRentHT: parkingRentPerPeriod || undefined,
    chargesHT: chargesPerPeriod || undefined,
    taxesHT: taxesPerPeriod || undefined,
    horizonYears,
    franchiseMonths: franchiseMonths > 0 ? franchiseMonths : undefined,
    depositMonths: depositMonths > 0 ? depositMonths : undefined,
  }
}

function deriveBaseRentPerPeriod(
  rent: LeaseExtractionResult["rent"],
  paymentFrequency: "monthly" | "quarterly"
): { officeRentPerPeriod: number | null; parkingRentPerPeriod: number | null } {
  const annualBase = rent?.annualRentExclTaxExclCharges?.value ?? null
  const quarterlyBase = rent?.quarterlyRentExclTaxExclCharges?.value ?? null
  const annualParking = rent?.annualParkingRentExclCharges?.value ?? null
  const quarterlyParking = rent?.quarterlyParkingRentExclCharges?.value ?? null

  let officeRentPerPeriod: number | null = null
  let parkingRentPerPeriod: number | null = null

  if (paymentFrequency === "quarterly") {
    if (typeof quarterlyBase === "number") {
      officeRentPerPeriod = quarterlyBase
    } else if (typeof annualBase === "number") {
      officeRentPerPeriod = annualBase / 4
    }

    if (typeof quarterlyParking === "number") {
      parkingRentPerPeriod = quarterlyParking
    } else if (typeof annualParking === "number") {
      parkingRentPerPeriod = annualParking / 4
    }
  } else {
    if (typeof annualBase === "number") {
      officeRentPerPeriod = annualBase / 12
    } else if (typeof quarterlyBase === "number") {
      officeRentPerPeriod = quarterlyBase / 3
    }

    if (typeof annualParking === "number") {
      parkingRentPerPeriod = annualParking / 12
    } else if (typeof quarterlyParking === "number") {
      parkingRentPerPeriod = quarterlyParking / 3
    }
  }

  return {
    officeRentPerPeriod:
      officeRentPerPeriod !== null ? roundCurrency(officeRentPerPeriod) : null,
    parkingRentPerPeriod:
      parkingRentPerPeriod !== null
        ? roundCurrency(parkingRentPerPeriod)
        : null,
  }
}

function deriveChargesAndTaxesPerPeriod(
  charges: LeaseExtractionResult["charges"],
  taxes: LeaseExtractionResult["taxes"],
  paymentFrequency: "monthly" | "quarterly"
): { chargesPerPeriod: number | null; taxesPerPeriod: number | null } {
  const annualCharges = charges?.annualChargesProvisionExclTax?.value ?? null
  const quarterlyCharges =
    charges?.quarterlyChargesProvisionExclTax?.value ?? null
  const propertyTax = taxes?.propertyTaxAmount?.value ?? null
  const officeTax = taxes?.officeTaxAmount?.value ?? null

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
      chargesPerPeriod !== null ? roundCurrency(chargesPerPeriod) : null,
    taxesPerPeriod:
      taxesPerPeriod !== null ? roundCurrency(taxesPerPeriod) : null,
  }
}

function toEndDate(startDateISO: string, durationYears: number): string {
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

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function deriveDepositMonths(
  securities: LeaseExtractionResult["securities"],
  rent: LeaseExtractionResult["rent"],
  paymentFrequency: "monthly" | "quarterly"
): number {
  // First, try to extract months from description (e.g., "3 mois de loyer")
  const description = securities?.securityDepositDescription?.value
  if (description) {
    const monthsMatch = description.match(/(\d+)\s*mois/i)
    if (monthsMatch) {
      return parseInt(monthsMatch[1], 10)
    }
  }

  // If no months in description, calculate from amount and rent
  const depositAmount = securities?.securityDepositAmount?.value
  if (typeof depositAmount !== "number" || depositAmount <= 0) {
    return 0
  }

  // Get quarterly or annual rent to calculate months
  const annualRent = rent?.annualRentExclTaxExclCharges?.value
  const quarterlyRent = rent?.quarterlyRentExclTaxExclCharges?.value

  let monthlyRent: number | null = null

  if (typeof annualRent === "number" && annualRent > 0) {
    monthlyRent = annualRent / 12
  } else if (typeof quarterlyRent === "number" && quarterlyRent > 0) {
    monthlyRent = quarterlyRent / 3
  }

  if (monthlyRent && monthlyRent > 0) {
    const calculatedMonths = depositAmount / monthlyRent
    // Round to nearest integer (typically 1, 2, or 3 months)
    return Math.round(calculatedMonths)
  }

  return 0
}

function parseReferenceQuarter(
  referenceQuarterText: string | null | undefined,
  effectiveDate?: string | null
): number | null {
  if (!referenceQuarterText) return null

  const text = referenceQuarterText.toLowerCase()

  // Check if it's a "last published index" pattern
  // In this case, use the quarter BEFORE the effective date quarter
  if (
    (text.includes("dernier") && text.includes("publié")) ||
    text.includes("last published")
  ) {
    if (effectiveDate) {
      const date = parseISODateSafe(effectiveDate)
      if (date) {
        const currentQuarter = getQuarter(date)
        // Last published index = previous quarter
        return currentQuarter === 1 ? 4 : currentQuarter - 1
      }
    }
    // Fallback: cannot determine, return null
    return null
  }

  // Match patterns like "T1", "1T", "1er trimestre", "2ème trimestre", "Q1", etc.
  // Order matters - check more specific patterns first
  // Support both "T1" and "1T" formats (French documents use both)
  if (
    /\b(premier|1er)\s+(trimestre|quartier)/i.test(text) ||
    /[tq]1\b/i.test(text) ||
    /\b1[tq]\b/i.test(text)
  ) {
    return 1
  }
  if (
    /\b(deuxi[èe]me|2[èe]me)\s+(trimestre|quartier)/i.test(text) ||
    /[tq]2\b/i.test(text) ||
    /\b2[tq]\b/i.test(text)
  ) {
    return 2
  }
  if (
    /\b(troisi[èe]me|3[èe]me)\s+(trimestre|quartier)/i.test(text) ||
    /[tq]3\b/i.test(text) ||
    /\b3[tq]\b/i.test(text)
  ) {
    return 3
  }
  if (
    /\b(quatri[èe]me|4[èe]me)\s+(trimestre|quartier)/i.test(text) ||
    /[tq]4\b/i.test(text) ||
    /\b4[tq]\b/i.test(text)
  ) {
    return 4
  }

  return null
}
