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

  // Normalize regime field structure (LLM sometimes returns inconsistent format)
  processed.regime = normalizeRegimeField(processed.regime)

  // Normalize parties SIREN fields
  processed.parties = normalizePartiesSiren(processed.parties)

  // Normalize rent field structure (LLM sometimes returns nested format)
  processed.rent = normalizeRentField(processed.rent)

  // Normalize numeric values that may be returned as strings
  processed.rent = normalizeRentNumericValues(processed.rent)

  // Normalize payment frequency and calendar duration values
  processed.rent = normalizeRentPaymentFrequency(processed.rent)
  processed.calendar = normalizeCalendarDuration(processed.calendar)

  // Normalize indexation field structure
  processed.indexation = normalizeIndexationField(processed.indexation)

  // Normalize support measures field structure (LLM sometimes returns nested format)
  processed.supportMeasures = normalizeSupportMeasuresField(
    processed.supportMeasures
  )

  // Normalize premises boolean fields (null → false for spaces not explicitly mentioned)
  processed.premises = normalizePremisesBooleanFields(processed.premises)

  // Calendar computed fields
  processed.calendar = computeCalendarFields(processed)

  // Rent computed fields (needs premises.surfaceArea)
  processed.rent = computeRentFields(processed)

  // Charges computed fields (needs premises.surfaceArea)
  processed.charges = computeChargesFields(processed)

  // Taxes normalization / computed fields
  processed.taxes = computeTaxesFields(processed)

  // Support measures computed fields (needs rent)
  processed.supportMeasures = computeSupportMeasuresFields(processed)

  // Securities computed fields (needs rent)
  processed.securities = computeSecuritiesFields(processed)

  return processed
}

function computeTaxesFields(
  result: LeaseExtractionResult
): LeaseExtractionResult["taxes"] {
  const taxes = { ...result.taxes }

  taxes.propertyTaxAmount = annualizeIfPeriodic(taxes.propertyTaxAmount)
  taxes.teomAmount = annualizeIfPeriodic(taxes.teomAmount)
  taxes.officeTaxAmount = annualizeIfPeriodic(taxes.officeTaxAmount)
  taxes.parkingTaxAmount = annualizeIfPeriodic(taxes.parkingTaxAmount)

  return taxes
}

/**
 * Normalize regime field - LLM sometimes returns { value, confidence } instead of { regime: { value, confidence } }
 */
function normalizeRegimeField(
  regime: LeaseExtractionResult["regime"]
): LeaseExtractionResult["regime"] {
  if (!regime) {
    return {
      regime: {
        value: "unknown",
        confidence: "missing",
        source: "",
        rawText: "Non mentionné",
      },
    }
  }

  // Check if regime has the correct structure { regime: ExtractedValue }
  if (
    regime.regime &&
    typeof regime.regime === "object" &&
    "value" in regime.regime
  ) {
    return regime
  }

  // If regime has { value, confidence } directly, wrap it
  if ("value" in regime && "confidence" in regime) {
    return {
      regime: regime as unknown as LeaseExtractionResult["regime"]["regime"],
    }
  }

  return regime
}

/**
 * Normalize SIREN/SIRET/RCS - extract only digits and standardize
 */
function normalizePartiesSiren(
  parties: LeaseExtractionResult["parties"]
): LeaseExtractionResult["parties"] {
  if (!parties) return parties

  const normalizeSiren = (
    siren: ExtractedValue<string | null>
  ): ExtractedValue<string | null> => {
    if (!siren || !siren.value) return siren
    // Extract only digits from SIREN/SIRET/RCS
    const digitsOnly = siren.value.replace(/\D/g, "")
    if (digitsOnly.length >= 9) {
      return { ...siren, value: digitsOnly }
    }
    return siren
  }

  return {
    ...parties,
    landlord: {
      ...parties.landlord,
      siren: normalizeSiren(parties.landlord.siren),
    },
    landlordRepresentative: parties.landlordRepresentative
      ? {
          ...parties.landlordRepresentative,
          siren: normalizeSiren(parties.landlordRepresentative.siren),
        }
      : null,
    tenant: {
      ...parties.tenant,
      siren: normalizeSiren(parties.tenant.siren),
    },
  }
}

/**
 * Normalize rent field - LLM sometimes returns nested structures like
 * { "LOYER_PRINCIPAL_HT_HC": { annualRentExclTaxExclCharges: {...} } }
 * instead of flat { annualRentExclTaxExclCharges: {...} }
 */
function normalizeRentField(
  rent: LeaseExtractionResult["rent"]
): LeaseExtractionResult["rent"] {
  if (!rent) return rent

  // Expected flat keys
  const expectedKeys = [
    "annualRentExclTaxExclCharges",
    "quarterlyRentExclTaxExclCharges",
    "annualRentPerSqmExclTaxExclCharges",
    "annualParkingRentExclCharges",
    "quarterlyParkingRentExclCharges",
    "annualParkingRentPerUnitExclCharges",
    "isSubjectToVAT",
    "paymentFrequency",
    "latePaymentPenaltyConditions",
    "latePaymentPenaltyAmount",
  ]

  // Check if any expected key exists at top level
  const hasExpectedKeys = expectedKeys.some((key) => key in rent)

  if (hasExpectedKeys) {
    return rent
  }

  // Try to flatten nested structure
  const flattened: Record<string, unknown> = {}

  for (const [, value] of Object.entries(rent)) {
    if (value && typeof value === "object" && !("value" in value)) {
      // This is a nested section, extract its fields
      for (const [innerKey, innerValue] of Object.entries(
        value as Record<string, unknown>
      )) {
        if (expectedKeys.includes(innerKey)) {
          flattened[innerKey] = innerValue
        }
      }
    }
  }

  // Return flattened if we found any expected keys, otherwise return original
  if (Object.keys(flattened).length > 0) {
    return flattened as unknown as LeaseExtractionResult["rent"]
  }

  return rent
}

/**
 * Normalize numeric values that LLM may return as strings
 * Example: "79000" → 79000
 */
function normalizeRentNumericValues(
  rent: LeaseExtractionResult["rent"]
): LeaseExtractionResult["rent"] {
  if (!rent) return rent

  const numericFields = [
    "annualRentExclTaxExclCharges",
    "quarterlyRentExclTaxExclCharges",
    "annualRentPerSqmExclTaxExclCharges",
    "annualParkingRentExclCharges",
    "quarterlyParkingRentExclCharges",
    "annualParkingRentPerUnitExclCharges",
    "latePaymentPenaltyAmount",
  ] as const

  const normalized = { ...rent }

  for (const field of numericFields) {
    const fieldData = normalized[field]
    if (fieldData && typeof fieldData.value === "string") {
      const stringValue = fieldData.value as string
      const parsed = parseFloat(
        stringValue.replace(/[^\d.,]/g, "").replace(",", ".")
      )
      if (!isNaN(parsed)) {
        normalized[field] = {
          ...fieldData,
          value: parsed,
        }
      }
    }
  }

  return normalized
}

/**
 * Normalize payment frequency to standardized values
 * Also infers frequency from contextual signals if not explicitly extracted
 */
function normalizeRentPaymentFrequency(
  rent: LeaseExtractionResult["rent"]
): LeaseExtractionResult["rent"] {
  if (!rent) return rent

  const value = rent.paymentFrequency?.value
  const rawText = rent.paymentFrequency?.rawText?.toLowerCase() || ""
  const normalized = { ...rent.paymentFrequency }

  // First, try to normalize string values to standard format
  if (typeof value === "string") {
    const lowerValue = value.toLowerCase()

    if (lowerValue.includes("trimest") || lowerValue.includes("quarter")) {
      normalized.value = "quarterly"
    } else if (
      lowerValue.includes("mensuel") ||
      lowerValue.includes("month") ||
      lowerValue.includes("mois")
    ) {
      normalized.value = "monthly"
    } else {
      normalized.rawText = normalized.rawText || value
    }
  }

  // If still no valid frequency, infer from contextual signals
  if (normalized.value !== "monthly" && normalized.value !== "quarterly") {
    const inferred = inferPaymentFrequencyFromContext(rent, rawText)
    normalized.value = inferred
    normalized.confidence = "medium"
    normalized.source =
      "Inféré à partir du contexte (loyer trimestriel mentionné ou défaut)"
  }

  return { ...rent, paymentFrequency: normalized }
}

/**
 * Infer payment frequency from contextual signals when not explicitly extracted
 */
function inferPaymentFrequencyFromContext(
  rent: LeaseExtractionResult["rent"],
  rawText: string
): "monthly" | "quarterly" {
  // Check rawText for indicators
  const quarterlyIndicators = [
    "trimestriel",
    "trimestre",
    "terme",
    "par trimestre",
  ]
  const monthlyIndicators = ["mensuel", "mois", "par mois", "mensuellement"]

  if (quarterlyIndicators.some((ind) => rawText.includes(ind))) {
    return "quarterly"
  }
  if (monthlyIndicators.some((ind) => rawText.includes(ind))) {
    return "monthly"
  }

  // Check if quarterly rent was explicitly extracted (suggests quarterly payment)
  const quarterlyRent = rent?.quarterlyRentExclTaxExclCharges?.value
  if (typeof quarterlyRent === "number" && quarterlyRent > 0) {
    return "quarterly"
  }

  // Default: French commercial leases are typically quarterly
  return "quarterly"
}

/**
 * Extract numeric duration from text values
 */
function normalizeCalendarDuration(
  calendar: LeaseExtractionResult["calendar"]
): LeaseExtractionResult["calendar"] {
  if (!calendar?.duration?.value) return calendar

  const value = calendar.duration.value
  const normalized = { ...calendar.duration }

  // Handle case where LLM returns string instead of number
  if (
    typeof value === "string" ||
    (value !== null && typeof value !== "number")
  ) {
    const stringValue = String(value)
    const matches = stringValue.match(/\d+/g)
    if (matches && matches.length > 0) {
      const years = parseInt(matches[matches.length - 1], 10)
      if (years > 0) {
        normalized.value = years
        normalized.rawText = normalized.rawText || stringValue
      }
    }
  }

  return { ...calendar, duration: normalized }
}

/**
 * Normalize support measures field - LLM sometimes returns nested structures like
 * { "FRANCHISE_DE_LOYER": { hasRentFreeperiod: {...} }, "AUTRES_MESURES": {...} }
 * instead of flat { hasRentFreeperiod: {...}, hasOtherMeasures: {...} }
 */
function normalizeSupportMeasuresField(
  supportMeasures: LeaseExtractionResult["supportMeasures"]
): LeaseExtractionResult["supportMeasures"] {
  if (!supportMeasures) return supportMeasures

  // Expected flat keys
  const expectedKeys = [
    "hasRentFreeperiod",
    "rentFreePeriodDescription",
    "rentFreePeriodMonths",
    "rentFreePeriodAmount",
    "hasOtherMeasures",
    "otherMeasuresDescription",
  ]

  // Check if any expected key exists at top level
  const hasExpectedKeys = expectedKeys.some((key) => key in supportMeasures)

  if (hasExpectedKeys) {
    return supportMeasures
  }

  // Try to flatten nested structure
  const flattened: Record<string, unknown> = {}

  for (const [, value] of Object.entries(supportMeasures)) {
    if (value && typeof value === "object" && !("value" in value)) {
      // This is a nested section, extract its fields
      for (const [innerKey, innerValue] of Object.entries(
        value as Record<string, unknown>
      )) {
        if (expectedKeys.includes(innerKey)) {
          flattened[innerKey] = innerValue
        }
      }
    }
  }

  // Return flattened if we found any expected keys, otherwise return original
  if (Object.keys(flattened).length > 0) {
    return flattened as unknown as LeaseExtractionResult["supportMeasures"]
  }

  return supportMeasures
}

/**
 * Normalize premises boolean fields
 * NOTE: We do NOT convert null to false for hasOutdoorSpace/hasArchiveSpace/hasFurniture
 * because "not mentioned" should remain "Non mentionné" in the output, not "Non"
 * However, we DO convert string "Non" to null (LLM sometimes returns "Non" instead of null)
 */
function normalizePremisesBooleanFields(
  premises: LeaseExtractionResult["premises"]
): LeaseExtractionResult["premises"] {
  if (!premises) return premises

  const normalized = { ...premises }

  // hasFurniture: "Non" (string) → null (should be null if not mentioned)
  if (
    normalized.hasFurniture &&
    typeof normalized.hasFurniture.value === "string" &&
    (normalized.hasFurniture.value === "Non" ||
      normalized.hasFurniture.value === "non")
  ) {
    normalized.hasFurniture = {
      value: null,
      confidence: "missing",
      source: normalized.hasFurniture.source || "Document entier",
      rawText: "Non mentionné",
    }
  }

  // hasOutdoorSpace: "Non" (string) → null (should be null if not mentioned)
  if (
    normalized.hasOutdoorSpace &&
    typeof normalized.hasOutdoorSpace.value === "string" &&
    (normalized.hasOutdoorSpace.value === "Non" ||
      normalized.hasOutdoorSpace.value === "non")
  ) {
    normalized.hasOutdoorSpace = {
      value: null,
      confidence: "missing",
      source: normalized.hasOutdoorSpace.source || "Document entier",
      rawText: "Non mentionné",
    }
  }

  return normalized
}

/**
 * Normalize indexation field - similar to rent, LLM returns nested structures
 */
function normalizeIndexationField(
  indexation: LeaseExtractionResult["indexation"]
): LeaseExtractionResult["indexation"] {
  if (!indexation) return indexation

  const expectedKeys = [
    "indexationClause",
    "hasIndexationClause",
    "indexationType",
    "referenceQuarter",
    "firstIndexationDate",
    "indexationFrequency",
  ]

  const hasExpectedKeys = expectedKeys.some((key) => key in indexation)

  if (hasExpectedKeys) {
    return indexation
  }

  const flattened: Record<string, unknown> = {}

  for (const [, value] of Object.entries(indexation)) {
    if (value && typeof value === "object" && !("value" in value)) {
      for (const [innerKey, innerValue] of Object.entries(
        value as Record<string, unknown>
      )) {
        if (expectedKeys.includes(innerKey)) {
          flattened[innerKey] = innerValue
        }
      }
    }
  }

  if (Object.keys(flattened).length > 0) {
    return flattened as unknown as LeaseExtractionResult["indexation"]
  }

  return indexation
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
        source: "Calculé à partir de la date d'effet et de la durée du bail",
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
          source:
            "Calculé : prochaine échéance triennale à partir de la date d'effet",
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
        source: "Calculé à partir du loyer annuel (÷ 4)",
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
        source: "Calculé à partir du loyer annuel et de la surface",
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
        source: "Calculé à partir du loyer parking annuel (÷ 4)",
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
        source: "Calculé à partir du loyer parking et du nombre de places",
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
        source: "Calculé à partir des charges au m² et de la surface",
      }
    }
  }

  // SECOND: Compute annualCharges from quarterlyCharges × 4 (if only quarterly is given)
  if (
    !hasValue(charges.annualChargesProvisionExclTax) &&
    hasValue(charges.quarterlyChargesProvisionExclTax)
  ) {
    const quarterlyCharges = charges.quarterlyChargesProvisionExclTax.value

    if (typeof quarterlyCharges === "number" && quarterlyCharges > 0) {
      charges.annualChargesProvisionExclTax = {
        value: roundCurrency(quarterlyCharges * 4),
        confidence: charges.quarterlyChargesProvisionExclTax.confidence,
        source: "Calculé à partir des charges trimestrielles (× 4)",
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
        source: "Calculé à partir des charges annuelles (÷ 4)",
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
        source: "Calculé à partir des charges annuelles et de la surface",
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
        source: "Calculé à partir de la redevance RIE au m² et de la surface",
      }
    }
  }

  // Compute annualRIEFee from quarterlyRIEFee × 4 (if only quarterly is given)
  if (
    !hasValue(charges.annualRIEFeeExclTax) &&
    hasValue(charges.quarterlyRIEFeeExclTax)
  ) {
    const quarterlyRIE = charges.quarterlyRIEFeeExclTax.value

    if (typeof quarterlyRIE === "number" && quarterlyRIE > 0) {
      charges.annualRIEFeeExclTax = {
        value: roundCurrency(quarterlyRIE * 4),
        confidence: charges.quarterlyRIEFeeExclTax.confidence,
        source: "Calculé à partir de la redevance RIE trimestrielle (× 4)",
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
        source: "Calculé à partir de la redevance RIE annuelle (÷ 4)",
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
        source:
          "Calculé à partir de la redevance RIE annuelle et de la surface",
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
        source: "Calculé à partir de la durée de franchise et du loyer mensuel",
      }
    }
  }

  return support
}

function computeSecuritiesFields(
  result: LeaseExtractionResult
): LeaseExtractionResult["securities"] {
  const securities = { ...result.securities }

  // Compute securityDepositAmount from description if it mentions months + annual rent
  if (
    !hasValue(securities.securityDepositAmount) &&
    hasValue(result.rent?.annualRentExclTaxExclCharges)
  ) {
    const annualRent = result.rent.annualRentExclTaxExclCharges.value

    if (typeof annualRent === "number" && annualRent > 0) {
      // Try to extract number of months from description
      const description = securities.securityDepositDescription?.value
      if (typeof description === "string") {
        // Match patterns like "3 mois", "trois (3) mois", "trois mois"
        const monthsMatch = description.match(
          /(\d+)\s*mois|trois\s*(?:\(\d+\))?\s*mois|deux\s*(?:\(\d+\))?\s*mois/i
        )

        let months: number | null = null
        if (monthsMatch) {
          if (monthsMatch[1]) {
            months = parseInt(monthsMatch[1], 10)
          } else if (description.toLowerCase().includes("trois")) {
            months = 3
          } else if (description.toLowerCase().includes("deux")) {
            months = 2
          }
        }

        if (months && months > 0) {
          const monthlyRent = annualRent / 12
          const sourceConfidence = minConfidence(
            securities.securityDepositDescription?.confidence,
            result.rent.annualRentExclTaxExclCharges.confidence
          )

          securities.securityDepositAmount = {
            value: roundCurrency(months * monthlyRent),
            confidence: sourceConfidence,
            source: `Calculé à partir du dépôt de garantie (${months} mois de loyer)`,
          }
        }
      }
    }
  }

  return securities
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

/**
 * Add years to a date and return J-1 (the day before the anniversary)
 * Example: 2016-12-19 + 9 years = 2025-12-18 (not 2025-12-19)
 * This follows French lease convention where the end date is the day before the anniversary
 */
function addYearsToDate(isoDate: string, years: number): string {
  const date = new Date(isoDate)
  date.setUTCFullYear(date.getUTCFullYear() + years)
  // J-1: subtract one day to get the day before the anniversary
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().split("T")[0]!
}

/**
 * Compute next triennial date from effective date, returning J-1
 * Example: effective 2025-10-10 → first triennial 2028-10-09 (J-1 of 3rd anniversary)
 * This follows French lease convention where triennial dates are the day before the anniversary
 */
function computeNextTriennialDate(effectiveDateISO: string): string | null {
  const effectiveDate = new Date(effectiveDateISO)
  const now = new Date()

  // Find the next triennial date (every 3 years from effective date)
  let nextTriennial = new Date(effectiveDate)

  while (nextTriennial <= now) {
    nextTriennial.setUTCFullYear(nextTriennial.getUTCFullYear() + 3)
  }

  // If the next triennial is more than 12 years from effective date,
  // the lease might have ended or been renewed
  const yearsFromStart =
    (nextTriennial.getTime() - effectiveDate.getTime()) /
    (365.25 * 24 * 60 * 60 * 1000)

  if (yearsFromStart > 12) {
    return null
  }

  // J-1: subtract one day to get the day before the anniversary
  nextTriennial.setUTCDate(nextTriennial.getUTCDate() - 1)

  return nextTriennial.toISOString().split("T")[0]!
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

type AmountPeriod = "year" | "quarter" | "month" | null

function annualizeIfPeriodic(
  field: ExtractedValue<number | null>
): ExtractedValue<number | null> {
  if (!hasValue(field)) return field
  const value = field.value
  if (typeof value !== "number" || value <= 0) return field

  const period = detectAmountPeriod(field.rawText)
  const factor = period === "quarter" ? 4 : period === "month" ? 12 : 1
  if (factor === 1) return field

  const parsed = parseMoneyFromRawText(field.rawText)
  if (typeof parsed === "number") {
    // Guardrail: avoid double-annualising if the model already returned an annual value.
    if (isClose(value, parsed * factor, 0.02)) {
      return field
    }
    // Prefer annualising only when the extracted value matches the amount in rawText.
    if (!isClose(value, parsed, 0.02)) {
      return field
    }
  }

  return {
    ...field,
    value: roundCurrency(value * factor),
    source: field.source
      ? `${field.source} (annualisé ×${factor})`
      : `Annualisé (×${factor})`,
  }
}

function detectAmountPeriod(rawText: string | undefined): AmountPeriod {
  if (!rawText?.trim()) return null
  const text = rawText.toLowerCase()

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

function parseMoneyFromRawText(rawText: string | undefined): number | null {
  if (!rawText?.trim()) return null

  // Prefer numbers explicitly followed by € / EUR / euros
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

function isClose(a: number, b: number, epsilon: number): boolean {
  return Math.abs(a - b) <= epsilon
}
