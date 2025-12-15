import { jsPDF } from "jspdf"
import type {
  LeaseExtractionResult,
  ExtractedValue,
} from "@/app/lib/extraction/types"
import type { RentCalculationResult } from "@/app/lib/extraction/rent-calculation-service"
import type {
  YearlyTotalSummary,
  RentSchedulePeriod,
} from "@/app/lib/lease/types"

/**
 * PDF export for lease extraction results
 * Creates a well-designed PDF document matching the Excel export structure
 */

const NON_MENTIONNE = "Non mentionne"
const BRAND_COLOR: [number, number, number] = [3, 58, 23] // #033a17 - brand-green
const SECTION_COLOR: [number, number, number] = [246, 241, 231] // #f6f1e7 - brand-cream
const TEXT_COLOR: [number, number, number] = [17, 24, 39] // gray-900
const TEXT_SECONDARY: [number, number, number] = [107, 114, 128] // gray-500
const BORDER_COLOR: [number, number, number] = [229, 231, 235] // gray-200

function cleanTextForPDF(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/œ/g, "oe")
    .replace(/Œ/g, "OE")
    .replace(/æ/g, "ae")
    .replace(/Æ/g, "AE")
    .replace(/[^\x00-\x7F]/g, "")
}

function getValue<T>(field: ExtractedValue<T> | undefined | null): T | null {
  if (!field) return null
  if (field.confidence === "missing") return null
  return field.value
}

function getSource<T>(field: ExtractedValue<T> | undefined | null): string {
  if (!field) return ""
  return field.source || ""
}

function getSources(
  ...fields: (ExtractedValue<unknown> | undefined | null)[]
): string {
  const sources = fields
    .map((f) => getSource(f))
    .filter((s) => s && s !== "Document entier")
  return sources.length > 0 ? [...new Set(sources)].join(" ; ") : ""
}

function fmt(value: unknown, defaultValue: string = NON_MENTIONNE): string {
  if (value === null || value === undefined) return defaultValue
  if (typeof value === "boolean") return value ? "Oui" : "Non"
  if (typeof value === "number") return cleanTextForPDF(String(value))
  if (Array.isArray(value))
    return value.length > 0 ? cleanTextForPDF(value.join(", ")) : defaultValue
  if (typeof value === "object" && "value" in value) {
    return fmt((value as { value: unknown }).value, defaultValue)
  }
  if (typeof value === "object") return defaultValue
  return cleanTextForPDF(String(value))
}

function formatDate(
  isoDate: string | null | undefined,
  defaultValue: string = NON_MENTIONNE
): string {
  if (!isoDate) return defaultValue
  try {
    const date = new Date(isoDate)
    if (isNaN(date.getTime())) return defaultValue
    const formatted = date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
    return cleanTextForPDF(formatted)
  } catch {
    return cleanTextForPDF(String(isoDate))
  }
}

function formatCurrency(
  value: number | string | null | undefined,
  defaultValue: string = NON_MENTIONNE
): string {
  if (value === null || value === undefined) return defaultValue
  if (typeof value === "string") {
    if (value.toLowerCase().includes("inclus")) return cleanTextForPDF(value)
    const numValue = parseFloat(value.replace(/\s/g, "").replace(",", "."))
    if (!isNaN(numValue))
      return cleanTextForPDF(`${numValue.toLocaleString("fr-FR")} €`)
    return cleanTextForPDF(value)
  }
  return cleanTextForPDF(`${value.toLocaleString("fr-FR")} €`)
}

function formatSurface(
  value: number | null | undefined,
  defaultValue: string = NON_MENTIONNE
): string {
  if (value === null || value === undefined) return defaultValue
  return cleanTextForPDF(`${value.toLocaleString("fr-FR")} m2`)
}

function formatContact(
  email: string | null | undefined,
  phone: string | null | undefined
): string {
  const parts: string[] = []
  if (email !== null && email !== undefined) {
    const formattedEmail = fmt(email, "")
    if (formattedEmail) {
      parts.push(formattedEmail)
    }
  }
  if (phone !== null && phone !== undefined) {
    const formattedPhone = fmt(phone, "")
    if (formattedPhone) {
      parts.push(formattedPhone)
    }
  }
  return parts.length > 0 ? parts.join(" / ") : NON_MENTIONNE
}

interface PDFSection {
  title: string
  rows: Array<{
    label: string
    value: string
    source?: string
  }>
}

function buildSections(extraction: LeaseExtractionResult): PDFSection[] {
  const p = extraction.parties
  const pr = extraction.premises
  const c = extraction.calendar
  const sm = extraction.supportMeasures
  const r = extraction.rent
  const idx = extraction.indexation
  const tx = extraction.taxes
  const ch = extraction.charges
  const ins = extraction.insurance
  const sec = extraction.securities
  const inv = extraction.inventory
  const maint = extraction.maintenance
  const rest = extraction.restitution
  const trans = extraction.transfer
  const env = extraction.environmentalAnnexes
  const ann = extraction.otherAnnexes
  const other = extraction.other

  const sections: PDFSection[] = []

  // 1. Régime du Bail
  sections.push({
    title: "1. Régime du Bail",
    rows: [
      {
        label: "Régime juridique",
        value: fmt(getValue(extraction.regime?.regime)),
        source: getSource(extraction.regime?.regime),
      },
    ],
  })

  // 2. Parties
  const landlordContact = formatContact(
    getValue(p?.landlord?.email),
    getValue(p?.landlord?.phone)
  )
  const landlordRepresentative = p?.landlordRepresentative
  const tenantContact = formatContact(
    getValue(p?.tenant?.email),
    getValue(p?.tenant?.phone)
  )

  sections.push({
    title: "2. Parties",
    rows: [
      {
        label: "Bailleur",
        value: [
          `Nom : ${fmt(getValue(p?.landlord?.name))}`,
          `SIREN : ${fmt(getValue(p?.landlord?.siren))}`,
          `Courriel et téléphone : ${landlordContact}`,
          `Adresse : ${fmt(getValue(p?.landlord?.address))}`,
        ].join("\n"),
        source: getSources(
          p?.landlord?.name,
          p?.landlord?.siren,
          p?.landlord?.email,
          p?.landlord?.phone,
          p?.landlord?.address
        ),
      },
      {
        label: "Représentant du bailleur (le cas échéant)",
        value: landlordRepresentative
          ? [
              `Nom : ${fmt(getValue(landlordRepresentative?.name))}`,
              `SIREN : ${fmt(getValue(landlordRepresentative?.siren))}`,
              `Courriel et téléphone : ${formatContact(
                getValue(landlordRepresentative?.email),
                getValue(landlordRepresentative?.phone)
              )}`,
              `Adresse : ${fmt(getValue(landlordRepresentative?.address))}`,
            ].join("\n")
          : [
              `Nom : ${NON_MENTIONNE}`,
              `SIREN : ${NON_MENTIONNE}`,
              `Courriel et téléphone : ${NON_MENTIONNE}`,
              `Adresse : ${NON_MENTIONNE}`,
            ].join("\n"),
        source: landlordRepresentative
          ? getSources(
              landlordRepresentative?.name,
              landlordRepresentative?.siren,
              landlordRepresentative?.email,
              landlordRepresentative?.address
            )
          : "",
      },
      {
        label: "Preneur",
        value: [
          `Nom : ${fmt(getValue(p?.tenant?.name))}`,
          `SIREN : ${fmt(getValue(p?.tenant?.siren))}`,
          `Courriel et téléphone : ${tenantContact}`,
          `Adresse : ${fmt(getValue(p?.tenant?.address))}`,
        ].join("\n"),
        source: getSources(
          p?.tenant?.name,
          p?.tenant?.siren,
          p?.tenant?.email,
          p?.tenant?.phone,
          p?.tenant?.address
        ),
      },
    ],
  })

  // 3. Description des locaux loués
  const isPartitioned = getValue(pr?.isPartitioned)
  const isPartitionedDisplay =
    isPartitioned === null ? NON_MENTIONNE : isPartitioned ? "Oui" : "Non"

  const hasFurniture = getValue(pr?.hasFurniture)
  const furnitureDescription = fmt(getValue(pr?.furnishingConditions))
  const hasFurnitureDisplay =
    hasFurniture === null
      ? NON_MENTIONNE
      : hasFurniture
        ? furnitureDescription !== NON_MENTIONNE
          ? `Oui. ${furnitureDescription}`
          : "Oui"
        : "Non"

  const hasOutdoorSpace = getValue(pr?.hasOutdoorSpace)
  const outdoorDisplay =
    hasOutdoorSpace === null ? NON_MENTIONNE : hasOutdoorSpace ? "Oui" : "Non"

  const hasArchiveSpace = getValue(pr?.hasArchiveSpace)
  const archiveDisplay =
    hasArchiveSpace === null ? NON_MENTIONNE : hasArchiveSpace ? "Oui" : "Non"

  sections.push({
    title: "3. Description des locaux loués",
    rows: [
      {
        label: "Designation des locaux",
        value: fmt(getValue(pr?.designation)),
        source: getSource(pr?.designation),
      },
      {
        label: "Destination des locaux",
        value: fmt(getValue(pr?.purpose)),
        source: getSource(pr?.purpose),
      },
      {
        label: "Adresse des locaux",
        value: fmt(getValue(pr?.address)),
        source: getSource(pr?.address),
      },
      {
        label: "Année de construction de l'immeuble",
        value: fmt(getValue(pr?.buildingYear)),
        source: getSource(pr?.buildingYear),
      },
      {
        label: "Etage(s) des locaux",
        value: Array.isArray(getValue(pr?.floors))
          ? (getValue(pr?.floors) as string[]).join(", ")
          : fmt(getValue(pr?.floors)),
        source: getSource(pr?.floors),
      },
      {
        label: "Numéro(s) du/des lot(s)",
        value: Array.isArray(getValue(pr?.lotNumbers))
          ? (getValue(pr?.lotNumbers) as string[]).join(", ")
          : fmt(getValue(pr?.lotNumbers)),
        source: getSource(pr?.lotNumbers),
      },
      {
        label: "Surface (en m²)",
        value: formatSurface(getValue(pr?.surfaceArea) as number | null),
        source: getSource(pr?.surfaceArea),
      },
      {
        label: "Les locaux sont-ils cloisonnés ?",
        value: isPartitionedDisplay,
        source: getSource(pr?.isPartitioned),
      },
      {
        label: "Les locaux sont-ils équipés avec du mobilier ?",
        value: hasFurnitureDisplay,
        source: getSource(pr?.hasFurniture),
      },
      {
        label: "Clause de garnissement des locaux",
        value: fmt(getValue(pr?.furnishingConditions)),
        source: getSource(pr?.furnishingConditions),
      },
      {
        label: "Clause d'enseigne",
        value: fmt(getValue(pr?.signageConditions)),
        source: getSource(pr?.signageConditions),
      },
      {
        label: "Existence d'un espace extérieur ?",
        value: outdoorDisplay,
        source: getSource(pr?.hasOutdoorSpace),
      },
      {
        label: "Existence d'un local d'archive ?",
        value: archiveDisplay,
        source: getSource(pr?.hasArchiveSpace),
      },
      {
        label: "Nombre d'emplacements de parkings (en unité)",
        value: getValue(pr?.parkingSpaces)
          ? `${getValue(pr?.parkingSpaces)} u`
          : NON_MENTIONNE,
        source: getSource(pr?.parkingSpaces),
      },
      {
        label: "Quote-part de l'immeuble loué",
        value: [
          `Incluant les parties communes : ${fmt(getValue(pr?.shareWithCommonAreas))}`,
          `Hors parties communes : ${fmt(getValue(pr?.shareWithoutCommonAreas))}`,
        ].join("\n"),
        source: getSources(
          pr?.shareWithCommonAreas,
          pr?.shareWithoutCommonAreas
        ),
      },
    ],
  })

  // 4. Calendrier
  const durationValue = getValue(c?.duration)
  const durationDisplay =
    durationValue === null || durationValue === undefined
      ? NON_MENTIONNE
      : typeof durationValue === "number"
        ? `${durationValue} ans`
        : String(durationValue).includes("ans")
          ? String(durationValue)
          : `${durationValue} ans`

  sections.push({
    title: "4. Calendrier",
    rows: [
      {
        label: "Date de signature du bail",
        value: formatDate(getValue(c?.signatureDate) as string | null),
        source: getSource(c?.signatureDate),
      },
      {
        label: "Durée du bail",
        value: durationDisplay,
        source: getSource(c?.duration),
      },
      {
        label: "Date de prise d'effet",
        value: formatDate(getValue(c?.effectiveDate) as string | null),
        source: getSource(c?.effectiveDate),
      },
      {
        label: "Mise à disposition anticipée",
        value: getValue(c?.earlyAccessDate)
          ? formatDate(getValue(c?.earlyAccessDate) as string)
          : NON_MENTIONNE,
        source: getSource(c?.earlyAccessDate),
      },
      {
        label: "Prochaine(s) faculté(s) de résiliation/congé",
        value: formatDate(getValue(c?.nextTriennialDate) as string | null),
        source: getSource(c?.nextTriennialDate),
      },
      {
        label: "Date de fin de bail",
        value: formatDate(getValue(c?.endDate) as string | null),
        source: getSource(c?.endDate),
      },
      {
        label: "Durée de préavis",
        value: fmt(getValue(c?.noticePeriod)),
        source: getSource(c?.noticePeriod),
      },
      {
        label: "Conditions pour donner congé",
        value: fmt(getValue(c?.terminationConditions)),
        source: getSource(c?.terminationConditions),
      },
      {
        label: "Conditions de renouvellement à l'échéance du bail",
        value: fmt(getValue(c?.renewalConditions)),
        source: getSource(c?.renewalConditions),
      },
    ],
  })

  // 5. Mesures d'accompagnement
  const hasRentFreePeriod = getValue(sm?.hasRentFreeperiod)
  const rentFreeMonths = getValue(sm?.rentFreePeriodMonths)
  const rentFreeAmount = getValue(sm?.rentFreePeriodAmount)
  const rentFreeParts: string[] = []
  if (rentFreeMonths !== null && rentFreeMonths !== undefined) {
    rentFreeParts.push(`${rentFreeMonths} mois`)
  }
  if (rentFreeAmount !== null && rentFreeAmount !== undefined) {
    rentFreeParts.push(`soit ${formatCurrency(rentFreeAmount)} HTHC`)
  }
  const rentFreeDescription =
    rentFreeParts.length > 0 ? `Oui. ${rentFreeParts.join(", ")}` : "Oui"
  const rentFreeDisplay =
    hasRentFreePeriod === true
      ? rentFreeDescription
      : hasRentFreePeriod === false
        ? "Non"
        : NON_MENTIONNE

  const hasOtherMeasures = getValue(sm?.hasOtherMeasures)
  const otherMeasuresDescription = fmt(getValue(sm?.otherMeasuresDescription))
  const otherMeasuresDisplay =
    hasOtherMeasures === true
      ? otherMeasuresDescription !== NON_MENTIONNE
        ? `Oui. ${otherMeasuresDescription}`
        : "Oui"
      : hasOtherMeasures === false
        ? "Non"
        : NON_MENTIONNE

  sections.push({
    title: "5. Mesures d'accompagnement",
    rows: [
      {
        label: "Franchise de loyer",
        value: rentFreeDisplay,
        source: getSources(
          sm?.hasRentFreeperiod,
          sm?.rentFreePeriodMonths,
          sm?.rentFreePeriodAmount
        ),
      },
      {
        label: "Autres mesures d'accompagnement",
        value: otherMeasuresDisplay,
        source: getSources(sm?.hasOtherMeasures, sm?.otherMeasuresDescription),
      },
    ],
  })

  // 6. Loyer
  const isSubjectToVAT = getValue(r?.isSubjectToVAT)
  const vatDisplay =
    isSubjectToVAT === null ? NON_MENTIONNE : isSubjectToVAT ? "Oui" : "Non"

  const paymentFrequencyDisplay =
    getValue(r?.paymentFrequency) === "monthly"
      ? "Mensuel"
      : getValue(r?.paymentFrequency) === "quarterly"
        ? "Trimestriel"
        : getValue(r?.paymentFrequency) === "annual"
          ? "Annuel"
          : fmt(getValue(r?.paymentFrequency))

  sections.push({
    title: "6. Loyer",
    rows: [
      {
        label: "Montant du loyer initial annuel (en € et HTHC)",
        value: formatCurrency(
          getValue(r?.annualRentExclTaxExclCharges) as number | null
        ),
        source: getSource(r?.annualRentExclTaxExclCharges),
      },
      {
        label: "Montant du loyer initial trimestriel (en € et HTHC)",
        value: formatCurrency(
          getValue(r?.quarterlyRentExclTaxExclCharges) as number | null
        ),
        source: getSource(r?.quarterlyRentExclTaxExclCharges),
      },
      {
        label: "Montant du loyer annuel initial au m² (en € et HTHC)",
        value: formatCurrency(
          getValue(r?.annualRentPerSqmExclTaxExclCharges) as number | null
        ),
        source: getSource(r?.annualRentPerSqmExclTaxExclCharges),
      },
      {
        label:
          "Montant du loyer initial annuel des emplacements de parking (en € et HTHC)",
        value: formatCurrency(
          getValue(r?.annualParkingRentExclCharges) as number | null
        ),
        source: getSource(r?.annualParkingRentExclCharges),
      },
      {
        label:
          "Montant du loyer initial trimestriel des emplacements de parking (en € et HTHC)",
        value: formatCurrency(
          getValue(r?.quarterlyParkingRentExclCharges) as number | null
        ),
        source: getSource(r?.quarterlyParkingRentExclCharges),
      },
      {
        label:
          "Montant du loyer annuel initial des emplacements de parkings par unité (en € et HTHC)",
        value: formatCurrency(
          getValue(r?.annualParkingRentPerUnitExclCharges) as number | null
        ),
        source: getSource(r?.annualParkingRentPerUnitExclCharges),
      },
      {
        label: "Soumission du loyer à la TVA",
        value: vatDisplay,
        source: getSource(r?.isSubjectToVAT),
      },
      {
        label: "Périodicité de facturation du loyer",
        value: paymentFrequencyDisplay,
        source: getSource(r?.paymentFrequency),
      },
      {
        label:
          "Montant et conditions d'application de pénalités pour retard de paiement des loyers",
        value:
          [
            fmt(getValue(r?.latePaymentPenaltyAmount))
              ? formatCurrency(getValue(r?.latePaymentPenaltyAmount) as number)
              : "",
            fmt(getValue(r?.latePaymentPenaltyConditions)),
          ]
            .filter(Boolean)
            .join(". ") || NON_MENTIONNE,
        source: getSources(
          r?.latePaymentPenaltyConditions,
          r?.latePaymentPenaltyAmount
        ),
      },
    ],
  })

  // 7. Indexation
  const hasIndexation =
    getValue(idx?.hasIndexationClause) ?? getValue(idx?.indexationClause)
  const indexationDisplay =
    hasIndexation === true || hasIndexation === "Oui"
      ? "Oui"
      : hasIndexation === false || hasIndexation === "Non"
        ? "Non"
        : getValue(idx?.indexationType)
          ? "Oui"
          : NON_MENTIONNE

  const firstIndexDate = getValue(idx?.firstIndexationDate)
  const firstIndexDateDisplay =
    firstIndexDate === null || firstIndexDate === undefined
      ? NON_MENTIONNE
      : /^\d{4}-\d{2}-\d{2}/.test(String(firstIndexDate))
        ? formatDate(String(firstIndexDate))
        : String(firstIndexDate)

  const indexationFrequencyDisplay =
    getValue(idx?.indexationFrequency) === "annual"
      ? "Annuellement"
      : getValue(idx?.indexationFrequency) === "quarterly"
        ? "Trimestriellement"
        : fmt(getValue(idx?.indexationFrequency))

  sections.push({
    title: "7. Indexation",
    rows: [
      {
        label: "Clause d'indexation",
        value: indexationDisplay,
        source:
          getSource(idx?.hasIndexationClause) ||
          getSource(idx?.indexationClause),
      },
      {
        label: "Choix de l'indice d'indexation",
        value: fmt(getValue(idx?.indexationType)),
        source: getSource(idx?.indexationType),
      },
      {
        label: "Trimestre de référence de l'indice",
        value: fmt(getValue(idx?.referenceQuarter)),
        source: getSource(idx?.referenceQuarter),
      },
      {
        label: "Date de l'indexation",
        value: firstIndexDateDisplay,
        source: getSource(idx?.firstIndexationDate),
      },
      {
        label: "Périodicité de l'indexation",
        value: indexationFrequencyDisplay,
        source: getSource(idx?.indexationFrequency),
      },
    ],
  })

  // 8. Impôts et taxes
  const propertyTaxRebilled = getValue(tx?.propertyTaxRebilled)
  const propertyTaxRebilledDisplay =
    propertyTaxRebilled === null
      ? NON_MENTIONNE
      : propertyTaxRebilled
        ? "Oui"
        : "Non"

  sections.push({
    title: "8. Impôts et taxes",
    rows: [
      {
        label: "Refacturation de la taxe foncière et de la TEOM au preneur",
        value: propertyTaxRebilledDisplay,
        source: getSource(tx?.propertyTaxRebilled),
      },
      {
        label: "Montant annuel de la provision pour taxe foncière (en €)",
        value: formatCurrency(getValue(tx?.propertyTaxAmount) as number | null),
        source: getSource(tx?.propertyTaxAmount),
      },
      {
        label: "Montant annuel de la provision pour TEOM (en €)",
        value: formatCurrency(getValue(tx?.teomAmount) as number | null),
        source: getSource(tx?.teomAmount),
      },
      {
        label:
          "Montant annuel de la provision pour taxe sur les bureaux et les locaux commerciaux et de stockages (en €)",
        value: formatCurrency(getValue(tx?.officeTaxAmount) as number | null),
        source: getSource(tx?.officeTaxAmount),
      },
      {
        label:
          "Montant annuel de la provision pour taxe sur les emplacements de parking (en €)",
        value: formatCurrency(getValue(tx?.parkingTaxAmount) as number | null),
        source: getSource(tx?.parkingTaxAmount),
      },
    ],
  })

  // 9. Charges et honoraires
  const managementFees = getValue(ch?.managementFeesOnTenant)
  const managementFeesDisplay =
    managementFees === null ? NON_MENTIONNE : managementFees ? "Oui" : "Non"

  sections.push({
    title: "9. Charges locatives et honoraires",
    rows: [
      {
        label: "Montant annuel des provisions pour charges (en € et HT)",
        value: formatCurrency(
          getValue(ch?.annualChargesProvisionExclTax) as number | null
        ),
        source: getSource(ch?.annualChargesProvisionExclTax),
      },
      {
        label: "Montant trimestriel des provisions pour charges (en € et HT)",
        value: formatCurrency(
          getValue(ch?.quarterlyChargesProvisionExclTax) as number | null
        ),
        source: getSource(ch?.quarterlyChargesProvisionExclTax),
      },
      {
        label: "Montant annuel des provisions pour charges au m² (en € et HT)",
        value: formatCurrency(
          getValue(ch?.annualChargesProvisionPerSqmExclTax) as number | null
        ),
        source: getSource(ch?.annualChargesProvisionPerSqmExclTax),
      },
      {
        label: "Montant annuel de la redevance RIE (en € et HT)",
        value: formatCurrency(
          getValue(ch?.annualRIEFeeExclTax) as number | null
        ),
        source: getSource(ch?.annualRIEFeeExclTax),
      },
      {
        label: "Montant trimestriel de la redevance RIE (en € et HT)",
        value: formatCurrency(
          getValue(ch?.quarterlyRIEFeeExclTax) as number | null
        ),
        source: getSource(ch?.quarterlyRIEFeeExclTax),
      },
      {
        label: "Montant annuel de la redevance RIE au m² (en € et HT)",
        value: formatCurrency(
          getValue(ch?.annualRIEFeePerSqmExclTax) as number | null
        ),
        source: getSource(ch?.annualRIEFeePerSqmExclTax),
      },
      {
        label:
          "Honoraires de gestion locative et technique à la charge du preneur",
        value: managementFeesDisplay,
        source: getSource(ch?.managementFeesOnTenant),
      },
      {
        label: "Montant annuel des honoraires de gestion (en € et HT)",
        value: formatCurrency(
          getValue(ch?.managementFeesAnnualAmount) as number | null
        ),
        source: getSource(ch?.managementFeesAnnualAmount),
      },
      {
        label: "Montant trimestriel des honoraires de gestion (en € et HT)",
        value: formatCurrency(
          getValue(ch?.managementFeesQuarterlyAmount) as number | null
        ),
        source: getSource(ch?.managementFeesQuarterlyAmount),
      },
      {
        label: "Montant des honoraires de gestion au m² (en € et HT)",
        value: formatCurrency(
          getValue(ch?.managementFeesPerSqmAmount) as number | null
        ),
        source: getSource(ch?.managementFeesPerSqmAmount),
      },
    ],
  })

  // 10. Assurances et recours
  const insurancePremiumRebilled = getValue(ins?.insurancePremiumRebilled)
  const insurancePremiumRebilledDisplay =
    insurancePremiumRebilled === null
      ? NON_MENTIONNE
      : insurancePremiumRebilled
        ? "Oui"
        : "Non"

  const insuranceCertificate = getValue(ins?.insuranceCertificateAnnexed)
  const insuranceCertificateDisplay =
    insuranceCertificate === null
      ? NON_MENTIONNE
      : insuranceCertificate
        ? "Oui"
        : "Non"

  const waiverOfRecourse = getValue(ins?.hasWaiverOfRecourse)
  const waiverDisplay =
    waiverOfRecourse === null ? NON_MENTIONNE : waiverOfRecourse ? "Oui" : "Non"

  sections.push({
    title: "10. Assurances et recours",
    rows: [
      {
        label: "Montant annuel des assurances (en € et HT)",
        value: formatCurrency(
          getValue(ins?.annualInsuranceAmountExclTax) as number | null
        ),
        source: getSource(ins?.annualInsuranceAmountExclTax),
      },
      {
        label: "Refacturation des primes d'assurance au preneur",
        value: insurancePremiumRebilledDisplay,
        source: getSource(ins?.insurancePremiumRebilled),
      },
      {
        label: "Attestation d'assurance annexée au bail",
        value: insuranceCertificateDisplay,
        source: getSource(ins?.insuranceCertificateAnnexed),
      },
      {
        label: "Clause de renonciation réciproque à recours",
        value: waiverDisplay,
        source: getSource(ins?.hasWaiverOfRecourse),
      },
    ],
  })

  // 11. Sûretés
  const otherSecurities = getValue(sec?.otherSecurities)
  let otherSecuritiesDisplay: string
  if (Array.isArray(otherSecurities)) {
    otherSecuritiesDisplay =
      otherSecurities.length > 0 ? otherSecurities.join(", ") : "Non"
  } else if (typeof otherSecurities === "string") {
    otherSecuritiesDisplay =
      otherSecurities.trim().length > 0 ? otherSecurities : "Non"
  } else if (otherSecurities === null) {
    otherSecuritiesDisplay = NON_MENTIONNE
  } else {
    otherSecuritiesDisplay = NON_MENTIONNE
  }

  sections.push({
    title: "11. Sûretés",
    rows: [
      {
        label: "Montant du dépôt de garantie (en €)",
        value: formatCurrency(
          getValue(sec?.securityDepositAmount) as number | null
        ),
        source: getSources(
          sec?.securityDepositDescription,
          sec?.securityDepositAmount
        ),
      },
      {
        label: "Autres types de sûretés",
        value: otherSecuritiesDisplay,
        source: getSource(sec?.otherSecurities),
      },
    ],
  })

  // 12. Etats des lieux
  const hasPreExitInventory = getValue(inv?.hasPreExitInventory)
  const preExitDisplay =
    hasPreExitInventory === null
      ? NON_MENTIONNE
      : hasPreExitInventory
        ? `Oui. ${fmt(getValue(inv?.preExitInventoryConditions))}`
        : "Non"

  sections.push({
    title: "12. Etats des lieux",
    rows: [
      {
        label: "Conditions de l'état des lieux d'entrée",
        value: fmt(getValue(inv?.entryInventoryConditions)),
        source: getSource(inv?.entryInventoryConditions),
      },
      {
        label: "Existence d'un pré-état des lieux de sortie",
        value: preExitDisplay,
        source: getSources(
          inv?.hasPreExitInventory,
          inv?.preExitInventoryConditions
        ),
      },
      {
        label: "Conditions de l'état des lieux de sortie",
        value: fmt(getValue(inv?.exitInventoryConditions)),
        source: getSource(inv?.exitInventoryConditions),
      },
    ],
  })

  // 13. Entretien et travaux
  const hasAccessionClause = getValue(maint?.hasAccessionClause)
  const accessionDisplay =
    hasAccessionClause === null
      ? NON_MENTIONNE
      : hasAccessionClause === true
        ? "Oui"
        : "Non"

  sections.push({
    title: "13. Entretien et travaux relatifs aux locaux loués",
    rows: [
      {
        label:
          "Conditions d'entretien et de maintenance des locaux par le preneur",
        value: fmt(getValue(maint?.tenantMaintenanceConditions)),
        source: getSource(maint?.tenantMaintenanceConditions),
      },
      {
        label: "Liste des travaux à la charge du bailleur",
        value: Array.isArray(getValue(maint?.landlordWorksList))
          ? (getValue(maint?.landlordWorksList) as string[]).join(", ")
          : fmt(getValue(maint?.landlordWorksList)),
        source: getSource(maint?.landlordWorksList),
      },
      {
        label: "Liste des travaux à la charge du preneur",
        value: Array.isArray(getValue(maint?.tenantWorksList))
          ? (getValue(maint?.tenantWorksList) as string[]).join(", ")
          : fmt(getValue(maint?.tenantWorksList)),
        source: getSource(maint?.tenantWorksList),
      },
      {
        label: "Clause d'accession",
        value: accessionDisplay,
        source: getSource(maint?.hasAccessionClause),
      },
    ],
  })

  // 14. Restitution
  sections.push({
    title: "14. Restitution des locaux loués",
    rows: [
      {
        label: "Conditions de restitution des locaux",
        value: fmt(getValue(rest?.restitutionConditions)),
        source: getSource(rest?.restitutionConditions),
      },
      {
        label: "Conditions de remise en état des locaux",
        value: fmt(getValue(rest?.restorationConditions)),
        source: getSource(rest?.restorationConditions),
      },
    ],
  })

  // 15. Cession - Sous-location
  const divisionPossible = getValue(trans?.divisionPossible)
  const divisionDisplay =
    divisionPossible === null ? NON_MENTIONNE : divisionPossible ? "Oui" : "Non"

  sections.push({
    title: "15. Cession - Sous-location",
    rows: [
      {
        label: "Conditions de sous-location",
        value: fmt(getValue(trans?.sublettingConditions)),
        source: getSource(trans?.sublettingConditions),
      },
      {
        label: "Conditions de cession du bail",
        value: fmt(getValue(trans?.assignmentConditions)),
        source: getSource(trans?.assignmentConditions),
      },
      {
        label: "Possibilité de division des locaux",
        value: divisionDisplay,
        source: getSource(trans?.divisionPossible),
      },
    ],
  })

  // 16. Annexes listées
  const hasDPE = getValue(env?.hasDPE)
  const dpeDisplay =
    hasDPE === null
      ? NON_MENTIONNE
      : hasDPE
        ? `Oui${getValue(env?.dpeNote) ? ` (Classe ${getValue(env?.dpeNote)})` : ""}`
        : "Non"

  const hasAsbestos = getValue(env?.hasAsbestosDiagnostic)
  const asbestosDisplay =
    hasAsbestos === null ? NON_MENTIONNE : hasAsbestos ? "Oui" : "Non"

  const hasEnvironmentalAnnex = getValue(env?.hasEnvironmentalAnnex)
  const environmentalAnnexDisplay =
    hasEnvironmentalAnnex === null
      ? NON_MENTIONNE
      : hasEnvironmentalAnnex
        ? "Oui"
        : "Non"

  const hasRiskStatement = getValue(env?.hasRiskAndPollutionStatement)
  const riskDisplay =
    hasRiskStatement === null ? NON_MENTIONNE : hasRiskStatement ? "Oui" : "Non"

  sections.push({
    title: "16. Annexes listées",
    rows: [
      {
        label: "16.1 Annexes environnementales",
        value: "",
        source: "",
      },
      {
        label: "Diagnostic de performance énergétique (DPE)",
        value: dpeDisplay,
        source: getSources(env?.hasDPE, env?.dpeNote),
      },
      {
        label:
          "Diagnostic amiante (obligatoire pour les immeubles construits avant le 1er juillet 1997)",
        value: asbestosDisplay,
        source: getSource(env?.hasAsbestosDiagnostic),
      },
      {
        label: "Annexe environnementale (si locaux supérieurs à 2000 m²)",
        value: environmentalAnnexDisplay,
        source: getSource(env?.hasEnvironmentalAnnex),
      },
      {
        label: "Etat des risques et pollutions (daté de moins de 6 mois)",
        value: riskDisplay,
        source: getSource(env?.hasRiskAndPollutionStatement),
      },
      {
        label: "16.2 Autres annexes",
        value: "",
        source: "",
      },
    ],
  })

  const hasInternalRegulations = getValue(ann?.hasInternalRegulations)
  const internalRegulationsDisplay =
    hasInternalRegulations === null
      ? NON_MENTIONNE
      : hasInternalRegulations
        ? "Oui"
        : "Non"

  const hasPremisesPlan = getValue(ann?.hasPremisesPlan)
  const premisesPlanDisplay =
    hasPremisesPlan === null ? NON_MENTIONNE : hasPremisesPlan ? "Oui" : "Non"

  const hasChargesInventory = getValue(ann?.hasChargesInventory)
  const chargesInventoryDisplay =
    hasChargesInventory === null
      ? NON_MENTIONNE
      : hasChargesInventory
        ? "Oui"
        : "Non"

  const hasAnnualChargesSummary = getValue(ann?.hasAnnualChargesSummary)
  const annualChargesSummaryDisplay =
    hasAnnualChargesSummary === null
      ? NON_MENTIONNE
      : hasAnnualChargesSummary
        ? "Oui"
        : "Non"

  const hasThreeYearBudget = getValue(ann?.hasThreeYearWorksBudget)
  const threeYearBudgetDisplay =
    hasThreeYearBudget === null
      ? NON_MENTIONNE
      : hasThreeYearBudget
        ? "Oui"
        : "Non"

  const hasPastWorksSummary = getValue(ann?.hasPastWorksSummary)
  const pastWorksSummaryDisplay =
    hasPastWorksSummary === null
      ? NON_MENTIONNE
      : hasPastWorksSummary
        ? "Oui"
        : "Non"

  sections.push({
    title: "",
    rows: [
      {
        label: "Règlement intérieur",
        value: internalRegulationsDisplay,
        source: getSource(ann?.hasInternalRegulations),
      },
      {
        label: "Plan des locaux",
        value: premisesPlanDisplay,
        source: getSource(ann?.hasPremisesPlan),
      },
      {
        label:
          "Inventaire précis et limitatif des catégories de charges, impôts, taxes et redevances liés au bail",
        value: chargesInventoryDisplay,
        source: getSource(ann?.hasChargesInventory),
      },
      {
        label:
          "Etat récapitulatif annuel des catégories de charges, impôts, taxes et redevances",
        value: annualChargesSummaryDisplay,
        source: getSource(ann?.hasAnnualChargesSummary),
      },
      {
        label:
          "Etat et budget prévisionnel des travaux dans les trois prochaines années",
        value: threeYearBudgetDisplay,
        source: getSource(ann?.hasThreeYearWorksBudget),
      },
      {
        label: "Etat récapitulatif des travaux passés",
        value: pastWorksSummaryDisplay,
        source: getSource(ann?.hasPastWorksSummary),
      },
    ],
  })

  // 17. Autres
  const civilCodeDerogations = getValue(other?.civilCodeDerogations)
  let civilCodeDisplay: string
  if (Array.isArray(civilCodeDerogations)) {
    civilCodeDisplay =
      civilCodeDerogations.length > 0
        ? civilCodeDerogations.join(", ")
        : "Aucune"
  } else if (
    civilCodeDerogations !== null &&
    civilCodeDerogations !== undefined &&
    typeof civilCodeDerogations === "string" &&
    (civilCodeDerogations as string).trim().length > 0
  ) {
    civilCodeDisplay = civilCodeDerogations as string
  } else if (
    civilCodeDerogations === null ||
    civilCodeDerogations === undefined
  ) {
    civilCodeDisplay = NON_MENTIONNE
  } else {
    civilCodeDisplay = "Aucune"
  }

  const commercialCodeDerogations = getValue(other?.commercialCodeDerogations)
  let commercialCodeDisplay: string
  if (Array.isArray(commercialCodeDerogations)) {
    commercialCodeDisplay =
      commercialCodeDerogations.length > 0
        ? commercialCodeDerogations.join(", ")
        : "Aucune"
  } else if (
    commercialCodeDerogations !== null &&
    commercialCodeDerogations !== undefined &&
    typeof commercialCodeDerogations === "string" &&
    (commercialCodeDerogations as string).trim().length > 0
  ) {
    commercialCodeDisplay = commercialCodeDerogations as string
  } else if (
    commercialCodeDerogations === null ||
    commercialCodeDerogations === undefined
  ) {
    commercialCodeDisplay = NON_MENTIONNE
  } else {
    commercialCodeDisplay = "Aucune"
  }

  sections.push({
    title: "17. Autres",
    rows: [
      {
        label: "Liste des dérogations au code civil",
        value: civilCodeDisplay,
        source: getSource(other?.civilCodeDerogations),
      },
      {
        label: "Liste des dérogations au code du commerce",
        value: commercialCodeDisplay,
        source: getSource(other?.commercialCodeDerogations),
      },
    ],
  })

  return sections
}

function addSectionToPDF(
  doc: jsPDF,
  section: PDFSection,
  startY: number,
  pageWidth: number,
  margin: number
): number {
  let y = startY
  const maxWidth = pageWidth - 2 * margin
  const col1Width = maxWidth * 0.4
  const col2Width = maxWidth * 0.35
  const col3Width = maxWidth * 0.25

  // Section header
  if (section.title) {
    // Check if we need a new page
    if (y > 250) {
      doc.addPage()
      y = margin + 10
    }

    doc.setFillColor(...SECTION_COLOR)
    doc.rect(margin, y - 5, maxWidth, 8, "F")
    doc.setTextColor(...TEXT_COLOR)
    doc.setFontSize(11)
    doc.setFont("helvetica", "bold")
    doc.text(cleanTextForPDF(section.title), margin + 3, y + 2)
    y += 12
  }

  // Section rows
  for (const row of section.rows) {
    // Check if we need a new page
    if (y > 270) {
      doc.addPage()
      y = margin + 10
    }

    // Skip empty subsection headers
    if (!row.label && !row.value) {
      continue
    }

    // Label
    doc.setTextColor(...TEXT_COLOR)
    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    const labelLines = doc.splitTextToSize(
      cleanTextForPDF(row.label),
      col1Width - 5
    )
    doc.text(labelLines, margin + 2, y + 3)

    // Value
    doc.setTextColor(...TEXT_COLOR)
    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    const valueLines = doc.splitTextToSize(
      cleanTextForPDF(row.value),
      col2Width - 5
    )
    doc.text(valueLines, margin + col1Width + 5, y + 3)

    // Source (if present)
    let sourceLines: string[] = []
    if (row.source) {
      doc.setTextColor(...TEXT_SECONDARY)
      doc.setFontSize(8)
      doc.setFont("helvetica", "italic")
      sourceLines = doc.splitTextToSize(
        cleanTextForPDF(row.source),
        col3Width - 5
      )
      doc.text(sourceLines, margin + col1Width + col2Width + 10, y + 3)
    }

    // Calculate height needed for this row
    const labelHeight = labelLines.length * 4
    const valueHeight = valueLines.length * 4
    const sourceHeight = sourceLines.length * 4
    const rowHeight = Math.max(labelHeight, valueHeight, sourceHeight) + 4

    // Draw separator line
    doc.setDrawColor(...BORDER_COLOR)
    doc.line(margin, y + rowHeight - 2, pageWidth - margin, y + rowHeight - 2)

    y += rowHeight
  }

  return y
}

export function exportExtractionToPDF(extraction: LeaseExtractionResult): void {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  let y = margin

  // Header
  doc.setFillColor(...BRAND_COLOR)
  doc.rect(0, 0, pageWidth, 30, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont("helvetica", "bold")
  doc.text(cleanTextForPDF("Audit Bail - Extraction"), margin, 15)

  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  const fileName = extraction.fileName?.replace(/\.pdf$/i, "") || "Document"
  doc.text(cleanTextForPDF(fileName), margin, 22)

  const extractionDate = new Date(extraction.extractionDate).toLocaleDateString(
    "fr-FR",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  )
  doc.text(cleanTextForPDF(`Extraction du ${extractionDate}`), margin, 27)

  y = 35

  // Build sections
  const sections = buildSections(extraction)

  // Add sections to PDF
  for (const section of sections) {
    y = addSectionToPDF(doc, section, y, pageWidth, margin)
    y += 5 // Space between sections
  }

  // Footer on each page
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setTextColor(...TEXT_SECONDARY)
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.text(
      `Page ${i} / ${totalPages}`,
      pageWidth - margin - 20,
      pageHeight - 10
    )
  }

  // Save PDF
  const pdfFileName = `${fileName}-extraction.pdf`
  doc.save(pdfFileName)
}

function formatCurrencyForPDF(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—"
  return `${value.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`
}

function formatFrequency(freq: string | null | undefined): string {
  if (freq === "monthly") return cleanTextForPDF("Mensuel")
  if (freq === "quarterly") return cleanTextForPDF("Trimestriel")
  if (freq === "annual") return cleanTextForPDF("Annuel")
  return cleanTextForPDF(freq || "—")
}

export function exportRentCalculationToPDF(
  result: RentCalculationResult
): void {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  const contentWidth = pageWidth - 2 * margin
  let y = margin

  // Header
  doc.setFillColor(...BRAND_COLOR)
  doc.rect(0, 0, pageWidth, 30, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont("helvetica", "bold")
  doc.text(cleanTextForPDF("Calcul de loyer"), margin, 15)

  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  const fileName = result.fileName?.replace(/\.pdf$/i, "") || "Document"
  doc.text(cleanTextForPDF(fileName), margin, 22)

  const extractionDate = new Date(result.extractionDate).toLocaleDateString(
    "fr-FR",
    { day: "numeric", month: "long", year: "numeric" }
  )
  doc.text(cleanTextForPDF(`Calcul du ${extractionDate}`), margin, 27)

  y = 40

  const extracted = result.extractedData
  const schedule = result.rentSchedule
  const input = result.scheduleInput
  const hasSchedule =
    schedule && schedule.schedule && schedule.schedule.length > 0

  // Calculate cumulative amounts
  const today = new Date()
  const todayStr = today.toISOString().split("T")[0]
  const pastPeriods = hasSchedule
    ? schedule.schedule.filter(
        (p: RentSchedulePeriod) => p.periodEnd < todayStr
      )
    : []

  const totalOfficeRentHT = hasSchedule
    ? schedule.schedule.reduce(
        (sum: number, p: RentSchedulePeriod) => sum + p.officeRentHT,
        0
      )
    : 0
  const totalParkingRentHT = hasSchedule
    ? schedule.schedule.reduce(
        (sum: number, p: RentSchedulePeriod) => sum + p.parkingRentHT,
        0
      )
    : 0
  const paidOfficeRentHT = pastPeriods.reduce(
    (sum: number, p: RentSchedulePeriod) => sum + p.officeRentHT,
    0
  )
  const paidParkingRentHT = pastPeriods.reduce(
    (sum: number, p: RentSchedulePeriod) => sum + p.parkingRentHT,
    0
  )
  const remainingOfficeRentHT = totalOfficeRentHT - paidOfficeRentHT
  const remainingParkingRentHT = totalParkingRentHT - paidParkingRentHT

  // Franchise data
  const franchiseMonths =
    extracted.supportMeasures?.rentFreePeriodMonths?.value ?? 0
  const franchiseAmount =
    extracted.supportMeasures?.rentFreePeriodAmount?.value ?? 0
  const measuresDescription =
    extracted.supportMeasures?.otherMeasuresDescription?.value

  // Helper to add a section header
  function addSectionHeader(title: string, highlight = false) {
    if (y > 260) {
      doc.addPage()
      y = margin + 10
    }
    doc.setFillColor(...(highlight ? BRAND_COLOR : SECTION_COLOR))
    doc.rect(margin, y - 4, contentWidth, 7, "F")
    doc.setTextColor(
      highlight ? 255 : TEXT_COLOR[0],
      highlight ? 255 : TEXT_COLOR[1],
      highlight ? 255 : TEXT_COLOR[2]
    )
    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    doc.text(cleanTextForPDF(title), margin + 2, y + 1)
    y += 10
  }

  // Helper to add a data row
  function addDataRow(
    label: string,
    value: string | number | null | undefined,
    highlight = false
  ) {
    if (y > 275) {
      doc.addPage()
      y = margin + 10
    }
    doc.setTextColor(...TEXT_COLOR)
    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    doc.text(cleanTextForPDF(label), margin + 2, y)

    const displayValue =
      value === null || value === undefined || value === ""
        ? "—"
        : String(value)
    if (highlight) {
      doc.setFont("helvetica", "bold")
    }
    doc.text(cleanTextForPDF(displayValue), pageWidth - margin - 2, y, {
      align: "right",
    })
    doc.setFont("helvetica", "normal")
    y += 6
  }

  // Helper to add a subsection label
  function addSubsectionLabel(label: string) {
    if (y > 270) {
      doc.addPage()
      y = margin + 10
    }
    doc.setTextColor(...TEXT_SECONDARY)
    doc.setFontSize(8)
    doc.setFont("helvetica", "bold")
    doc.text(cleanTextForPDF(label.toUpperCase()), margin + 2, y)
    y += 6
  }

  // 1. Donnees bail
  addSectionHeader("Donnees bail")
  addDataRow(
    "Nom de l'actif",
    extracted.premises?.designation?.value ||
      result.fileName?.replace(/\.pdf$/i, "") ||
      "—"
  )
  addDataRow("Adresse du bien", extracted.premises?.address?.value)
  addDataRow(
    "Date d'effet",
    extracted.calendar.effectiveDate?.value
      ? formatDate(extracted.calendar.effectiveDate.value)
      : null
  )
  addDataRow(
    "Duree du bail",
    extracted.calendar.duration?.value
      ? `${extracted.calendar.duration.value} annees`
      : null
  )
  addDataRow(
    "Surface",
    extracted.premises?.surfaceArea?.value
      ? `${extracted.premises.surfaceArea.value} m2`
      : null
  )
  addDataRow(
    "Places de parking",
    extracted.premises?.parkingSpaces?.value
      ? `${extracted.premises.parkingSpaces.value} unites`
      : null
  )
  y += 3

  // 2. Donnees financieres
  addSectionHeader("Donnees financieres", true)
  addDataRow(
    "Frequence de paiement",
    formatFrequency(
      input?.paymentFrequency || extracted.rent.paymentFrequency?.value
    )
  )

  y += 2
  addSubsectionLabel("Loyers bureaux")
  addDataRow(
    "Loyer de base annuel HTHC",
    formatCurrencyForPDF(
      extracted.rent.annualRentExclTaxExclCharges?.value ?? null
    )
  )
  addDataRow(
    "Loyer de base trimestriel HTHC",
    formatCurrencyForPDF(
      extracted.rent.quarterlyRentExclTaxExclCharges?.value ?? null
    )
  )
  addDataRow(
    "Loyer HTHC / m2 / an",
    formatCurrencyForPDF(
      extracted.rent.annualRentPerSqmExclTaxExclCharges?.value ?? null
    )
  )

  y += 2
  addSubsectionLabel("Loyers parking")
  addDataRow(
    "Loyer de base parking annuel HTHC",
    formatCurrencyForPDF(
      extracted.rent.annualParkingRentExclCharges?.value ?? null
    )
  )
  addDataRow(
    "Loyer de base parking trimestriel HTHC",
    formatCurrencyForPDF(
      extracted.rent.quarterlyParkingRentExclCharges?.value ?? null
    )
  )
  addDataRow(
    "Loyer parking HTHC / unite / an",
    formatCurrencyForPDF(
      extracted.rent.annualParkingRentPerUnitExclCharges?.value ?? null
    )
  )

  y += 2
  addSubsectionLabel("Charges et taxes")
  addDataRow(
    "Provisions pour charges annuelles HT",
    formatCurrencyForPDF(
      extracted.charges?.annualChargesProvisionExclTax?.value ?? null
    )
  )
  addDataRow(
    "Provisions pour charges trimestrielles HT",
    formatCurrencyForPDF(
      extracted.charges?.quarterlyChargesProvisionExclTax?.value ?? null
    )
  )
  addDataRow(
    "Provision pour charges HT / m2 / an",
    formatCurrencyForPDF(
      extracted.charges?.annualChargesProvisionPerSqmExclTax?.value ?? null
    )
  )
  addDataRow(
    "Provisions pour taxes annuelles",
    formatCurrencyForPDF(extracted.taxes?.propertyTaxAmount?.value ?? null)
  )
  const taxQuarterly = extracted.taxes?.propertyTaxAmount?.value
    ? extracted.taxes.propertyTaxAmount.value / 4
    : null
  addDataRow(
    "Provisions pour taxes trimestrielles",
    formatCurrencyForPDF(taxQuarterly)
  )
  const taxPerSqm =
    extracted.taxes?.propertyTaxAmount?.value &&
    extracted.premises?.surfaceArea?.value
      ? extracted.taxes.propertyTaxAmount.value /
        extracted.premises.surfaceArea.value
      : null
  addDataRow(
    "Provision pour taxes HT / m2 / an",
    formatCurrencyForPDF(taxPerSqm)
  )

  y += 2
  addSubsectionLabel("Mesures d'accompagnement")
  const franchiseDisplay =
    franchiseMonths > 0
      ? `${franchiseMonths} mois${franchiseAmount > 0 ? ` + ${formatCurrencyForPDF(franchiseAmount)}` : ""}`
      : null
  addDataRow("Franchise accordee", franchiseDisplay)
  addDataRow("Autres mesures d'accompagnement", measuresDescription)

  y += 2
  addSubsectionLabel("Indexation")
  const indexTypeValue =
    input?.indexType || extracted.indexation?.indexationType?.value
  const indexDisplay = indexTypeValue
    ? `${indexTypeValue}${
        extracted.indexation?.referenceQuarter?.value
          ? ` - ${extracted.indexation.referenceQuarter.value}`
          : ""
      }`
    : null
  addDataRow("Indice", indexDisplay)
  addDataRow("Periodicite de l'indice", "—")
  y += 3

  // 3. Suretes
  addSectionHeader("Suretes")
  addDataRow(
    "Montant du depot de garantie",
    formatCurrencyForPDF(
      extracted.securities?.securityDepositAmount?.value ?? null
    )
  )
  y += 3

  // 4. Loyers cumules et previsionnels (if schedule exists)
  if (hasSchedule) {
    addSectionHeader("Loyers cumules et previsionnels", true)

    addSubsectionLabel("Sur la duree totale du bail")
    addDataRow(
      "Loyers cumules HTHC sur la duree du bail",
      formatCurrencyForPDF(totalOfficeRentHT),
      true
    )
    addDataRow(
      "Loyers parking cumules HTHC sur la duree du bail",
      formatCurrencyForPDF(totalParkingRentHT),
      true
    )

    y += 2
    addSubsectionLabel("Periodes passees")
    addDataRow(
      "Loyers cumules HTHC payes",
      formatCurrencyForPDF(paidOfficeRentHT)
    )
    addDataRow(
      "Loyers parking cumules HTHC payes",
      formatCurrencyForPDF(paidParkingRentHT)
    )

    y += 2
    addSubsectionLabel("Periodes futures")
    addDataRow(
      "Loyers previsionnel HTHC restant du",
      formatCurrencyForPDF(remainingOfficeRentHT)
    )
    addDataRow(
      "Loyers parking previsionnel HTHC restant du",
      formatCurrencyForPDF(remainingParkingRentHT)
    )
    y += 3
  }

  // 5. Echeancier des periodes passees (if any)
  if (pastPeriods.length > 0) {
    addSectionHeader(
      `Echeancier des periodes passees (${pastPeriods.length} periodes)`
    )

    // Table header
    if (y > 250) {
      doc.addPage()
      y = margin + 10
    }
    doc.setFillColor(...SECTION_COLOR)
    doc.rect(margin, y - 3, contentWidth, 7, "F")
    doc.setFontSize(8)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...TEXT_COLOR)
    doc.text(cleanTextForPDF("Periode"), margin + 2, y + 2)
    doc.text(cleanTextForPDF("Loyers HTHC"), margin + 45, y + 2)
    doc.text(cleanTextForPDF("Parking HTHC"), margin + 85, y + 2)
    doc.text(cleanTextForPDF("Total HTHC"), margin + 125, y + 2)
    y += 8

    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)

    // Show first 20 past periods
    const displayPeriods = pastPeriods.slice(0, 20)
    for (const period of displayPeriods) {
      if (y > 275) {
        doc.addPage()
        y = margin + 10
      }

      const periodLabel =
        period.periodType === "month"
          ? `${period.year}-${String(period.month).padStart(2, "0")}`
          : `T${period.quarter} ${period.year}`

      const totalRent = period.officeRentHT + period.parkingRentHT

      doc.setTextColor(...TEXT_COLOR)
      doc.text(periodLabel, margin + 2, y)
      doc.text(formatCurrencyForPDF(period.officeRentHT), margin + 45, y)
      doc.text(formatCurrencyForPDF(period.parkingRentHT), margin + 85, y)
      doc.setFont("helvetica", "bold")
      doc.text(formatCurrencyForPDF(totalRent), margin + 125, y)
      doc.setFont("helvetica", "normal")

      doc.setDrawColor(...BORDER_COLOR)
      doc.line(margin, y + 2, pageWidth - margin, y + 2)
      y += 5
    }

    // Totals row
    y += 2
    doc.setFont("helvetica", "bold")
    doc.setFontSize(8)
    doc.text(cleanTextForPDF("Total"), margin + 2, y)
    doc.text(formatCurrencyForPDF(paidOfficeRentHT), margin + 45, y)
    doc.text(formatCurrencyForPDF(paidParkingRentHT), margin + 85, y)
    doc.text(
      formatCurrencyForPDF(paidOfficeRentHT + paidParkingRentHT),
      margin + 125,
      y
    )
    doc.setFont("helvetica", "normal")

    if (pastPeriods.length > 20) {
      y += 6
      doc.setFontSize(7)
      doc.setTextColor(...TEXT_SECONDARY)
      doc.text(
        cleanTextForPDF(`... et ${pastPeriods.length - 20} autres periodes`),
        margin + 2,
        y
      )
    }
  } else if (hasSchedule) {
    y += 3
    doc.setFontSize(9)
    doc.setTextColor(...TEXT_SECONDARY)
    doc.text(
      cleanTextForPDF("Aucune periode passee. Le bail commence dans le futur."),
      margin + 2,
      y
    )
  }

  // Footer on each page
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setTextColor(...TEXT_SECONDARY)
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.text(
      `Page ${i} / ${totalPages}`,
      pageWidth - margin - 20,
      pageHeight - 10
    )
  }

  // Save PDF
  const pdfFileName = `${fileName}-calcul-loyer.pdf`
  doc.save(pdfFileName)
}
