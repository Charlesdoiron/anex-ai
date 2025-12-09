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
  const input = await buildScheduleInputFromExtraction(extraction)
  if (!input) {
    return null
  }

  return computeLeaseRentSchedule(input)
}

async function buildScheduleInputFromExtraction(
  extraction: LeaseExtractionResult
): Promise<ComputeLeaseRentScheduleInput | null> {
  const calendar = extraction.calendar
  const rent = extraction.rent
  const charges = extraction.charges
  const taxes = extraction.taxes
  const support = extraction.supportMeasures

  const effectiveDate = calendar?.effectiveDate?.value
  const signatureDate = calendar?.signatureDate?.value

  const startDate =
    (effectiveDate || signatureDate || extraction.extractionDate) ?? null

  if (!startDate) {
    return null
  }

  const paymentFrequency = rent?.paymentFrequency?.value
  if (paymentFrequency !== "monthly" && paymentFrequency !== "quarterly") {
    return null
  }

  const detectedIndexType =
    toLeaseIndexType(extraction.indexation?.indexationType?.value) ??
    DEFAULT_LEASE_INDEX_TYPE

  const horizonYears = 3
  const series = await getInseeRentalIndexSeries(detectedIndexType)

  const indexStartDate = effectiveDate || signatureDate || startDate
  if (!indexStartDate) {
    return null
  }

  // Extract reference quarter from lease if specified
  const referenceQuarterText = extraction.indexation?.referenceQuarter?.value
  const referenceQuarter = parseReferenceQuarter(
    referenceQuarterText,
    indexStartDate
  )

  const { baseIndexValue, knownIndexPoints } = buildIndexInputsForLease(
    indexStartDate,
    horizonYears,
    series,
    referenceQuarter
  )

  if (!baseIndexValue) {
    return null
  }

  const { officeRentPerPeriod, parkingRentPerPeriod } = deriveBaseRentPerPeriod(
    rent,
    paymentFrequency
  )

  if (!officeRentPerPeriod) {
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

  const durationYears = calendar?.duration?.value ?? horizonYears
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
