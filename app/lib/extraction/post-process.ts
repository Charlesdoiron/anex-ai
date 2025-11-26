/**
 * Post-processing for computed extraction fields
 * Calculates derived values from extracted raw data
 */

import type {
  LeaseExtractionResult,
  ExtractedValue,
  ConfidenceLevel,
} from "./types"

/**
 * Computes derived fields from raw extracted values.
 * This runs after all sections are extracted, ensuring all dependencies are available.
 */
export function postProcessExtraction(
  result: LeaseExtractionResult
): LeaseExtractionResult {
  const processed = { ...result }

  // Calendar computed fields
  processed.calendar = computeCalendarFields(processed)

  // Rent computed fields (needs premises.surfaceArea)
  processed.rent = computeRentFields(processed)

  // Charges computed fields (needs premises.surfaceArea)
  processed.charges = computeChargesFields(processed)

  // Support measures computed fields (needs rent)
  processed.supportMeasures = computeSupportMeasuresFields(processed)

  return processed
}

function computeCalendarFields(
  result: LeaseExtractionResult
): LeaseExtractionResult["calendar"] {
  const calendar = { ...result.calendar }

  // Compute endDate from effectiveDate + duration
  if (
    !hasValue(calendar.endDate) &&
    hasValue(calendar.effectiveDate) &&
    hasValue(calendar.duration)
  ) {
    const effectiveDate = calendar.effectiveDate.value
    const duration = calendar.duration.value

    if (effectiveDate && typeof duration === "number" && duration > 0) {
      const endDate = addYearsToDate(effectiveDate, duration)
      const sourceConfidence = minConfidence(
        calendar.effectiveDate.confidence,
        calendar.duration.confidence
      )

      calendar.endDate = {
        value: endDate,
        confidence: sourceConfidence,
        source: "calculé depuis effectiveDate + duration",
      }
    }
  }

  // Compute nextTriennialDate from effectiveDate
  if (
    !hasValue(calendar.nextTriennialDate) &&
    hasValue(calendar.effectiveDate)
  ) {
    const effectiveDate = calendar.effectiveDate.value

    if (effectiveDate) {
      const nextTriennial = computeNextTriennialDate(effectiveDate)

      if (nextTriennial) {
        calendar.nextTriennialDate = {
          value: nextTriennial,
          confidence: calendar.effectiveDate.confidence,
          source: "calculé depuis effectiveDate (échéance triennale)",
        }
      }
    }
  }

  return calendar
}

function computeRentFields(
  result: LeaseExtractionResult
): LeaseExtractionResult["rent"] {
  const rent = { ...result.rent }
  const surfaceArea = result.premises?.surfaceArea?.value
  const parkingSpaces = result.premises?.parkingSpaces?.value

  // Compute quarterlyRent from annualRent / 4
  if (
    !hasValue(rent.quarterlyRentExclTaxExclCharges) &&
    hasValue(rent.annualRentExclTaxExclCharges)
  ) {
    const annualRent = rent.annualRentExclTaxExclCharges.value

    if (typeof annualRent === "number" && annualRent > 0) {
      rent.quarterlyRentExclTaxExclCharges = {
        value: roundCurrency(annualRent / 4),
        confidence: rent.annualRentExclTaxExclCharges.confidence,
        source: "calculé depuis loyer annuel / 4",
      }
    }
  }

  // Compute annualRentPerSqm from annualRent / surfaceArea
  if (
    !hasValue(rent.annualRentPerSqmExclTaxExclCharges) &&
    hasValue(rent.annualRentExclTaxExclCharges) &&
    typeof surfaceArea === "number" &&
    surfaceArea > 0
  ) {
    const annualRent = rent.annualRentExclTaxExclCharges.value

    if (typeof annualRent === "number" && annualRent > 0) {
      const sourceConfidence = minConfidence(
        rent.annualRentExclTaxExclCharges.confidence,
        result.premises.surfaceArea.confidence
      )

      rent.annualRentPerSqmExclTaxExclCharges = {
        value: roundCurrency(annualRent / surfaceArea),
        confidence: sourceConfidence,
        source: "calculé depuis loyer annuel / surface",
      }
    }
  }

  // Compute quarterlyParkingRent from annualParkingRent / 4
  if (
    !hasValue(rent.quarterlyParkingRentExclCharges) &&
    hasValue(rent.annualParkingRentExclCharges)
  ) {
    const annualParking = rent.annualParkingRentExclCharges.value

    if (typeof annualParking === "number" && annualParking > 0) {
      rent.quarterlyParkingRentExclCharges = {
        value: roundCurrency(annualParking / 4),
        confidence: rent.annualParkingRentExclCharges.confidence,
        source: "calculé depuis loyer parking annuel / 4",
      }
    }
  }

  // Compute annualParkingRentPerUnit from annualParkingRent / parkingSpaces
  if (
    !hasValue(rent.annualParkingRentPerUnitExclCharges) &&
    hasValue(rent.annualParkingRentExclCharges) &&
    typeof parkingSpaces === "number" &&
    parkingSpaces > 0
  ) {
    const annualParking = rent.annualParkingRentExclCharges.value

    if (typeof annualParking === "number" && annualParking > 0) {
      const sourceConfidence = minConfidence(
        rent.annualParkingRentExclCharges.confidence,
        result.premises.parkingSpaces.confidence
      )

      rent.annualParkingRentPerUnitExclCharges = {
        value: roundCurrency(annualParking / parkingSpaces),
        confidence: sourceConfidence,
        source: "calculé depuis loyer parking / nombre de places",
      }
    }
  }

  return rent
}

function computeChargesFields(
  result: LeaseExtractionResult
): LeaseExtractionResult["charges"] {
  const charges = { ...result.charges }
  const surfaceArea = result.premises?.surfaceArea?.value

  // FIRST: Compute annualCharges from chargesPerSqm × surfaceArea (if only per-m² is given)
  if (
    !hasValue(charges.annualChargesProvisionExclTax) &&
    hasValue(charges.annualChargesProvisionPerSqmExclTax) &&
    typeof surfaceArea === "number" &&
    surfaceArea > 0
  ) {
    const chargesPerSqm = charges.annualChargesProvisionPerSqmExclTax.value

    if (typeof chargesPerSqm === "number" && chargesPerSqm > 0) {
      const sourceConfidence = minConfidence(
        charges.annualChargesProvisionPerSqmExclTax.confidence,
        result.premises.surfaceArea.confidence
      )

      charges.annualChargesProvisionExclTax = {
        value: roundCurrency(chargesPerSqm * surfaceArea),
        confidence: sourceConfidence,
        source: "calculé depuis charges/m² × surface",
      }
    }
  }

  // Compute quarterlyCharges from annualCharges / 4
  if (
    !hasValue(charges.quarterlyChargesProvisionExclTax) &&
    hasValue(charges.annualChargesProvisionExclTax)
  ) {
    const annualCharges = charges.annualChargesProvisionExclTax.value

    if (typeof annualCharges === "number" && annualCharges > 0) {
      charges.quarterlyChargesProvisionExclTax = {
        value: roundCurrency(annualCharges / 4),
        confidence: charges.annualChargesProvisionExclTax.confidence,
        source: "calculé depuis charges annuelles / 4",
      }
    }
  }

  // Compute annualChargesPerSqm from annualCharges / surfaceArea
  if (
    !hasValue(charges.annualChargesProvisionPerSqmExclTax) &&
    hasValue(charges.annualChargesProvisionExclTax) &&
    typeof surfaceArea === "number" &&
    surfaceArea > 0
  ) {
    const annualCharges = charges.annualChargesProvisionExclTax.value

    if (typeof annualCharges === "number" && annualCharges > 0) {
      const sourceConfidence = minConfidence(
        charges.annualChargesProvisionExclTax.confidence,
        result.premises.surfaceArea.confidence
      )

      charges.annualChargesProvisionPerSqmExclTax = {
        value: roundCurrency(annualCharges / surfaceArea),
        confidence: sourceConfidence,
        source: "calculé depuis charges annuelles / surface",
      }
    }
  }

  // FIRST: Compute annualRIEFee from RIEPerSqm × surfaceArea (if only per-m² is given)
  if (
    !hasValue(charges.annualRIEFeeExclTax) &&
    hasValue(charges.annualRIEFeePerSqmExclTax) &&
    typeof surfaceArea === "number" &&
    surfaceArea > 0
  ) {
    const riePerSqm = charges.annualRIEFeePerSqmExclTax.value

    if (typeof riePerSqm === "number" && riePerSqm > 0) {
      const sourceConfidence = minConfidence(
        charges.annualRIEFeePerSqmExclTax.confidence,
        result.premises.surfaceArea.confidence
      )

      charges.annualRIEFeeExclTax = {
        value: roundCurrency(riePerSqm * surfaceArea),
        confidence: sourceConfidence,
        source: "calculé depuis RIE/m² × surface",
      }
    }
  }

  // Compute quarterlyRIEFee from annualRIEFee / 4
  if (
    !hasValue(charges.quarterlyRIEFeeExclTax) &&
    hasValue(charges.annualRIEFeeExclTax)
  ) {
    const annualRIE = charges.annualRIEFeeExclTax.value

    if (typeof annualRIE === "number" && annualRIE > 0) {
      charges.quarterlyRIEFeeExclTax = {
        value: roundCurrency(annualRIE / 4),
        confidence: charges.annualRIEFeeExclTax.confidence,
        source: "calculé depuis redevance RIE annuelle / 4",
      }
    }
  }

  // Compute annualRIEFeePerSqm from annualRIEFee / surfaceArea
  if (
    !hasValue(charges.annualRIEFeePerSqmExclTax) &&
    hasValue(charges.annualRIEFeeExclTax) &&
    typeof surfaceArea === "number" &&
    surfaceArea > 0
  ) {
    const annualRIE = charges.annualRIEFeeExclTax.value

    if (typeof annualRIE === "number" && annualRIE > 0) {
      const sourceConfidence = minConfidence(
        charges.annualRIEFeeExclTax.confidence,
        result.premises.surfaceArea.confidence
      )

      charges.annualRIEFeePerSqmExclTax = {
        value: roundCurrency(annualRIE / surfaceArea),
        confidence: sourceConfidence,
        source: "calculé depuis redevance RIE / surface",
      }
    }
  }

  return charges
}

function computeSupportMeasuresFields(
  result: LeaseExtractionResult
): LeaseExtractionResult["supportMeasures"] {
  const support = { ...result.supportMeasures }

  // Compute rentFreePeriodAmount from months × monthly rent
  if (
    !hasValue(support.rentFreePeriodAmount) &&
    hasValue(support.rentFreePeriodMonths) &&
    hasValue(result.rent?.annualRentExclTaxExclCharges)
  ) {
    const months = support.rentFreePeriodMonths.value
    const annualRent = result.rent.annualRentExclTaxExclCharges.value

    if (
      typeof months === "number" &&
      months > 0 &&
      typeof annualRent === "number" &&
      annualRent > 0
    ) {
      const monthlyRent = annualRent / 12
      const sourceConfidence = minConfidence(
        support.rentFreePeriodMonths.confidence,
        result.rent.annualRentExclTaxExclCharges.confidence
      )

      support.rentFreePeriodAmount = {
        value: roundCurrency(months * monthlyRent),
        confidence: sourceConfidence,
        source: "calculé depuis mois de franchise × loyer mensuel",
      }
    }
  }

  return support
}

// --- Utility functions ---

function hasValue<T>(field: ExtractedValue<T> | undefined | null): boolean {
  if (!field) return false
  if (field.confidence === "missing") return false
  if (field.value === null || field.value === undefined) return false
  return true
}

function minConfidence(
  ...levels: (ConfidenceLevel | undefined)[]
): ConfidenceLevel {
  const order: ConfidenceLevel[] = ["missing", "low", "medium", "high"]
  let minIndex = order.length - 1

  for (const level of levels) {
    if (!level) continue
    const index = order.indexOf(level)
    if (index < minIndex) {
      minIndex = index
    }
  }

  return order[minIndex]
}

function addYearsToDate(isoDate: string, years: number): string {
  const date = new Date(isoDate)
  date.setUTCFullYear(date.getUTCFullYear() + years)
  return date.toISOString().split("T")[0]!
}

function computeNextTriennialDate(effectiveDateISO: string): string | null {
  const effectiveDate = new Date(effectiveDateISO)
  const now = new Date()

  // Find the next triennial date (every 3 years from effective date)
  let nextTriennial = new Date(effectiveDate)

  while (nextTriennial <= now) {
    nextTriennial.setUTCFullYear(nextTriennial.getUTCFullYear() + 3)
  }

  // If the next triennial is more than 9 years from effective date,
  // the lease might have ended or been renewed
  const yearsFromStart =
    (nextTriennial.getTime() - effectiveDate.getTime()) /
    (365.25 * 24 * 60 * 60 * 1000)

  if (yearsFromStart > 12) {
    return null
  }

  return nextTriennial.toISOString().split("T")[0]!
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
