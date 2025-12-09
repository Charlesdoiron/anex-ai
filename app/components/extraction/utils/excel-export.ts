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

  // Header row - 2 colonnes seulement
  rows.push(["Thèmes", "Extraction"])

  // 1. Régime du Bail
  rows.push(["1. Régime du Bail", ""])
  rows.push(["Régime juridique", fmt(getValue(extraction.regime?.regime))])

  // 2. Parties - format avec sauts de ligne
  rows.push(["2. Parties", ""])
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
  ])

  // 3. Description des locaux loués
  rows.push(["3. Description des locaux loués", ""])
  rows.push(["Destination des locaux", fmt(getValue(pr?.purpose))])
  rows.push(["Adresse des locaux", fmt(getValue(pr?.address))])
  rows.push([
    "Année de construction de l'immeuble",
    fmt(getValue(pr?.buildingYear)),
  ])
  rows.push([
    "Etage(s) des locaux",
    Array.isArray(getValue(pr?.floors))
      ? (getValue(pr?.floors) as string[]).join(", ")
      : fmt(getValue(pr?.floors)),
  ])
  rows.push([
    "Numéro(s) du/des lot(s)",
    Array.isArray(getValue(pr?.lotNumbers))
      ? (getValue(pr?.lotNumbers) as string[]).join(", ")
      : fmt(getValue(pr?.lotNumbers)),
  ])
  rows.push([
    "Surface (en m²)",
    formatSurface(getValue(pr?.surfaceArea) as number | null),
  ])
  const isPartitioned = getValue(pr?.isPartitioned)
  const isPartitionedDisplay =
    isPartitioned === null ? NON_MENTIONNE : isPartitioned ? "Oui" : "Non"
  rows.push(["Les locaux sont-ils cloisonnés ?", isPartitionedDisplay])

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
  ])
  rows.push([
    "Clause de garnissement des locaux",
    fmt(getValue(pr?.furnishingConditions)),
  ])
  rows.push(["Clause d'enseigne", fmt(getValue(pr?.signageConditions))])

  const hasOutdoorSpace = getValue(pr?.hasOutdoorSpace)
  const outdoorDisplay =
    hasOutdoorSpace === null ? NON_MENTIONNE : hasOutdoorSpace ? "Oui" : "Non"
  rows.push(["Existence d'un espace extérieur ?", outdoorDisplay])

  const hasArchiveSpace = getValue(pr?.hasArchiveSpace)
  const archiveDisplay =
    hasArchiveSpace === null ? NON_MENTIONNE : hasArchiveSpace ? "Oui" : "Non"
  rows.push(["Existence d'un local d'archive ?", archiveDisplay])
  rows.push([
    "Nombre d'emplacements de parkings (en unité)",
    formatUnits(getValue(pr?.parkingSpaces) as number | null, "u"),
  ])
  rows.push([
    "Quote-part de l'immeuble loué",
    [
      `Incluant les parties communes : ${fmt(getValue(pr?.shareWithCommonAreas))}`,
      `Hors parties communes : ${fmt(getValue(pr?.shareWithoutCommonAreas))}`,
    ].join("\n"),
  ])

  // 4. Calendrier
  rows.push(["4. Calendrier", ""])
  rows.push([
    "Date de signature du bail",
    formatDate(getValue(c?.signatureDate) as string | null),
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

  rows.push(["Durée du bail", durationDisplay])
  rows.push([
    "Date de prise d'effet",
    formatDate(getValue(c?.effectiveDate) as string | null),
  ])
  rows.push([
    "Mise à disposition anticipée",
    getValue(c?.earlyAccessDate)
      ? formatDate(getValue(c?.earlyAccessDate) as string)
      : NON_MENTIONNE,
  ])
  rows.push([
    "Prochaine(s) faculté(s) de résiliation/congé",
    formatDate(getValue(c?.nextTriennialDate) as string | null),
  ])
  rows.push([
    "Date de fin de bail",
    formatDate(getValue(c?.endDate) as string | null),
  ])
  rows.push(["Durée de préavis", fmt(getValue(c?.noticePeriod))])
  rows.push([
    "Conditions pour donner congé",
    fmt(getValue(c?.terminationConditions)),
  ])
  rows.push([
    "Conditions de renouvellement à l'échéance du bail",
    fmt(getValue(c?.renewalConditions)),
  ])

  // 5. Mesures d'accompagnement
  rows.push(["5. Mesures d'accompagnement", ""])
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
  rows.push(["Franchise de loyer", rentFreeDisplay])

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
  rows.push(["Autres mesures d'accompagnement", otherMeasuresDisplay])

  // 6. Loyer
  rows.push(["6. Loyer", ""])
  rows.push([
    "Montant du loyer initial annuel (en € et HTHC)",
    formatCurrency(getValue(r?.annualRentExclTaxExclCharges) as number | null),
  ])
  rows.push([
    "Montant du loyer initial trimestriel (en € et HTHC)",
    formatCurrency(
      getValue(r?.quarterlyRentExclTaxExclCharges) as number | null
    ),
  ])
  rows.push([
    "Montant du loyer annuel initial au m² (en € et HTHC)",
    formatCurrency(
      getValue(r?.annualRentPerSqmExclTaxExclCharges) as number | null
    ),
  ])
  rows.push([
    "Montant du loyer initial annuel des emplacements de parking (en € et HTHC)",
    formatCurrency(getValue(r?.annualParkingRentExclCharges) as number | null),
  ])
  rows.push([
    "Montant du loyer initial trimestriel des emplacements de parking (en € et HTHC)",
    formatCurrency(
      getValue(r?.quarterlyParkingRentExclCharges) as number | null
    ),
  ])
  rows.push([
    "Montant du loyer annuel initial des emplacements de parkings par unité (en € et HTHC)",
    formatCurrency(
      getValue(r?.annualParkingRentPerUnitExclCharges) as number | null
    ),
  ])
  const isSubjectToVAT = getValue(r?.isSubjectToVAT)
  const vatDisplay =
    isSubjectToVAT === null ? NON_MENTIONNE : isSubjectToVAT ? "Oui" : "Non"
  rows.push(["Soumission du loyer à la TVA", vatDisplay])
  rows.push([
    "Périodicité de facturation du loyer",
    getValue(r?.paymentFrequency) === "monthly"
      ? "Mensuel"
      : getValue(r?.paymentFrequency) === "quarterly"
        ? "Trimestriel"
        : getValue(r?.paymentFrequency) === "annual"
          ? "Annuel"
          : fmt(getValue(r?.paymentFrequency)),
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
  ])

  // 7. Indexation
  rows.push(["7. Indexation", ""])
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

  rows.push(["Clause d'indexation", indexationDisplay])
  rows.push([
    "Choix de l'indice d'indexation",
    fmt(getValue(idx?.indexationType)),
  ])
  rows.push([
    "Trimestre de référence de l'indice",
    fmt(getValue(idx?.referenceQuarter)),
  ])
  // firstIndexationDate can be a recurring date string ("Le 19 décembre de chaque année") or ISO date
  const firstIndexDate = getValue(idx?.firstIndexationDate)
  const firstIndexDateDisplay =
    firstIndexDate === null || firstIndexDate === undefined
      ? NON_MENTIONNE
      : /^\d{4}-\d{2}-\d{2}/.test(String(firstIndexDate))
        ? formatDate(String(firstIndexDate))
        : String(firstIndexDate)

  rows.push(["Date de l'indexation", firstIndexDateDisplay])
  rows.push([
    "Périodicité de l'indexation",
    getValue(idx?.indexationFrequency) === "annual"
      ? "Annuellement"
      : getValue(idx?.indexationFrequency) === "quarterly"
        ? "Trimestriellement"
        : fmt(getValue(idx?.indexationFrequency)),
  ])

  // 8. Impôts et taxes
  rows.push(["8. Impôts et taxes", ""])
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
  ])
  rows.push([
    "Montant annuel de la provision pour taxe foncière (en €)",
    formatCurrency(getValue(tx?.propertyTaxAmount) as number | null),
  ])
  rows.push([
    "Montant annuel de la provision pour TEOM (en €)",
    formatCurrency(getValue(tx?.teomAmount) as number | null),
  ])
  rows.push([
    "Montant annuel de la provision pour taxe sur les bureaux et les locaux commerciaux et de stockages (en €)",
    formatCurrency(getValue(tx?.officeTaxAmount) as number | null),
  ])

  // 9. Charges et honoraires
  rows.push(["9. Charges locatives et honoraires", ""])
  rows.push([
    "Montant annuel des provisions pour charges (en € et HT)",
    formatCurrency(
      getValue(ch?.annualChargesProvisionExclTax) as number | null
    ),
  ])
  rows.push([
    "Montant trimestriel des provisions pour charges (en € et HT)",
    formatCurrency(
      getValue(ch?.quarterlyChargesProvisionExclTax) as number | null
    ),
  ])
  rows.push([
    "Montant annuel des provisions pour charges au m² (en € et HT)",
    formatCurrency(
      getValue(ch?.annualChargesProvisionPerSqmExclTax) as number | null
    ),
  ])
  rows.push([
    "Montant annuel de la redevance RIE (en € et HT)",
    formatCurrency(getValue(ch?.annualRIEFeeExclTax) as number | null),
  ])
  rows.push([
    "Montant trimestriel de la redevance RIE (en € et HT)",
    formatCurrency(getValue(ch?.quarterlyRIEFeeExclTax) as number | null),
  ])
  rows.push([
    "Montant annuel de la redevance RIE au m² (en € et HT)",
    formatCurrency(getValue(ch?.annualRIEFeePerSqmExclTax) as number | null),
  ])
  const managementFees = getValue(ch?.managementFeesOnTenant)
  const managementFeesDisplay =
    managementFees === null ? NON_MENTIONNE : managementFees ? "Oui" : "Non"
  rows.push([
    "Honoraires de gestion locative et technique à la charge du preneur",
    managementFeesDisplay,
    "",
    "",
    "",
    "",
  ])

  // 10. Assurances et recours
  rows.push(["10. Assurances et recours", ""])
  rows.push([
    "Montant annuel des assurances (en € et HT)",
    formatCurrency(
      getValue(ins?.annualInsuranceAmountExclTax) as number | null
    ),
    "",
    "",
    "",
    "",
  ])
  const insurancePremiumRebilled = getValue(ins?.insurancePremiumRebilled)
  const insurancePremiumRebilledDisplay =
    insurancePremiumRebilled === null
      ? NON_MENTIONNE
      : insurancePremiumRebilled
        ? "Oui"
        : "Non"
  rows.push([
    "Refacturation des primes d'assurance au preneur",
    insurancePremiumRebilledDisplay,
    "",
    "",
    "",
    "",
  ])

  const insuranceCertificate = getValue(ins?.insuranceCertificateAnnexed)
  const insuranceCertificateDisplay =
    insuranceCertificate === null
      ? NON_MENTIONNE
      : insuranceCertificate
        ? "Oui"
        : "Non"
  rows.push([
    "Attestation d'assurance annexée au bail",
    insuranceCertificateDisplay,
    "",
    "",
    "",
    "",
  ])

  const waiverOfRecourse = getValue(ins?.hasWaiverOfRecourse)
  const waiverDisplay =
    waiverOfRecourse === null ? NON_MENTIONNE : waiverOfRecourse ? "Oui" : "Non"
  rows.push([
    "Clause de renonciation réciproque à recours",
    waiverDisplay,
    "",
    "",
    "",
    "",
  ])

  // 11. Sûretés
  rows.push(["11. Sûretés", ""])
  rows.push([
    "Montant du dépôt de garantie (en €)",
    formatCurrency(getValue(sec?.securityDepositAmount) as number | null),
    "",
    "",
    "",
    "",
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
  rows.push(["Autres types de sûretés", otherSecuritiesDisplay])

  // 12. Etats des lieux
  rows.push(["12. Etats des lieux", ""])
  rows.push([
    "Conditions de l'état des lieux d'entrée",
    fmt(getValue(inv?.entryInventoryConditions)),
    "",
    "",
    "",
    "",
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
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Conditions de l'état des lieux de sortie",
    fmt(getValue(inv?.exitInventoryConditions)),
    "",
    "",
    "",
    "",
  ])

  // 13. Entretien et travaux
  rows.push([
    "13. Entretien et travaux relatifs aux locaux loués",
    "",
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Conditions d'entretien et de maintenance des locaux par le preneur",
    fmt(getValue(maint?.tenantMaintenanceConditions)),
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Liste des travaux à la charge du bailleur",
    Array.isArray(getValue(maint?.landlordWorksList))
      ? (getValue(maint?.landlordWorksList) as string[]).join(", ")
      : fmt(getValue(maint?.landlordWorksList)),
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Liste des travaux à la charge du preneur",
    Array.isArray(getValue(maint?.tenantWorksList))
      ? (getValue(maint?.tenantWorksList) as string[]).join(", ")
      : fmt(getValue(maint?.tenantWorksList)),
    "",
    "",
    "",
    "",
  ])
  const hasAccessionClause = getValue(maint?.hasAccessionClause)
  const accessionDisplay =
    hasAccessionClause === null
      ? NON_MENTIONNE
      : hasAccessionClause
        ? `Oui. ${fmt(getValue(maint?.workConditionsImposedOnTenant))}`
        : "Non"
  rows.push(["Clause d'accession", accessionDisplay])

  // 14. Restitution
  rows.push(["14. Restitution des locaux loués", ""])
  rows.push([
    "Conditions de restitution des locaux",
    fmt(getValue(rest?.restitutionConditions)),
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Conditions de remise en état des locaux",
    fmt(getValue(rest?.restorationConditions)),
    "",
    "",
    "",
    "",
  ])

  // 15. Cession - Sous-location
  rows.push(["15. Cession - Sous-location", ""])
  rows.push([
    "Conditions de sous-location",
    fmt(getValue(trans?.sublettingConditions)),
    "",
    "",
    "",
    "",
  ])
  const subleaseInfo = getValue(trans?.currentSubleaseInfo)
  rows.push([
    "Si bail de sous-location en cours",
    subleaseInfo
      ? [
          `Identité sous-locataire : ${subleaseInfo.subtenantName || NON_MENTIONNE}`,
          `Date d'effet : ${formatDate(subleaseInfo.effectiveDate)}`,
          `Prochaine(s) faculté(s) de résiliation/congé : ${formatDate(subleaseInfo.nextTerminationDate)}`,
          `Date de fin du bail de sous-location : ${formatDate(subleaseInfo.endDate)}`,
        ].join("\n")
      : NON_MENTIONNE,
  ])
  rows.push([
    "Conditions de cession du bail",
    fmt(getValue(trans?.assignmentConditions)),
    "",
    "",
    "",
    "",
  ])
  const divisionPossible = getValue(trans?.divisionPossible)
  const divisionDisplay =
    divisionPossible === null ? NON_MENTIONNE : divisionPossible ? "Oui" : "Non"
  rows.push([
    "Possibilité de division des locaux",
    divisionDisplay,
    "",
    "",
    "",
    "",
  ])

  // 16. Annexes
  rows.push(["16. Annexes", ""])
  rows.push(["16.1 Annexes environnementales", ""])
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
    "",
    "",
    "",
    "",
  ])

  const hasAsbestos = getValue(env?.hasAsbestosDiagnostic)
  const asbestosDisplay =
    hasAsbestos === null ? NON_MENTIONNE : hasAsbestos ? "Oui" : "Non"
  rows.push([
    "Diagnostic amiante (obligatoire pour les immeubles construits avant le 1er juillet 1997)",
    asbestosDisplay,
    "",
    "",
    "",
    "",
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
    "",
    "",
    "",
    "",
  ])

  const hasRiskStatement = getValue(env?.hasRiskAndPollutionStatement)
  const riskDisplay =
    hasRiskStatement === null ? NON_MENTIONNE : hasRiskStatement ? "Oui" : "Non"
  rows.push([
    "Etat des risques et pollutions (daté de moins de 6 mois)",
    riskDisplay,
    "",
    "",
    "",
    "",
  ])

  rows.push(["16.2 Autres annexes", ""])
  const hasInternalRegulations = getValue(ann?.hasInternalRegulations)
  const internalRegulationsDisplay =
    hasInternalRegulations === null
      ? NON_MENTIONNE
      : hasInternalRegulations
        ? "Oui"
        : "Non"
  rows.push(["Règlement intérieur", internalRegulationsDisplay])

  const hasPremisesPlan = getValue(ann?.hasPremisesPlan)
  const premisesPlanDisplay =
    hasPremisesPlan === null ? NON_MENTIONNE : hasPremisesPlan ? "Oui" : "Non"
  rows.push(["Plan des locaux", premisesPlanDisplay])

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
    "",
    "",
    "",
    "",
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
    "",
    "",
    "",
    "",
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
    "",
    "",
    "",
    "",
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
    "",
    "",
    "",
    "",
  ])

  // 17. Autres
  rows.push(["17. Autres", ""])
  const isSignedAndInitialed = getValue(other?.isSignedAndInitialed)
  const signedDisplay =
    isSignedAndInitialed === null
      ? NON_MENTIONNE
      : isSignedAndInitialed
        ? "Oui"
        : "Non"
  rows.push([
    "Bail signé et paraphé par les parties",
    signedDisplay,
    "",
    "",
    "",
    "",
  ])
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
    "",
    "",
    "",
    "",
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
    "",
    "",
    "",
    "",
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
