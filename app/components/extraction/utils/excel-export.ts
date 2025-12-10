import ExcelJS from "exceljs"
import type {
  LeaseExtractionResult,
  ExtractedValue,
} from "@/app/lib/extraction/types"

/**
 * Excel export that matches the exact format ofthe excel template
 * Le template: "Template livrable audit bail"
 */

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

const NON_MENTIONNE = "Non mentionné"

function fmt(value: unknown, defaultValue: string = NON_MENTIONNE): string {
  if (value === null || value === undefined) return defaultValue
  if (typeof value === "boolean") return value ? "Oui" : "Non"
  if (typeof value === "number") return String(value)
  if (Array.isArray(value))
    return value.length > 0 ? value.join(", ") : defaultValue
  if (typeof value === "object" && "value" in value) {
    return fmt((value as { value: unknown }).value, defaultValue)
  }
  if (typeof value === "object") return defaultValue
  return String(value)
}

function formatDate(
  isoDate: string | null | undefined,
  defaultValue: string = NON_MENTIONNE
): string {
  if (!isoDate) return defaultValue
  try {
    const date = new Date(isoDate)
    if (isNaN(date.getTime())) return defaultValue
    return date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  } catch {
    return String(isoDate)
  }
}

function formatCurrency(
  value: number | string | null | undefined,
  defaultValue: string = NON_MENTIONNE
): string {
  if (value === null || value === undefined) return defaultValue
  if (typeof value === "string") {
    // Handle strings like "Inclus dans le loyer initial des locaux"
    if (value.toLowerCase().includes("inclus")) return value
    const numValue = parseFloat(value.replace(/\s/g, "").replace(",", "."))
    if (!isNaN(numValue)) return `${numValue.toLocaleString("fr-FR")} €`
    return value
  }
  return `${value.toLocaleString("fr-FR")} €`
}

function formatSurface(
  value: number | null | undefined,
  defaultValue: string = NON_MENTIONNE
): string {
  if (value === null || value === undefined) return defaultValue
  return `${value.toLocaleString("fr-FR")} m²`
}

function formatUnits(
  value: number | null | undefined,
  unit: string,
  defaultValue: string = NON_MENTIONNE
): string {
  if (value === null || value === undefined) return defaultValue
  return `${value} ${unit}`
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

type RowData = (string | number | null)[]

function buildExportData(extraction: LeaseExtractionResult): RowData[] {
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

  const rows: RowData[] = []

  // Header row - 3 colonnes : Thèmes, Extraction, Sources
  rows.push(["Thèmes", "Extraction", "Sources"])

  // 1. Régime du Bail
  rows.push(["1. Régime du Bail", "", ""])
  rows.push([
    "Régime juridique",
    fmt(getValue(extraction.regime?.regime)),
    getSource(extraction.regime?.regime),
  ])

  // 2. Parties - format avec sauts de ligne
  rows.push(["2. Parties", "", ""])
  const landlordContact = formatContact(
    getValue(p?.landlord?.email),
    getValue(p?.landlord?.phone)
  )
  rows.push([
    "Bailleur",
    [
      `Nom : ${fmt(getValue(p?.landlord?.name))}`,
      `SIREN : ${fmt(getValue(p?.landlord?.siren))}`,
      `Courriel et téléphone : ${landlordContact}`,
      `Adresse : ${fmt(getValue(p?.landlord?.address))}`,
    ].join("\n"),
    getSources(
      p?.landlord?.name,
      p?.landlord?.siren,
      p?.landlord?.email,
      p?.landlord?.phone,
      p?.landlord?.address
    ),
  ])
  const landlordRepresentative = p?.landlordRepresentative
  rows.push([
    "Représentant du bailleur (le cas échéant)",
    landlordRepresentative
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
    landlordRepresentative
      ? getSources(
          landlordRepresentative?.name,
          landlordRepresentative?.siren,
          landlordRepresentative?.email,
          landlordRepresentative?.address
        )
      : "",
  ])
  const tenantContact = formatContact(
    getValue(p?.tenant?.email),
    getValue(p?.tenant?.phone)
  )
  rows.push([
    "Preneur",
    [
      `Nom : ${fmt(getValue(p?.tenant?.name))}`,
      `SIREN : ${fmt(getValue(p?.tenant?.siren))}`,
      `Courriel et téléphone : ${tenantContact}`,
      `Adresse : ${fmt(getValue(p?.tenant?.address))}`,
    ].join("\n"),
    getSources(
      p?.tenant?.name,
      p?.tenant?.siren,
      p?.tenant?.email,
      p?.tenant?.phone,
      p?.tenant?.address
    ),
  ])

  // 3. Description des locaux loués
  rows.push(["3. Description des locaux loués", "", ""])
  rows.push([
    "Designation des locaux",
    fmt(getValue(pr?.designation)),
    getSource(pr?.designation),
  ])
  rows.push([
    "Destination des locaux",
    fmt(getValue(pr?.purpose)),
    getSource(pr?.purpose),
  ])
  rows.push([
    "Adresse des locaux",
    fmt(getValue(pr?.address)),
    getSource(pr?.address),
  ])
  rows.push([
    "Année de construction de l'immeuble",
    fmt(getValue(pr?.buildingYear)),
    getSource(pr?.buildingYear),
  ])
  rows.push([
    "Etage(s) des locaux",
    Array.isArray(getValue(pr?.floors))
      ? (getValue(pr?.floors) as string[]).join(", ")
      : fmt(getValue(pr?.floors)),
    getSource(pr?.floors),
  ])
  rows.push([
    "Numéro(s) du/des lot(s)",
    Array.isArray(getValue(pr?.lotNumbers))
      ? (getValue(pr?.lotNumbers) as string[]).join(", ")
      : fmt(getValue(pr?.lotNumbers)),
    getSource(pr?.lotNumbers),
  ])
  rows.push([
    "Surface (en m²)",
    formatSurface(getValue(pr?.surfaceArea) as number | null),
    getSource(pr?.surfaceArea),
  ])
  const isPartitioned = getValue(pr?.isPartitioned)
  const isPartitionedDisplay =
    isPartitioned === null ? NON_MENTIONNE : isPartitioned ? "Oui" : "Non"
  rows.push([
    "Les locaux sont-ils cloisonnés ?",
    isPartitionedDisplay,
    getSource(pr?.isPartitioned),
  ])

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
  rows.push([
    "Les locaux sont-ils équipés avec du mobilier ?",
    hasFurnitureDisplay,
    getSource(pr?.hasFurniture),
  ])
  rows.push([
    "Clause de garnissement des locaux",
    fmt(getValue(pr?.furnishingConditions)),
    getSource(pr?.furnishingConditions),
  ])
  rows.push([
    "Clause d'enseigne",
    fmt(getValue(pr?.signageConditions)),
    getSource(pr?.signageConditions),
  ])

  const hasOutdoorSpace = getValue(pr?.hasOutdoorSpace)
  const outdoorDisplay =
    hasOutdoorSpace === null ? NON_MENTIONNE : hasOutdoorSpace ? "Oui" : "Non"
  rows.push([
    "Existence d'un espace extérieur ?",
    outdoorDisplay,
    getSource(pr?.hasOutdoorSpace),
  ])

  const hasArchiveSpace = getValue(pr?.hasArchiveSpace)
  const archiveDisplay =
    hasArchiveSpace === null ? NON_MENTIONNE : hasArchiveSpace ? "Oui" : "Non"
  rows.push([
    "Existence d'un local d'archive ?",
    archiveDisplay,
    getSource(pr?.hasArchiveSpace),
  ])
  rows.push([
    "Nombre d'emplacements de parkings (en unité)",
    formatUnits(getValue(pr?.parkingSpaces) as number | null, "u"),
    getSource(pr?.parkingSpaces),
  ])
  rows.push([
    "Quote-part de l'immeuble loué",
    [
      `Incluant les parties communes : ${fmt(getValue(pr?.shareWithCommonAreas))}`,
      `Hors parties communes : ${fmt(getValue(pr?.shareWithoutCommonAreas))}`,
    ].join("\n"),
    getSources(pr?.shareWithCommonAreas, pr?.shareWithoutCommonAreas),
  ])

  // 4. Calendrier
  rows.push(["4. Calendrier", "", ""])
  rows.push([
    "Date de signature du bail",
    formatDate(getValue(c?.signatureDate) as string | null),
    getSource(c?.signatureDate),
  ])
  // Duration may be a number (9) or string ("9 ans")
  const durationValue = getValue(c?.duration)
  const durationDisplay =
    durationValue === null || durationValue === undefined
      ? NON_MENTIONNE
      : typeof durationValue === "number"
        ? `${durationValue} ans`
        : String(durationValue).includes("ans")
          ? String(durationValue)
          : `${durationValue} ans`

  rows.push(["Durée du bail", durationDisplay, getSource(c?.duration)])
  rows.push([
    "Date de prise d'effet",
    formatDate(getValue(c?.effectiveDate) as string | null),
    getSource(c?.effectiveDate),
  ])
  rows.push([
    "Mise à disposition anticipée",
    getValue(c?.earlyAccessDate)
      ? formatDate(getValue(c?.earlyAccessDate) as string)
      : NON_MENTIONNE,
    getSource(c?.earlyAccessDate),
  ])
  rows.push([
    "Prochaine(s) faculté(s) de résiliation/congé",
    formatDate(getValue(c?.nextTriennialDate) as string | null),
    getSource(c?.nextTriennialDate),
  ])
  rows.push([
    "Date de fin de bail",
    formatDate(getValue(c?.endDate) as string | null),
    getSource(c?.endDate),
  ])
  rows.push([
    "Durée de préavis",
    fmt(getValue(c?.noticePeriod)),
    getSource(c?.noticePeriod),
  ])
  rows.push([
    "Conditions pour donner congé",
    fmt(getValue(c?.terminationConditions)),
    getSource(c?.terminationConditions),
  ])
  rows.push([
    "Conditions de renouvellement à l'échéance du bail",
    fmt(getValue(c?.renewalConditions)),
    getSource(c?.renewalConditions),
  ])

  // 5. Mesures d'accompagnement
  rows.push(["5. Mesures d'accompagnement", "", ""])
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
  rows.push([
    "Franchise de loyer",
    rentFreeDisplay,
    getSources(
      sm?.hasRentFreeperiod,
      sm?.rentFreePeriodMonths,
      sm?.rentFreePeriodAmount
    ),
  ])

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
  rows.push([
    "Autres mesures d'accompagnement",
    otherMeasuresDisplay,
    getSources(sm?.hasOtherMeasures, sm?.otherMeasuresDescription),
  ])

  // 6. Loyer
  rows.push(["6. Loyer", "", ""])
  rows.push([
    "Montant du loyer initial annuel (en € et HTHC)",
    formatCurrency(getValue(r?.annualRentExclTaxExclCharges) as number | null),
    getSource(r?.annualRentExclTaxExclCharges),
  ])
  rows.push([
    "Montant du loyer initial trimestriel (en € et HTHC)",
    formatCurrency(
      getValue(r?.quarterlyRentExclTaxExclCharges) as number | null
    ),
    getSource(r?.quarterlyRentExclTaxExclCharges),
  ])
  rows.push([
    "Montant du loyer annuel initial au m² (en € et HTHC)",
    formatCurrency(
      getValue(r?.annualRentPerSqmExclTaxExclCharges) as number | null
    ),
    getSource(r?.annualRentPerSqmExclTaxExclCharges),
  ])
  rows.push([
    "Montant du loyer initial annuel des emplacements de parking (en € et HTHC)",
    formatCurrency(getValue(r?.annualParkingRentExclCharges) as number | null),
    getSource(r?.annualParkingRentExclCharges),
  ])
  rows.push([
    "Montant du loyer initial trimestriel des emplacements de parking (en € et HTHC)",
    formatCurrency(
      getValue(r?.quarterlyParkingRentExclCharges) as number | null
    ),
    getSource(r?.quarterlyParkingRentExclCharges),
  ])
  rows.push([
    "Montant du loyer annuel initial des emplacements de parkings par unité (en € et HTHC)",
    formatCurrency(
      getValue(r?.annualParkingRentPerUnitExclCharges) as number | null
    ),
    getSource(r?.annualParkingRentPerUnitExclCharges),
  ])
  const isSubjectToVAT = getValue(r?.isSubjectToVAT)
  const vatDisplay =
    isSubjectToVAT === null ? NON_MENTIONNE : isSubjectToVAT ? "Oui" : "Non"
  rows.push([
    "Soumission du loyer à la TVA",
    vatDisplay,
    getSource(r?.isSubjectToVAT),
  ])
  rows.push([
    "Périodicité de facturation du loyer",
    getValue(r?.paymentFrequency) === "monthly"
      ? "Mensuel"
      : getValue(r?.paymentFrequency) === "quarterly"
        ? "Trimestriel"
        : getValue(r?.paymentFrequency) === "annual"
          ? "Annuel"
          : fmt(getValue(r?.paymentFrequency)),
    getSource(r?.paymentFrequency),
  ])
  rows.push([
    "Montant et conditions d'application de pénalités pour retard de paiement des loyers",
    [
      fmt(getValue(r?.latePaymentPenaltyAmount))
        ? formatCurrency(getValue(r?.latePaymentPenaltyAmount) as number)
        : "",
      fmt(getValue(r?.latePaymentPenaltyConditions)),
    ]
      .filter(Boolean)
      .join(". ") || NON_MENTIONNE,
    getSources(r?.latePaymentPenaltyConditions, r?.latePaymentPenaltyAmount),
  ])

  // 7. Indexation
  rows.push(["7. Indexation", "", ""])
  // Check hasIndexationClause (newer) or indexationClause (legacy)
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

  rows.push([
    "Clause d'indexation",
    indexationDisplay,
    getSource(idx?.hasIndexationClause) || getSource(idx?.indexationClause),
  ])
  rows.push([
    "Choix de l'indice d'indexation",
    fmt(getValue(idx?.indexationType)),
    getSource(idx?.indexationType),
  ])
  rows.push([
    "Trimestre de référence de l'indice",
    fmt(getValue(idx?.referenceQuarter)),
    getSource(idx?.referenceQuarter),
  ])
  // firstIndexationDate can be a recurring date string ("Le 19 décembre de chaque année") or ISO date
  const firstIndexDate = getValue(idx?.firstIndexationDate)
  const firstIndexDateDisplay =
    firstIndexDate === null || firstIndexDate === undefined
      ? NON_MENTIONNE
      : /^\d{4}-\d{2}-\d{2}/.test(String(firstIndexDate))
        ? formatDate(String(firstIndexDate))
        : String(firstIndexDate)

  rows.push([
    "Date de l'indexation",
    firstIndexDateDisplay,
    getSource(idx?.firstIndexationDate),
  ])
  rows.push([
    "Périodicité de l'indexation",
    getValue(idx?.indexationFrequency) === "annual"
      ? "Annuellement"
      : getValue(idx?.indexationFrequency) === "quarterly"
        ? "Trimestriellement"
        : fmt(getValue(idx?.indexationFrequency)),
    getSource(idx?.indexationFrequency),
  ])

  // 8. Impôts et taxes
  rows.push(["8. Impôts et taxes", "", ""])
  const propertyTaxRebilled = getValue(tx?.propertyTaxRebilled)
  const propertyTaxRebilledDisplay =
    propertyTaxRebilled === null
      ? NON_MENTIONNE
      : propertyTaxRebilled
        ? "Oui"
        : "Non"
  rows.push([
    "Refacturation de la taxe foncière et de la TEOM au preneur",
    propertyTaxRebilledDisplay,
    getSource(tx?.propertyTaxRebilled),
  ])
  rows.push([
    "Montant annuel de la provision pour taxe foncière (en €)",
    formatCurrency(getValue(tx?.propertyTaxAmount) as number | null),
    getSource(tx?.propertyTaxAmount),
  ])
  rows.push([
    "Montant annuel de la provision pour TEOM (en €)",
    formatCurrency(getValue(tx?.teomAmount) as number | null),
    getSource(tx?.teomAmount),
  ])
  rows.push([
    "Montant annuel de la provision pour taxe sur les bureaux et les locaux commerciaux et de stockages (en €)",
    formatCurrency(getValue(tx?.officeTaxAmount) as number | null),
    getSource(tx?.officeTaxAmount),
  ])
  rows.push([
    "Montant annuel de la provision pour taxe sur les emplacements de parking (en €)",
    formatCurrency(getValue(tx?.parkingTaxAmount) as number | null),
    getSource(tx?.parkingTaxAmount),
  ])

  // 9. Charges et honoraires
  rows.push(["9. Charges locatives et honoraires", "", ""])
  rows.push([
    "Montant annuel des provisions pour charges (en € et HT)",
    formatCurrency(
      getValue(ch?.annualChargesProvisionExclTax) as number | null
    ),
    getSource(ch?.annualChargesProvisionExclTax),
  ])
  rows.push([
    "Montant trimestriel des provisions pour charges (en € et HT)",
    formatCurrency(
      getValue(ch?.quarterlyChargesProvisionExclTax) as number | null
    ),
    getSource(ch?.quarterlyChargesProvisionExclTax),
  ])
  rows.push([
    "Montant annuel des provisions pour charges au m² (en € et HT)",
    formatCurrency(
      getValue(ch?.annualChargesProvisionPerSqmExclTax) as number | null
    ),
    getSource(ch?.annualChargesProvisionPerSqmExclTax),
  ])
  rows.push([
    "Montant annuel de la redevance RIE (en € et HT)",
    formatCurrency(getValue(ch?.annualRIEFeeExclTax) as number | null),
    getSource(ch?.annualRIEFeeExclTax),
  ])
  rows.push([
    "Montant trimestriel de la redevance RIE (en € et HT)",
    formatCurrency(getValue(ch?.quarterlyRIEFeeExclTax) as number | null),
    getSource(ch?.quarterlyRIEFeeExclTax),
  ])
  rows.push([
    "Montant annuel de la redevance RIE au m² (en € et HT)",
    formatCurrency(getValue(ch?.annualRIEFeePerSqmExclTax) as number | null),
    getSource(ch?.annualRIEFeePerSqmExclTax),
  ])
  const managementFees = getValue(ch?.managementFeesOnTenant)
  const managementFeesDisplay =
    managementFees === null ? NON_MENTIONNE : managementFees ? "Oui" : "Non"
  rows.push([
    "Honoraires de gestion locative et technique à la charge du preneur",
    managementFeesDisplay,
    getSource(ch?.managementFeesOnTenant),
  ])
  rows.push([
    "Montant annuel des honoraires de gestion locative et technique (en € et HT)",
    formatCurrency(getValue(ch?.managementFeesAnnualAmount) as number | null),
    getSource(ch?.managementFeesAnnualAmount),
  ])
  rows.push([
    "Montant trimestriel des honoraires de gestion locative et technique (en € et HT)",
    formatCurrency(
      getValue(ch?.managementFeesQuarterlyAmount) as number | null
    ),
    getSource(ch?.managementFeesQuarterlyAmount),
  ])
  rows.push([
    "Montant des honoraires de gestion locative et technique au m² (en € et HT)",
    formatCurrency(getValue(ch?.managementFeesPerSqmAmount) as number | null),
    getSource(ch?.managementFeesPerSqmAmount),
  ])

  // 10. Assurances et recours
  rows.push(["10. Assurances et recours", "", ""])
  const insurancePremiumRebilled = getValue(ins?.insurancePremiumRebilled)
  const insurancePremiumRebilledDisplay =
    insurancePremiumRebilled === null
      ? NON_MENTIONNE
      : insurancePremiumRebilled
        ? "Oui"
        : "Non"
  rows.push([
    "Refacturation des primes d'assurance immeuble au preneur",
    insurancePremiumRebilledDisplay,
    getSource(ins?.insurancePremiumRebilled),
  ])

  const insuranceCertificate = getValue(ins?.insuranceCertificateAnnexed)
  const insuranceCertificateDisplay =
    insuranceCertificate === null
      ? NON_MENTIONNE
      : insuranceCertificate
        ? "Oui"
        : "Non"
  rows.push([
    "Attestation d'assurance du preneur annexée au bail (responsabilité civile)",
    insuranceCertificateDisplay,
    getSource(ins?.insuranceCertificateAnnexed),
  ])

  const waiverOfRecourse = getValue(ins?.hasWaiverOfRecourse)
  const waiverDisplay =
    waiverOfRecourse === null ? NON_MENTIONNE : waiverOfRecourse ? "Oui" : "Non"
  rows.push([
    "Clause de renonciation à recours réciproque",
    waiverDisplay,
    getSource(ins?.hasWaiverOfRecourse),
  ])

  // 11. Sûretés
  rows.push(["11. Sûretés", "", ""])
  rows.push([
    "Montant du dépôt de garantie (en €)",
    formatCurrency(getValue(sec?.securityDepositAmount) as number | null),
    getSources(sec?.securityDepositDescription, sec?.securityDepositAmount),
  ])
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
  rows.push([
    "Autres types de sûretés",
    otherSecuritiesDisplay,
    getSource(sec?.otherSecurities),
  ])

  // 12. Etats des lieux
  rows.push(["12. Etats des lieux", "", ""])
  rows.push([
    "Conditions de l'état des lieux d'entrée",
    fmt(getValue(inv?.entryInventoryConditions)),
    getSource(inv?.entryInventoryConditions),
  ])
  const hasPreExitInventory = getValue(inv?.hasPreExitInventory)
  const preExitDisplay =
    hasPreExitInventory === null
      ? NON_MENTIONNE
      : hasPreExitInventory
        ? `Oui. ${fmt(getValue(inv?.preExitInventoryConditions))}`
        : "Non"
  rows.push([
    "Existence d'un pré-état des lieux de sortie",
    preExitDisplay,
    getSources(inv?.hasPreExitInventory, inv?.preExitInventoryConditions),
  ])
  rows.push([
    "Conditions de l'état des lieux de sortie",
    fmt(getValue(inv?.exitInventoryConditions)),
    getSource(inv?.exitInventoryConditions),
  ])

  // 13. Entretien et travaux
  rows.push(["13. Entretien et travaux relatifs aux locaux loués", "", ""])
  rows.push([
    "Conditions d'entretien et de maintenance des locaux par le preneur",
    fmt(getValue(maint?.tenantMaintenanceConditions)),
    getSource(maint?.tenantMaintenanceConditions),
  ])
  rows.push([
    "Liste des travaux à la charge du bailleur",
    Array.isArray(getValue(maint?.landlordWorksList))
      ? (getValue(maint?.landlordWorksList) as string[]).join(", ")
      : fmt(getValue(maint?.landlordWorksList)),
    getSource(maint?.landlordWorksList),
  ])
  rows.push([
    "Liste des travaux à la charge du preneur",
    Array.isArray(getValue(maint?.tenantWorksList))
      ? (getValue(maint?.tenantWorksList) as string[]).join(", ")
      : fmt(getValue(maint?.tenantWorksList)),
    getSource(maint?.tenantWorksList),
  ])
  const hasAccessionClause = getValue(maint?.hasAccessionClause)
  const accessionDisplay =
    hasAccessionClause === null
      ? NON_MENTIONNE
      : hasAccessionClause === true
        ? "Oui"
        : "Non"
  rows.push([
    "Clause d'accession",
    accessionDisplay,
    getSource(maint?.hasAccessionClause),
  ])

  // 14. Restitution
  rows.push(["14. Restitution des locaux loués", "", ""])
  rows.push([
    "Conditions de restitution des locaux",
    fmt(getValue(rest?.restitutionConditions)),
    getSource(rest?.restitutionConditions),
  ])
  rows.push([
    "Conditions de remise en état des locaux",
    fmt(getValue(rest?.restorationConditions)),
    getSource(rest?.restorationConditions),
  ])

  // 15. Cession - Sous-location
  rows.push(["15. Cession - Sous-location", "", ""])
  rows.push([
    "Conditions de sous-location",
    fmt(getValue(trans?.sublettingConditions)),
    getSource(trans?.sublettingConditions),
  ])
  rows.push([
    "Conditions de cession du bail",
    fmt(getValue(trans?.assignmentConditions)),
    getSource(trans?.assignmentConditions),
  ])
  const divisionPossible = getValue(trans?.divisionPossible)
  const divisionDisplay =
    divisionPossible === null ? NON_MENTIONNE : divisionPossible ? "Oui" : "Non"
  rows.push([
    "Possibilité de division des locaux",
    divisionDisplay,
    getSource(trans?.divisionPossible),
  ])

  // 16. Annexes
  rows.push(["16. Annexes", "", ""])
  rows.push(["16.1 Annexes environnementales", "", ""])
  const hasDPE = getValue(env?.hasDPE)
  const dpeDisplay =
    hasDPE === null
      ? NON_MENTIONNE
      : hasDPE
        ? `Oui${getValue(env?.dpeNote) ? ` (Classe ${getValue(env?.dpeNote)})` : ""}`
        : "Non"
  rows.push([
    "Diagnostic de performance énergétique (DPE)",
    dpeDisplay,
    getSources(env?.hasDPE, env?.dpeNote),
  ])

  const hasAsbestos = getValue(env?.hasAsbestosDiagnostic)
  const asbestosDisplay =
    hasAsbestos === null ? NON_MENTIONNE : hasAsbestos ? "Oui" : "Non"
  rows.push([
    "Diagnostic amiante (obligatoire pour les immeubles construits avant le 1er juillet 1997)",
    asbestosDisplay,
    getSource(env?.hasAsbestosDiagnostic),
  ])

  const hasEnvironmentalAnnex = getValue(env?.hasEnvironmentalAnnex)
  const environmentalAnnexDisplay =
    hasEnvironmentalAnnex === null
      ? NON_MENTIONNE
      : hasEnvironmentalAnnex
        ? "Oui"
        : "Non"
  rows.push([
    "Annexe environnementale (si locaux supérieurs à 2000 m²)",
    environmentalAnnexDisplay,
    getSource(env?.hasEnvironmentalAnnex),
  ])

  const hasRiskStatement = getValue(env?.hasRiskAndPollutionStatement)
  const riskDisplay =
    hasRiskStatement === null ? NON_MENTIONNE : hasRiskStatement ? "Oui" : "Non"
  rows.push([
    "Etat des risques et pollutions",
    riskDisplay,
    getSource(env?.hasRiskAndPollutionStatement),
  ])

  rows.push(["16.2 Autres annexes", "", ""])
  const hasInternalRegulations = getValue(ann?.hasInternalRegulations)
  const internalRegulationsDisplay =
    hasInternalRegulations === null
      ? NON_MENTIONNE
      : hasInternalRegulations
        ? "Oui"
        : "Non"
  rows.push([
    "Règlement de copropriété / intérieur",
    internalRegulationsDisplay,
    getSource(ann?.hasInternalRegulations),
  ])

  const hasPremisesPlan = getValue(ann?.hasPremisesPlan)
  const premisesPlanDisplay =
    hasPremisesPlan === null ? NON_MENTIONNE : hasPremisesPlan ? "Oui" : "Non"
  rows.push([
    "Plan des locaux",
    premisesPlanDisplay,
    getSource(ann?.hasPremisesPlan),
  ])

  const hasChargesInventory = getValue(ann?.hasChargesInventory)
  const chargesInventoryDisplay =
    hasChargesInventory === null
      ? NON_MENTIONNE
      : hasChargesInventory
        ? "Oui"
        : "Non"
  rows.push([
    "Inventaire précis et limitatif des catégories de charges, impôts, taxes et redevances liés au bail",
    chargesInventoryDisplay,
    getSource(ann?.hasChargesInventory),
  ])

  const hasAnnualChargesSummary = getValue(ann?.hasAnnualChargesSummary)
  const annualChargesSummaryDisplay =
    hasAnnualChargesSummary === null
      ? NON_MENTIONNE
      : hasAnnualChargesSummary
        ? "Oui"
        : "Non"
  rows.push([
    "Etat récapitulatif annuel des catégories de charges, impôts, taxes et redevances",
    annualChargesSummaryDisplay,
    getSource(ann?.hasAnnualChargesSummary),
  ])

  const hasThreeYearBudget = getValue(ann?.hasThreeYearWorksBudget)
  const threeYearBudgetDisplay =
    hasThreeYearBudget === null
      ? NON_MENTIONNE
      : hasThreeYearBudget
        ? "Oui"
        : "Non"
  rows.push([
    "Etat et budget prévisionnel des travaux dans les trois prochaines années",
    threeYearBudgetDisplay,
    getSource(ann?.hasThreeYearWorksBudget),
  ])

  const hasPastWorksSummary = getValue(ann?.hasPastWorksSummary)
  const pastWorksSummaryDisplay =
    hasPastWorksSummary === null
      ? NON_MENTIONNE
      : hasPastWorksSummary
        ? "Oui"
        : "Non"
  rows.push([
    "Etat récapitulatif des travaux passés",
    pastWorksSummaryDisplay,
    getSource(ann?.hasPastWorksSummary),
  ])

  // 17. Autres
  rows.push(["17. Autres", "", ""])
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
  rows.push([
    "Liste des dérogations au code civil",
    civilCodeDisplay,
    getSource(other?.civilCodeDerogations),
  ])

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
  rows.push([
    "Liste des dérogations au code du commerce",
    commercialCodeDisplay,
    getSource(other?.commercialCodeDerogations),
  ])

  return rows
}

async function createWorkbook(
  extraction: LeaseExtractionResult
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet("Template livrable audit bail")

  const data = buildExportData(extraction)

  // Set column widths to match template
  worksheet.columns = [
    { width: 65 }, // A: Thèmes
    { width: 80 }, // B: Extraction
    { width: 40 }, // C: Sources
  ]

  // Define border style
  const thinBorder: Partial<ExcelJS.Border> = {
    style: "thin",
    color: { argb: "FF000000" },
  }

  const allBorders: Partial<ExcelJS.Borders> = {
    top: thinBorder,
    left: thinBorder,
    bottom: thinBorder,
    right: thinBorder,
  }

  // Apply data and formatting row by row
  data.forEach((row, rowIndex) => {
    const excelRow = worksheet.getRow(rowIndex + 1)
    const firstCellValue = String(row[0] ?? "")
    const isHeaderRow = rowIndex === 0
    const isSectionHeader = /^\d+\.\s/.test(firstCellValue)

    // Set row-level properties
    if (isHeaderRow) {
      excelRow.height = 20
      excelRow.font = { bold: true, size: 11 }
      excelRow.alignment = {
        vertical: "middle",
        horizontal: "center",
        wrapText: true,
      }
      excelRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE7E6E6" },
      }
    } else if (isSectionHeader) {
      excelRow.height = 20
      excelRow.font = { bold: true, size: 11 }
      excelRow.alignment = {
        vertical: "middle",
        horizontal: "left",
        wrapText: true,
      }
      excelRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF2F2F2" },
      }
    } else {
      excelRow.height = 18
      excelRow.alignment = {
        vertical: "top",
        horizontal: "left",
        wrapText: true,
      }
    }

    // Apply cell values and borders
    row.forEach((cellValue, colIndex) => {
      const cell = excelRow.getCell(colIndex + 1)
      cell.value = cellValue ?? ""
      cell.border = allBorders

      // Override alignment for header row cells (center)
      if (isHeaderRow) {
        cell.alignment = {
          vertical: "middle",
          horizontal: "center",
          wrapText: true,
        }
      }
    })
  })

  // Freeze header row
  worksheet.views = [{ state: "frozen", ySplit: 1 }]

  return workbook
}

export async function exportExtractionToExcel(
  extraction: LeaseExtractionResult
): Promise<void> {
  const workbook = await createWorkbook(extraction)
  const fileName = extraction.fileName?.replace(/\.pdf$/i, "") || "bail"

  // Use writeBuffer for browser compatibility (writeFile uses Node.js streams)
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })

  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `${fileName}-extraction.xlsx`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export async function exportExtractionToExcelBuffer(
  extraction: LeaseExtractionResult
): Promise<Buffer> {
  const workbook = await createWorkbook(extraction)
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
