import * as XLSX from "xlsx"
import type {
  LeaseExtractionResult,
  ExtractedValue,
} from "@/app/lib/extraction/types"

type ExcelRow = Record<string, string | number | boolean | null | undefined>

function getValue<T>(field: ExtractedValue<T> | undefined | null): T | null {
  if (!field) return null
  if (field.confidence === "missing") return null
  return field.value
}

function safeNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const parsed = parseFloat(value.replace(/[^\d.-]/g, ""))
    return isNaN(parsed) ? null : parsed
  }
  if (typeof value === "object" && value !== null && "value" in value) {
    return safeNumber((value as { value: unknown }).value)
  }
  return null
}

function safeString(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === "string") return value
  if (typeof value === "number") return String(value)
  if (typeof value === "object" && value !== null && "value" in value) {
    return safeString((value as { value: unknown }).value)
  }
  if (typeof value === "object") return null
  return String(value)
}

function fmt(value: unknown): string | number | null {
  if (value === null || value === undefined) return null
  if (typeof value === "boolean") return value ? "Oui" : "Non"
  if (typeof value === "number") return value
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : null
  if (typeof value === "object" && "value" in value) {
    return fmt((value as { value: unknown }).value)
  }
  if (typeof value === "object") return null
  return String(value)
}

function formatDate(isoDate: string | null): string | null {
  if (!isoDate) return null
  const dateStr = safeString(isoDate)
  if (!dateStr) return null
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  } catch {
    return dateStr
  }
}

function formatCurrency(value: number | null): string | null {
  const num = safeNumber(value)
  if (num === null) return null
  return `${num.toLocaleString("fr-FR")} €`
}

function setColumnWidths(worksheet: XLSX.WorkSheet, widths: number[]): void {
  worksheet["!cols"] = widths.map((w) => ({ wch: w }))
}

function buildSummarySheet(extraction: LeaseExtractionResult): ExcelRow[] {
  const p = extraction.parties
  const pr = extraction.premises
  const c = extraction.calendar
  const r = extraction.rent

  return [
    { " ": "INFORMATIONS GÉNÉRALES", "  ": "" },
    {
      " ": "Nom du fichier",
      "  ": extraction.fileName,
    },
    {
      " ": "Date d'extraction",
      "  ": formatDate(extraction.extractionDate),
    },
    {
      " ": "Régime du bail",
      "  ": fmt(getValue(extraction.regime?.regime)),
    },
    { " ": "", "  ": "" },
    { " ": "PARTIES", "  ": "" },
    {
      " ": "Bailleur",
      "  ": fmt(getValue(p?.landlord?.name)),
    },
    {
      " ": "Preneur",
      "  ": fmt(getValue(p?.tenant?.name)),
    },
    { " ": "", "  ": "" },
    { " ": "LOCAUX", "  ": "" },
    {
      " ": "Adresse",
      "  ": fmt(getValue(pr?.address)),
    },
    {
      " ": "Surface",
      "  ": getValue(pr?.surfaceArea)
        ? `${getValue(pr?.surfaceArea)} m²`
        : null,
    },
    { " ": "", "  ": "" },
    { " ": "DATES CLÉS", "  ": "" },
    {
      " ": "Date d'effet",
      "  ": formatDate(getValue(c?.effectiveDate) as string | null),
    },
    {
      " ": "Date de fin",
      "  ": formatDate(getValue(c?.endDate) as string | null),
    },
    {
      " ": "Durée",
      "  ": getValue(c?.duration) ? `${getValue(c?.duration)} ans` : null,
    },
    { " ": "", "  ": "" },
    { " ": "LOYER", "  ": "" },
    {
      " ": "Loyer annuel HT",
      "  ": formatCurrency(
        getValue(r?.annualRentExclTaxExclCharges) as number | null
      ),
    },
    {
      " ": "Fréquence de paiement",
      "  ":
        getValue(r?.paymentFrequency) === "monthly"
          ? "Mensuel"
          : getValue(r?.paymentFrequency) === "quarterly"
            ? "Trimestriel"
            : fmt(getValue(r?.paymentFrequency)),
    },
  ]
}

function buildPartiesSheet(extraction: LeaseExtractionResult): ExcelRow[] {
  const p = extraction.parties
  return [
    { Rôle: "BAILLEUR", Information: "", Valeur: "" },
    {
      Rôle: "",
      Information: "Nom / Raison sociale",
      Valeur: fmt(getValue(p?.landlord?.name)),
    },
    {
      Rôle: "",
      Information: "Adresse",
      Valeur: fmt(getValue(p?.landlord?.address)),
    },
    {
      Rôle: "",
      Information: "Email",
      Valeur: fmt(getValue(p?.landlord?.email)),
    },
    {
      Rôle: "",
      Information: "Téléphone",
      Valeur: fmt(getValue(p?.landlord?.phone)),
    },
    { Rôle: "", Information: "", Valeur: "" },
    { Rôle: "PRENEUR", Information: "", Valeur: "" },
    {
      Rôle: "",
      Information: "Nom / Raison sociale",
      Valeur: fmt(getValue(p?.tenant?.name)),
    },
    {
      Rôle: "",
      Information: "Adresse",
      Valeur: fmt(getValue(p?.tenant?.address)),
    },
    { Rôle: "", Information: "Email", Valeur: fmt(getValue(p?.tenant?.email)) },
    {
      Rôle: "",
      Information: "Téléphone",
      Valeur: fmt(getValue(p?.tenant?.phone)),
    },
  ]
}

function buildPremisesSheet(extraction: LeaseExtractionResult): ExcelRow[] {
  const pr = extraction.premises
  return [
    { Catégorie: "IDENTIFICATION", Information: "", Valeur: "" },
    {
      Catégorie: "",
      Information: "Destination / Usage",
      Valeur: fmt(getValue(pr?.purpose)),
    },
    {
      Catégorie: "",
      Information: "Désignation",
      Valeur: fmt(getValue(pr?.designation)),
    },
    {
      Catégorie: "",
      Information: "Adresse complète",
      Valeur: fmt(getValue(pr?.address)),
    },
    { Catégorie: "", Information: "", Valeur: "" },
    { Catégorie: "CARACTÉRISTIQUES", Information: "", Valeur: "" },
    {
      Catégorie: "",
      Information: "Surface (m²)",
      Valeur: fmt(getValue(pr?.surfaceArea)),
    },
    { Catégorie: "", Information: "Étages", Valeur: fmt(getValue(pr?.floors)) },
    {
      Catégorie: "",
      Information: "Année de construction",
      Valeur: fmt(getValue(pr?.buildingYear)),
    },
    { Catégorie: "", Information: "", Valeur: "" },
    { Catégorie: "STATIONNEMENT", Information: "", Valeur: "" },
    {
      Catégorie: "",
      Information: "Places de parking",
      Valeur: fmt(getValue(pr?.parkingSpaces)),
    },
    {
      Catégorie: "",
      Information: "Places deux-roues",
      Valeur: fmt(getValue(pr?.twoWheelerSpaces)),
    },
    {
      Catégorie: "",
      Information: "Places vélos",
      Valeur: fmt(getValue(pr?.bikeSpaces)),
    },
  ]
}

function buildCalendarSheet(extraction: LeaseExtractionResult): ExcelRow[] {
  const c = extraction.calendar
  return [
    { Catégorie: "DATES PRINCIPALES", Information: "", Valeur: "" },
    {
      Catégorie: "",
      Information: "Date de signature",
      Valeur: formatDate(getValue(c?.signatureDate) as string | null),
    },
    {
      Catégorie: "",
      Information: "Date de prise d'effet",
      Valeur: formatDate(getValue(c?.effectiveDate) as string | null),
    },
    {
      Catégorie: "",
      Information: "Date d'entrée anticipée",
      Valeur: formatDate(getValue(c?.earlyAccessDate) as string | null),
    },
    {
      Catégorie: "",
      Information: "Date de fin du bail",
      Valeur: formatDate(getValue(c?.endDate) as string | null),
    },
    { Catégorie: "", Information: "", Valeur: "" },
    { Catégorie: "DURÉE ET RENOUVELLEMENT", Information: "", Valeur: "" },
    {
      Catégorie: "",
      Information: "Durée du bail (années)",
      Valeur: fmt(getValue(c?.duration)),
    },
    {
      Catégorie: "",
      Information: "Prochaine date triennale",
      Valeur: formatDate(getValue(c?.nextTriennialDate) as string | null),
    },
    {
      Catégorie: "",
      Information: "Délai de préavis",
      Valeur: fmt(getValue(c?.noticePeriod)),
    },
    {
      Catégorie: "",
      Information: "Conditions de résiliation",
      Valeur: fmt(getValue(c?.terminationConditions)),
    },
    {
      Catégorie: "",
      Information: "Conditions de renouvellement",
      Valeur: fmt(getValue(c?.renewalConditions)),
    },
  ]
}

function buildFinancialsSheet(extraction: LeaseExtractionResult): ExcelRow[] {
  const r = extraction.rent
  const ch = extraction.charges
  const tx = extraction.taxes
  const s = extraction.securities
  const sm = extraction.supportMeasures

  return [
    { Catégorie: "LOYER PRINCIPAL", Information: "", Valeur: "" },
    {
      Catégorie: "",
      Information: "Loyer annuel HT hors charges",
      Valeur: formatCurrency(
        getValue(r?.annualRentExclTaxExclCharges) as number | null
      ),
    },
    {
      Catégorie: "",
      Information: "Loyer trimestriel HT hors charges",
      Valeur: formatCurrency(
        getValue(r?.quarterlyRentExclTaxExclCharges) as number | null
      ),
    },
    {
      Catégorie: "",
      Information: "Loyer annuel au m² HT",
      Valeur: formatCurrency(
        getValue(r?.annualRentPerSqmExclTaxExclCharges) as number | null
      ),
    },
    {
      Catégorie: "",
      Information: "Fréquence de paiement",
      Valeur:
        getValue(r?.paymentFrequency) === "monthly"
          ? "Mensuel"
          : getValue(r?.paymentFrequency) === "quarterly"
            ? "Trimestriel"
            : fmt(getValue(r?.paymentFrequency)),
    },
    {
      Catégorie: "",
      Information: "Assujetti à la TVA",
      Valeur: fmt(getValue(r?.isSubjectToVAT)),
    },
    { Catégorie: "", Information: "", Valeur: "" },
    { Catégorie: "PARKING", Information: "", Valeur: "" },
    {
      Catégorie: "",
      Information: "Loyer parking annuel HT",
      Valeur: formatCurrency(
        getValue(r?.annualParkingRentExclCharges) as number | null
      ),
    },
    {
      Catégorie: "",
      Information: "Loyer parking trimestriel HT",
      Valeur: formatCurrency(
        getValue(r?.quarterlyParkingRentExclCharges) as number | null
      ),
    },
    { Catégorie: "", Information: "", Valeur: "" },
    { Catégorie: "CHARGES ET PROVISIONS", Information: "", Valeur: "" },
    {
      Catégorie: "",
      Information: "Provision charges annuelles HT",
      Valeur: formatCurrency(
        getValue(ch?.annualChargesProvisionExclTax) as number | null
      ),
    },
    {
      Catégorie: "",
      Information: "Provision charges trimestrielles HT",
      Valeur: formatCurrency(
        getValue(ch?.quarterlyChargesProvisionExclTax) as number | null
      ),
    },
    { Catégorie: "", Information: "", Valeur: "" },
    { Catégorie: "TAXES", Information: "", Valeur: "" },
    {
      Catégorie: "",
      Information: "Taxe foncière refacturée",
      Valeur: fmt(getValue(tx?.propertyTaxRebilled)),
    },
    {
      Catégorie: "",
      Information: "Montant taxe foncière",
      Valeur: formatCurrency(getValue(tx?.propertyTaxAmount) as number | null),
    },
    {
      Catégorie: "",
      Information: "Taxe sur les bureaux",
      Valeur: formatCurrency(getValue(tx?.officeTaxAmount) as number | null),
    },
    { Catégorie: "", Information: "", Valeur: "" },
    { Catégorie: "DÉPÔT DE GARANTIE", Information: "", Valeur: "" },
    {
      Catégorie: "",
      Information: "Montant du dépôt",
      Valeur: formatCurrency(
        getValue(s?.securityDepositAmount) as number | null
      ),
    },
    {
      Catégorie: "",
      Information: "Autres sûretés",
      Valeur: fmt(getValue(s?.otherSecurities)),
    },
    { Catégorie: "", Information: "", Valeur: "" },
    { Catégorie: "MESURES D'ACCOMPAGNEMENT", Information: "", Valeur: "" },
    {
      Catégorie: "",
      Information: "Franchise de loyer",
      Valeur: fmt(getValue(sm?.hasRentFreeperiod)),
    },
    {
      Catégorie: "",
      Information: "Durée de la franchise (mois)",
      Valeur: fmt(getValue(sm?.rentFreePeriodMonths)),
    },
    {
      Catégorie: "",
      Information: "Montant de la franchise HT",
      Valeur: formatCurrency(
        getValue(sm?.rentFreePeriodAmount) as number | null
      ),
    },
  ]
}

function buildIndexationSheet(extraction: LeaseExtractionResult): ExcelRow[] {
  const i = extraction.indexation
  return [
    { Information: "Type d'indice", Valeur: fmt(getValue(i?.indexationType)) },
    {
      Information: "Trimestre de référence",
      Valeur: fmt(getValue(i?.referenceQuarter)),
    },
    {
      Information: "Date de première indexation",
      Valeur: formatDate(getValue(i?.firstIndexationDate) as string | null),
    },
    {
      Information: "Fréquence d'indexation",
      Valeur:
        getValue(i?.indexationFrequency) === "annual"
          ? "Annuelle"
          : fmt(getValue(i?.indexationFrequency)),
    },
    {
      Information: "Clause d'indexation",
      Valeur: fmt(getValue(i?.indexationClause)),
    },
  ]
}

function buildInsuranceSheet(extraction: LeaseExtractionResult): ExcelRow[] {
  const ins = extraction.insurance
  return [
    {
      Information: "Prime d'assurance annuelle HT",
      Valeur: formatCurrency(
        getValue(ins?.annualInsuranceAmountExclTax) as number | null
      ),
    },
    {
      Information: "Prime refacturée au preneur",
      Valeur: fmt(getValue(ins?.insurancePremiumRebilled)),
    },
    {
      Information: "Renonciation à recours",
      Valeur: fmt(getValue(ins?.hasWaiverOfRecourse)),
    },
    {
      Information: "Attestation d'assurance annexée",
      Valeur: fmt(getValue(ins?.insuranceCertificateAnnexed)),
    },
  ]
}

function buildOtherInfoSheet(extraction: LeaseExtractionResult): ExcelRow[] {
  const inv = extraction.inventory
  const maint = extraction.maintenance
  const rest = extraction.restitution
  const trans = extraction.transfer
  const other = extraction.other

  return [
    { Catégorie: "ÉTATS DES LIEUX", Information: "", Valeur: "" },
    {
      Catégorie: "",
      Information: "Conditions entrée",
      Valeur: fmt(getValue(inv?.entryInventoryConditions)),
    },
    {
      Catégorie: "",
      Information: "État des lieux pré-sortie",
      Valeur: fmt(getValue(inv?.hasPreExitInventory)),
    },
    {
      Catégorie: "",
      Information: "Conditions sortie",
      Valeur: fmt(getValue(inv?.exitInventoryConditions)),
    },
    { Catégorie: "", Information: "", Valeur: "" },
    { Catégorie: "TRAVAUX ET ENTRETIEN", Information: "", Valeur: "" },
    {
      Catégorie: "",
      Information: "Entretien à charge du preneur",
      Valeur: fmt(getValue(maint?.tenantMaintenanceConditions)),
    },
    {
      Catégorie: "",
      Information: "Travaux bailleur",
      Valeur: fmt(getValue(maint?.landlordWorksList)),
    },
    {
      Catégorie: "",
      Information: "Travaux preneur",
      Valeur: fmt(getValue(maint?.tenantWorksList)),
    },
    {
      Catégorie: "",
      Information: "Clause d'accession",
      Valeur: fmt(getValue(maint?.hasAccessionClause)),
    },
    { Catégorie: "", Information: "", Valeur: "" },
    { Catégorie: "RESTITUTION", Information: "", Valeur: "" },
    {
      Catégorie: "",
      Information: "Conditions de restitution",
      Valeur: fmt(getValue(rest?.restitutionConditions)),
    },
    {
      Catégorie: "",
      Information: "Conditions de remise en état",
      Valeur: fmt(getValue(rest?.restorationConditions)),
    },
    { Catégorie: "", Information: "", Valeur: "" },
    { Catégorie: "CESSION ET SOUS-LOCATION", Information: "", Valeur: "" },
    {
      Catégorie: "",
      Information: "Conditions de sous-location",
      Valeur: fmt(getValue(trans?.sublettingConditions)),
    },
    {
      Catégorie: "",
      Information: "Conditions de cession",
      Valeur: fmt(getValue(trans?.assignmentConditions)),
    },
    {
      Catégorie: "",
      Information: "Division possible",
      Valeur: fmt(getValue(trans?.divisionPossible)),
    },
    { Catégorie: "", Information: "", Valeur: "" },
    { Catégorie: "SIGNATURES", Information: "", Valeur: "" },
    {
      Catégorie: "",
      Information: "Document signé et paraphé",
      Valeur: fmt(getValue(other?.isSignedAndInitialed)),
    },
  ]
}

export function exportExtractionToExcel(
  extraction: LeaseExtractionResult
): void {
  const workbook = XLSX.utils.book_new()

  const summaryData = buildSummarySheet(extraction)
  const summarySheet = XLSX.utils.json_to_sheet(summaryData)
  setColumnWidths(summarySheet, [25, 50])
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Résumé")

  const partiesData = buildPartiesSheet(extraction)
  const partiesSheet = XLSX.utils.json_to_sheet(partiesData)
  setColumnWidths(partiesSheet, [12, 25, 50])
  XLSX.utils.book_append_sheet(workbook, partiesSheet, "Parties")

  const premisesData = buildPremisesSheet(extraction)
  const premisesSheet = XLSX.utils.json_to_sheet(premisesData)
  setColumnWidths(premisesSheet, [18, 25, 50])
  XLSX.utils.book_append_sheet(workbook, premisesSheet, "Locaux")

  const calendarData = buildCalendarSheet(extraction)
  const calendarSheet = XLSX.utils.json_to_sheet(calendarData)
  setColumnWidths(calendarSheet, [22, 30, 40])
  XLSX.utils.book_append_sheet(workbook, calendarSheet, "Calendrier")

  const financialsData = buildFinancialsSheet(extraction)
  const financialsSheet = XLSX.utils.json_to_sheet(financialsData)
  setColumnWidths(financialsSheet, [25, 35, 25])
  XLSX.utils.book_append_sheet(workbook, financialsSheet, "Financier")

  const indexationData = buildIndexationSheet(extraction)
  const indexationSheet = XLSX.utils.json_to_sheet(indexationData)
  setColumnWidths(indexationSheet, [30, 50])
  XLSX.utils.book_append_sheet(workbook, indexationSheet, "Indexation")

  const insuranceData = buildInsuranceSheet(extraction)
  const insuranceSheet = XLSX.utils.json_to_sheet(insuranceData)
  setColumnWidths(insuranceSheet, [35, 30])
  XLSX.utils.book_append_sheet(workbook, insuranceSheet, "Assurance")

  const otherData = buildOtherInfoSheet(extraction)
  const otherSheet = XLSX.utils.json_to_sheet(otherData)
  setColumnWidths(otherSheet, [22, 30, 50])
  XLSX.utils.book_append_sheet(workbook, otherSheet, "Autres")

  const fileName = extraction.fileName?.replace(/\.pdf$/i, "") || "bail"
  XLSX.writeFile(workbook, `${fileName}-extraction.xlsx`)
}
