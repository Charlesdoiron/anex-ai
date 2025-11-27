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

function fmt(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "boolean") return value ? "Oui" : "Non"
  if (typeof value === "number") return String(value)
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : ""
  if (typeof value === "object" && "value" in value) {
    return fmt((value as { value: unknown }).value)
  }
  if (typeof value === "object") return ""
  return String(value)
}

function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return ""
  try {
    const date = new Date(isoDate)
    return date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  } catch {
    return String(isoDate)
  }
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return ""
  return `${value.toLocaleString("fr-FR")} €`
}

function formatSurface(value: number | null | undefined): string {
  if (value === null || value === undefined) return ""
  return `${value.toLocaleString("fr-FR")} m²`
}

function formatUnits(value: number | null | undefined, unit: string): string {
  if (value === null || value === undefined) return ""
  return `${value} ${unit}`
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

  // Header row
  rows.push(["Thèmes", "Bail", "", "", "", "Avenant"])

  // 1. Régime du Bail
  rows.push(["1. Régime du Bail", "", "", "", "", ""])
  rows.push([
    "Régime juridique",
    fmt(getValue(extraction.regime?.regime)),
    "",
    "",
    "",
    "",
  ])

  // 2. Parties
  rows.push(["2. Parties", "", "", "", "", ""])
  rows.push([
    "Bailleur",
    `Nom : ${fmt(getValue(p?.landlord?.name))}`,
    `SIREN : ${fmt(getValue(p?.landlord?.siren))}`,
    `Courriel et téléphone : ${[fmt(getValue(p?.landlord?.email)), fmt(getValue(p?.landlord?.phone))].filter(Boolean).join(" / ")}`,
    `Adresse : ${fmt(getValue(p?.landlord?.address))}`,
    "",
  ])
  rows.push([
    "Représentant du bailleur (le cas échéant)",
    p?.landlordRepresentative
      ? `Nom : ${fmt(getValue(p?.landlordRepresentative?.name))}`
      : "",
    p?.landlordRepresentative
      ? `SIREN : ${fmt(getValue(p?.landlordRepresentative?.siren))}`
      : "",
    p?.landlordRepresentative
      ? `Courriel et téléphone : ${[fmt(getValue(p?.landlordRepresentative?.email)), fmt(getValue(p?.landlordRepresentative?.phone))].filter(Boolean).join(" / ")}`
      : "",
    p?.landlordRepresentative
      ? `Adresse : ${fmt(getValue(p?.landlordRepresentative?.address))}`
      : "",
    "",
  ])
  rows.push([
    "Preneur",
    `Nom : ${fmt(getValue(p?.tenant?.name))}`,
    `SIREN : ${fmt(getValue(p?.tenant?.siren))}`,
    `Courriel et téléphone : ${[fmt(getValue(p?.tenant?.email)), fmt(getValue(p?.tenant?.phone))].filter(Boolean).join(" / ")}`,
    `Adresse : ${fmt(getValue(p?.tenant?.address))}`,
    "",
  ])

  // 3. Description des locaux loués
  rows.push(["3. Description des locaux loués", "", "", "", "", ""])
  rows.push([
    "Destination des locaux",
    fmt(getValue(pr?.purpose)),
    "",
    "",
    "",
    "",
  ])
  rows.push(["Adresse des locaux", fmt(getValue(pr?.address)), "", "", "", ""])
  rows.push([
    "Année de construction de l'immeuble",
    fmt(getValue(pr?.buildingYear)),
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Etage(s) des locaux",
    Array.isArray(getValue(pr?.floors))
      ? (getValue(pr?.floors) as string[]).join(", ")
      : fmt(getValue(pr?.floors)),
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Numéro(s) du/des lot(s)",
    Array.isArray(getValue(pr?.lotNumbers))
      ? (getValue(pr?.lotNumbers) as string[]).join(", ")
      : fmt(getValue(pr?.lotNumbers)),
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Surface (en m²)",
    formatSurface(getValue(pr?.surfaceArea) as number | null),
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Les locaux sont-ils cloisonnés ?",
    getValue(pr?.isPartitioned) !== null
      ? getValue(pr?.isPartitioned)
        ? "Oui"
        : "Non"
      : "",
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Les locaux sont-ils équipés avec du mobilier ?",
    getValue(pr?.hasFurniture) !== null
      ? getValue(pr?.hasFurniture)
        ? `Oui. ${fmt(getValue(pr?.furnishingConditions)) || ""}`
        : "Non"
      : "",
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Clause de garnissement des locaux",
    fmt(getValue(pr?.furnishingConditions)) || "Non mentionnée",
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Clause d'enseigne",
    fmt(getValue(pr?.signageConditions)) || "Non mentionnée",
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Existence d'un espace extérieur ?",
    getValue(pr?.hasOutdoorSpace) !== null
      ? getValue(pr?.hasOutdoorSpace)
        ? "Oui"
        : "Non"
      : "",
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Existence d'un local d'archive ?",
    getValue(pr?.hasArchiveSpace) !== null
      ? getValue(pr?.hasArchiveSpace)
        ? "Oui"
        : "Non"
      : "",
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Nombre d'emplacements de parkings (en unité)",
    formatUnits(getValue(pr?.parkingSpaces) as number | null, "u"),
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Quote-part de l'immeuble loué",
    `Incluant les parties communes : ${fmt(getValue(pr?.shareWithCommonAreas)) || "Non précisé"}`,
    "",
    `Hors parties communes : ${fmt(getValue(pr?.shareWithoutCommonAreas)) || "Non précisé"}`,
    "",
    "",
  ])

  // 4. Calendrier
  rows.push(["4. Calendrier", "", "", "", "", ""])
  rows.push([
    "Date de signature du bail",
    formatDate(getValue(c?.signatureDate) as string | null),
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Durée du bail",
    getValue(c?.duration) ? `${getValue(c?.duration)} ans` : "",
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Date de prise d'effet",
    formatDate(getValue(c?.effectiveDate) as string | null),
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Mise à disposition anticipée",
    getValue(c?.earlyAccessDate)
      ? formatDate(getValue(c?.earlyAccessDate) as string)
      : "Non",
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Prochaine(s) faculté(s) de résiliation/congé",
    formatDate(getValue(c?.nextTriennialDate) as string | null),
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Date de fin de bail",
    formatDate(getValue(c?.endDate) as string | null),
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Durée de préavis",
    fmt(getValue(c?.noticePeriod)),
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Conditions pour donner congé",
    fmt(getValue(c?.terminationConditions)),
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Conditions de renouvellement à l'échéance du bail",
    fmt(getValue(c?.renewalConditions)),
    "",
    "",
    "",
    "",
  ])

  // 5. Mesures d'accompagnement
  rows.push(["5. Mesures d'accompagnement", "", "", "", "", ""])
  rows.push([
    "Franchise de loyer",
    getValue(sm?.hasRentFreeperiod)
      ? `Oui. ${getValue(sm?.rentFreePeriodMonths) || ""} mois${getValue(sm?.rentFreePeriodAmount) ? `, soit ${formatCurrency(getValue(sm?.rentFreePeriodAmount) as number)} HTHC` : ""}`
      : "Non",
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Autres mesures d'accompagnement",
    getValue(sm?.hasOtherMeasures)
      ? `Oui. ${fmt(getValue(sm?.otherMeasuresDescription))}`
      : "Non",
    "",
    "",
    "",
    "",
  ])

  // 6. Loyer
  rows.push(["6. Loyer", "", "", "", "", ""])
  rows.push([
    "Montant du loyer initial (en € et HTHC)",
    `Annuel : ${formatCurrency(getValue(r?.annualRentExclTaxExclCharges) as number | null)}`,
    "",
    `Trimestriel : ${formatCurrency(getValue(r?.quarterlyRentExclTaxExclCharges) as number | null)}`,
    "",
    "",
  ])
  rows.push([
    "Montant du loyer annuel initial au m² (en € et HTHC)",
    formatCurrency(
      getValue(r?.annualRentPerSqmExclTaxExclCharges) as number | null
    ),
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Montant du loyer initial des emplacements de parking (en € et HTHC)",
    `Annuel : ${formatCurrency(getValue(r?.annualParkingRentExclCharges) as number | null)}`,
    "",
    `Trimestriel : ${formatCurrency(getValue(r?.quarterlyParkingRentExclCharges) as number | null)}`,
    "",
    "",
  ])
  rows.push([
    "Montant du loyer annuel initial des emplacement de parkings par unité (en € et HTHC)",
    formatCurrency(
      getValue(r?.annualParkingRentPerUnitExclCharges) as number | null
    ),
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Soumission du loyer à la TVA",
    getValue(r?.isSubjectToVAT) !== null
      ? getValue(r?.isSubjectToVAT)
        ? "Oui"
        : "Non"
      : "",
    "",
    "",
    "",
    "",
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
    "",
    "",
    "",
    "",
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
      .join(". ") || "",
    "",
    "",
    "",
    "",
  ])

  // 7. Indexation
  rows.push(["7. Indexation", "", "", "", "", ""])
  rows.push([
    "Clause d'indexation",
    getValue(idx?.indexationClause) ? "Oui" : "Non",
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Choix de l'indice d'indexation",
    fmt(getValue(idx?.indexationType)),
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Trimestre de référence de l'indice",
    fmt(getValue(idx?.referenceQuarter)),
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Date de la première indexation",
    formatDate(getValue(idx?.firstIndexationDate) as string | null),
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Périodicité de l'indexation",
    getValue(idx?.indexationFrequency) === "annual"
      ? "Annuel"
      : getValue(idx?.indexationFrequency) === "quarterly"
        ? "Trimestriel"
        : fmt(getValue(idx?.indexationFrequency)),
    "",
    "",
    "",
    "",
  ])

  // 8. Impôts et taxes
  rows.push(["8. Impôts et taxes", "", "", "", "", ""])
  rows.push([
    "Refacturation de la taxe foncière et de la TEOM au preneur",
    getValue(tx?.propertyTaxRebilled) !== null
      ? getValue(tx?.propertyTaxRebilled)
        ? "Oui"
        : "Non"
      : "",
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Montant annuel de la taxe foncière (en €)",
    formatCurrency(getValue(tx?.propertyTaxAmount) as number | null),
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Montant annuel de la TEOM (en €)",
    formatCurrency(getValue(tx?.teomAmount) as number | null),
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Montant annuel de la taxe sur les bureaux et les locaux commerciaux et de stockages (en €)",
    formatCurrency(getValue(tx?.officeTaxAmount) as number | null),
    "",
    "",
    "",
    "",
  ])

  // 9. Charges et honoraires
  rows.push(["9. Charges et honoraires", "", "", "", "", ""])
  rows.push([
    "Montant des provisions pour charges (en € et HT)",
    `Annuel : ${formatCurrency(getValue(ch?.annualChargesProvisionExclTax) as number | null)}`,
    "",
    `Trimestriel : ${formatCurrency(getValue(ch?.quarterlyChargesProvisionExclTax) as number | null)}`,
    "",
    "",
  ])
  rows.push([
    "Montant annuel des provisions pour charges au m² (en € et HT)",
    formatCurrency(
      getValue(ch?.annualChargesProvisionPerSqmExclTax) as number | null
    ),
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Montant de la redevance RIE (en € et HT)",
    `Annuel : ${formatCurrency(getValue(ch?.annualRIEFeeExclTax) as number | null)}`,
    "",
    `Trimestriel : ${formatCurrency(getValue(ch?.quarterlyRIEFeeExclTax) as number | null)}`,
    "",
    "",
  ])
  rows.push([
    "Montant annuel de la redevance RIE au m² (en € et HT)",
    formatCurrency(getValue(ch?.annualRIEFeePerSqmExclTax) as number | null),
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Honoraires de gestion locative et technique à la charge du preneur",
    getValue(ch?.managementFeesOnTenant) !== null
      ? getValue(ch?.managementFeesOnTenant)
        ? "Oui"
        : "Non"
      : "",
    "",
    "",
    "",
    "",
  ])

  // 10. Assurances et recours
  rows.push(["10. Assurances et recours", "", "", "", "", ""])
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
  rows.push([
    "Refacturation des primes d'assurance au preneur",
    getValue(ins?.insurancePremiumRebilled) !== null
      ? getValue(ins?.insurancePremiumRebilled)
        ? "Oui"
        : "Non"
      : "",
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Attestation d'assurance annexée au bail",
    getValue(ins?.insuranceCertificateAnnexed) !== null
      ? getValue(ins?.insuranceCertificateAnnexed)
        ? "Oui"
        : "Non"
      : "",
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Clause de renonciation réciproque à recours",
    getValue(ins?.hasWaiverOfRecourse) !== null
      ? getValue(ins?.hasWaiverOfRecourse)
        ? "Oui"
        : "Non"
      : "",
    "",
    "",
    "",
    "",
  ])

  // 11. Sûretés
  rows.push(["11. Sûretés", "", "", "", "", ""])
  rows.push([
    "Montant du dépôt de garantie (en €)",
    formatCurrency(getValue(sec?.securityDepositAmount) as number | null),
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Autres types de sûretés",
    Array.isArray(getValue(sec?.otherSecurities))
      ? (getValue(sec?.otherSecurities) as string[]).join(", ") || "Non"
      : fmt(getValue(sec?.otherSecurities)) || "Non",
    "",
    "",
    "",
    "",
  ])

  // 12. Etats des lieux
  rows.push(["12. Etats des lieux", "", "", "", "", ""])
  rows.push([
    "Conditions de l'état des lieux d'entrée",
    fmt(getValue(inv?.entryInventoryConditions)),
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Existence d'un pré-état des lieux de sortie",
    getValue(inv?.hasPreExitInventory) !== null
      ? getValue(inv?.hasPreExitInventory)
        ? `Oui. ${fmt(getValue(inv?.preExitInventoryConditions))}`
        : "Non"
      : "",
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
  rows.push([
    "Clause d'accession",
    getValue(maint?.hasAccessionClause) !== null
      ? getValue(maint?.hasAccessionClause)
        ? `Oui. ${fmt(getValue(maint?.workConditionsImposedOnTenant))}`
        : "Non"
      : "",
    "",
    "",
    "",
    "",
  ])

  // 14. Restitution
  rows.push(["14. Restitution des locaux loués", "", "", "", "", ""])
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
  rows.push(["15. Cession - Sous-location", "", "", "", "", ""])
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
      ? `Identité sous-locataire : ${subleaseInfo.subtenantName || ""}`
      : "",
    subleaseInfo
      ? `Date d'effet : ${formatDate(subleaseInfo.effectiveDate)}`
      : "",
    subleaseInfo
      ? `Prochaine(s) faculté(s) de résiliation/congé : ${formatDate(subleaseInfo.nextTerminationDate)}`
      : "",
    subleaseInfo
      ? `Date de fin du bail de sous-location : ${formatDate(subleaseInfo.endDate)}`
      : "",
    "",
  ])
  rows.push([
    "Conditions de cession du bail",
    fmt(getValue(trans?.assignmentConditions)),
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Possibilité de division des locaux",
    getValue(trans?.divisionPossible) !== null
      ? getValue(trans?.divisionPossible)
        ? "Oui"
        : "Non"
      : "",
    "",
    "",
    "",
    "",
  ])

  // 16. Annexes
  rows.push(["16. Annexes", "", "", "", "", ""])
  rows.push(["16.1 Annexes environnementales", "", "", "", "", ""])
  rows.push([
    "Diagnostic de performance énergétique (DPE)",
    getValue(env?.hasDPE) !== null
      ? getValue(env?.hasDPE)
        ? `Oui${getValue(env?.dpeNote) ? ` (Classe ${getValue(env?.dpeNote)})` : ""}`
        : "Non"
      : "",
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Diagnostic amiante (obligatoire pour les immeubles construits avant le 1er juillet 1997)",
    getValue(env?.hasAsbestosDiagnostic) !== null
      ? getValue(env?.hasAsbestosDiagnostic)
        ? "Oui"
        : "Non"
      : "",
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Annexe environnementale (si locaux supérieurs à 2000 m²)",
    getValue(env?.hasEnvironmentalAnnex) !== null
      ? getValue(env?.hasEnvironmentalAnnex)
        ? "Oui"
        : "Non"
      : "",
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Etat des risques et pollutions (daté de moins de 6 mois)",
    getValue(env?.hasRiskAndPollutionStatement) !== null
      ? getValue(env?.hasRiskAndPollutionStatement)
        ? "Oui"
        : "Non"
      : "",
    "",
    "",
    "",
    "",
  ])

  rows.push(["16.2 Autres annexes", "", "", "", "", ""])
  rows.push([
    "Règlement intérieur",
    getValue(ann?.hasInternalRegulations) !== null
      ? getValue(ann?.hasInternalRegulations)
        ? "Oui"
        : "Non"
      : "",
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Plan des locaux",
    getValue(ann?.hasPremisesPlan) !== null
      ? getValue(ann?.hasPremisesPlan)
        ? "Oui"
        : "Non"
      : "",
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Inventaire précis et limitatif des catégories de charges, impôts, taxes et redevances liés au bail",
    getValue(ann?.hasChargesInventory) !== null
      ? getValue(ann?.hasChargesInventory)
        ? "Oui"
        : "Non"
      : "",
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Etat récapitulatif annuel des catégories de charges, impôts, taxes et redevances",
    getValue(ann?.hasAnnualChargesSummary) !== null
      ? getValue(ann?.hasAnnualChargesSummary)
        ? "Oui"
        : "Non"
      : "",
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Etat et budget prévisionnel des travaux dans les trois prochaines années",
    getValue(ann?.hasThreeYearWorksBudget) !== null
      ? getValue(ann?.hasThreeYearWorksBudget)
        ? "Oui"
        : "Non"
      : "",
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Etat récapitulatif des travaux passés",
    getValue(ann?.hasPastWorksSummary) !== null
      ? getValue(ann?.hasPastWorksSummary)
        ? "Oui"
        : "Non"
      : "",
    "",
    "",
    "",
    "",
  ])

  // 17. Autres
  rows.push(["17. Autres", "", "", "", "", ""])
  rows.push([
    "Bail signé et paraphé par les parties",
    getValue(other?.isSignedAndInitialed) !== null
      ? getValue(other?.isSignedAndInitialed)
        ? "Oui"
        : "Non"
      : "",
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Liste des dérogations au code civil",
    Array.isArray(getValue(other?.civilCodeDerogations))
      ? (getValue(other?.civilCodeDerogations) as string[]).join(", ") ||
        "Aucune"
      : fmt(getValue(other?.civilCodeDerogations)) || "Aucune",
    "",
    "",
    "",
    "",
  ])
  rows.push([
    "Liste des dérogations au code du commerce",
    Array.isArray(getValue(other?.commercialCodeDerogations))
      ? (getValue(other?.commercialCodeDerogations) as string[]).join(", ") ||
        "Aucune"
      : fmt(getValue(other?.commercialCodeDerogations)) || "Aucune",
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
    { width: 35 }, // B: Bail value
    { width: 25 }, // C: Sub-value
    { width: 35 }, // D: Sub-value
    { width: 30 }, // E: Sub-value
    { width: 20 }, // F: Avenant
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
