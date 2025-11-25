import type { LeaseExtractionResult } from "@/app/lib/extraction/types"
import {
  type ComputeLeaseRentScheduleInput,
  type ComputeLeaseRentScheduleResult,
} from "./types"
import { computeLeaseRentSchedule } from "./rent-schedule-calculator"
import {
  buildIndexInputsForLease,
  getInseeRentalIndexSeries,
} from "./insee-rental-index-service"

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

  const horizonYears = 3
  const series = await getInseeRentalIndexSeries()

  const indexStartDate = effectiveDate || signatureDate || startDate
  if (!indexStartDate) {
    return null
  }

  const { baseIndexValue, knownIndexPoints } = buildIndexInputsForLease(
    indexStartDate,
    horizonYears,
    series
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
