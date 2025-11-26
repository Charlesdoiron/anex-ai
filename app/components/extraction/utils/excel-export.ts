import * as XLSX from "xlsx"
import type {
  LeaseExtractionResult,
  ExtractedValue,
} from "@/app/lib/extraction/types"

type ExcelRow = Record<string, string | number | boolean | null>

function getExtractedValue<T>(
  field: ExtractedValue<T> | undefined | null
): T | null {
  if (!field) return null
  if (field.confidence === "missing") return null
  return field.value
}

function formatValue(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null
  if (typeof value === "boolean") return value ? "Oui" : "Non"
  if (typeof value === "number") return value
  if (Array.isArray(value)) return value.join(", ")
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

function buildRegimeSheet(extraction: LeaseExtractionResult): ExcelRow[] {
  return [
    {
      Champ: "Régime du bail",
      Valeur: formatValue(getExtractedValue(extraction.regime?.regime)),
      Confiance: extraction.regime?.regime?.confidence || "missing",
    },
  ]
}

function buildPartiesSheet(extraction: LeaseExtractionResult): ExcelRow[] {
  const rows: ExcelRow[] = []
  const parties = extraction.parties

  rows.push({
    Partie: "Bailleur",
    Champ: "Nom",
    Valeur: formatValue(getExtractedValue(parties?.landlord?.name)),
    Confiance: parties?.landlord?.name?.confidence || "missing",
  })
  rows.push({
    Partie: "Bailleur",
    Champ: "Email",
    Valeur: formatValue(getExtractedValue(parties?.landlord?.email)),
    Confiance: parties?.landlord?.email?.confidence || "missing",
  })
  rows.push({
    Partie: "Bailleur",
    Champ: "Téléphone",
    Valeur: formatValue(getExtractedValue(parties?.landlord?.phone)),
    Confiance: parties?.landlord?.phone?.confidence || "missing",
  })
  rows.push({
    Partie: "Bailleur",
    Champ: "Adresse",
    Valeur: formatValue(getExtractedValue(parties?.landlord?.address)),
    Confiance: parties?.landlord?.address?.confidence || "missing",
  })

  rows.push({
    Partie: "Preneur",
    Champ: "Nom",
    Valeur: formatValue(getExtractedValue(parties?.tenant?.name)),
    Confiance: parties?.tenant?.name?.confidence || "missing",
  })
  rows.push({
    Partie: "Preneur",
    Champ: "Email",
    Valeur: formatValue(getExtractedValue(parties?.tenant?.email)),
    Confiance: parties?.tenant?.email?.confidence || "missing",
  })
  rows.push({
    Partie: "Preneur",
    Champ: "Téléphone",
    Valeur: formatValue(getExtractedValue(parties?.tenant?.phone)),
    Confiance: parties?.tenant?.phone?.confidence || "missing",
  })
  rows.push({
    Partie: "Preneur",
    Champ: "Adresse",
    Valeur: formatValue(getExtractedValue(parties?.tenant?.address)),
    Confiance: parties?.tenant?.address?.confidence || "missing",
  })

  return rows
}

function buildPremisesSheet(extraction: LeaseExtractionResult): ExcelRow[] {
  const p = extraction.premises
  return [
    {
      Champ: "Destination",
      Valeur: formatValue(getExtractedValue(p?.purpose)),
      Confiance: p?.purpose?.confidence || "missing",
    },
    {
      Champ: "Désignation",
      Valeur: formatValue(getExtractedValue(p?.designation)),
      Confiance: p?.designation?.confidence || "missing",
    },
    {
      Champ: "Adresse",
      Valeur: formatValue(getExtractedValue(p?.address)),
      Confiance: p?.address?.confidence || "missing",
    },
    {
      Champ: "Année de construction",
      Valeur: formatValue(getExtractedValue(p?.buildingYear)),
      Confiance: p?.buildingYear?.confidence || "missing",
    },
    {
      Champ: "Étages",
      Valeur: formatValue(getExtractedValue(p?.floors)),
      Confiance: p?.floors?.confidence || "missing",
    },
    {
      Champ: "Surface (m²)",
      Valeur: formatValue(getExtractedValue(p?.surfaceArea)),
      Confiance: p?.surfaceArea?.confidence || "missing",
    },
    {
      Champ: "Places de parking",
      Valeur: formatValue(getExtractedValue(p?.parkingSpaces)),
      Confiance: p?.parkingSpaces?.confidence || "missing",
    },
    {
      Champ: "Places deux-roues",
      Valeur: formatValue(getExtractedValue(p?.twoWheelerSpaces)),
      Confiance: p?.twoWheelerSpaces?.confidence || "missing",
    },
    {
      Champ: "Places vélos",
      Valeur: formatValue(getExtractedValue(p?.bikeSpaces)),
      Confiance: p?.bikeSpaces?.confidence || "missing",
    },
  ]
}

function buildCalendarSheet(extraction: LeaseExtractionResult): ExcelRow[] {
  const c = extraction.calendar
  return [
    {
      Champ: "Date de signature",
      Valeur: formatValue(getExtractedValue(c?.signatureDate)),
      Confiance: c?.signatureDate?.confidence || "missing",
    },
    {
      Champ: "Durée (années)",
      Valeur: formatValue(getExtractedValue(c?.duration)),
      Confiance: c?.duration?.confidence || "missing",
    },
    {
      Champ: "Date de prise d'effet",
      Valeur: formatValue(getExtractedValue(c?.effectiveDate)),
      Confiance: c?.effectiveDate?.confidence || "missing",
    },
    {
      Champ: "Date d'entrée anticipée",
      Valeur: formatValue(getExtractedValue(c?.earlyAccessDate)),
      Confiance: c?.earlyAccessDate?.confidence || "missing",
    },
    {
      Champ: "Date de fin",
      Valeur: formatValue(getExtractedValue(c?.endDate)),
      Confiance: c?.endDate?.confidence || "missing",
    },
    {
      Champ: "Prochaine date triennale",
      Valeur: formatValue(getExtractedValue(c?.nextTriennialDate)),
      Confiance: c?.nextTriennialDate?.confidence || "missing",
    },
    {
      Champ: "Préavis",
      Valeur: formatValue(getExtractedValue(c?.noticePeriod)),
      Confiance: c?.noticePeriod?.confidence || "missing",
    },
  ]
}

function buildRentSheet(extraction: LeaseExtractionResult): ExcelRow[] {
  const r = extraction.rent
  return [
    {
      Champ: "Loyer annuel HT HC",
      Valeur: formatValue(getExtractedValue(r?.annualRentExclTaxExclCharges)),
      Confiance: r?.annualRentExclTaxExclCharges?.confidence || "missing",
    },
    {
      Champ: "Loyer trimestriel HT HC",
      Valeur: formatValue(
        getExtractedValue(r?.quarterlyRentExclTaxExclCharges)
      ),
      Confiance: r?.quarterlyRentExclTaxExclCharges?.confidence || "missing",
    },
    {
      Champ: "Loyer annuel / m² HT HC",
      Valeur: formatValue(
        getExtractedValue(r?.annualRentPerSqmExclTaxExclCharges)
      ),
      Confiance: r?.annualRentPerSqmExclTaxExclCharges?.confidence || "missing",
    },
    {
      Champ: "Loyer parking annuel HT",
      Valeur: formatValue(getExtractedValue(r?.annualParkingRentExclCharges)),
      Confiance: r?.annualParkingRentExclCharges?.confidence || "missing",
    },
    {
      Champ: "Loyer parking trimestriel HT",
      Valeur: formatValue(
        getExtractedValue(r?.quarterlyParkingRentExclCharges)
      ),
      Confiance: r?.quarterlyParkingRentExclCharges?.confidence || "missing",
    },
    {
      Champ: "Assujetti TVA",
      Valeur: formatValue(getExtractedValue(r?.isSubjectToVAT)),
      Confiance: r?.isSubjectToVAT?.confidence || "missing",
    },
    {
      Champ: "Fréquence de paiement",
      Valeur: formatValue(getExtractedValue(r?.paymentFrequency)),
      Confiance: r?.paymentFrequency?.confidence || "missing",
    },
  ]
}

function buildChargesSheet(extraction: LeaseExtractionResult): ExcelRow[] {
  const ch = extraction.charges
  const tx = extraction.taxes
  return [
    {
      Champ: "Provision charges annuelles HT",
      Valeur: formatValue(getExtractedValue(ch?.annualChargesProvisionExclTax)),
      Confiance: ch?.annualChargesProvisionExclTax?.confidence || "missing",
    },
    {
      Champ: "Provision charges trimestrielles HT",
      Valeur: formatValue(
        getExtractedValue(ch?.quarterlyChargesProvisionExclTax)
      ),
      Confiance: ch?.quarterlyChargesProvisionExclTax?.confidence || "missing",
    },
    {
      Champ: "Taxe foncière refacturée",
      Valeur: formatValue(getExtractedValue(tx?.propertyTaxRebilled)),
      Confiance: tx?.propertyTaxRebilled?.confidence || "missing",
    },
    {
      Champ: "Montant taxe foncière",
      Valeur: formatValue(getExtractedValue(tx?.propertyTaxAmount)),
      Confiance: tx?.propertyTaxAmount?.confidence || "missing",
    },
    {
      Champ: "Taxe bureaux",
      Valeur: formatValue(getExtractedValue(tx?.officeTaxAmount)),
      Confiance: tx?.officeTaxAmount?.confidence || "missing",
    },
  ]
}

function buildIndexationSheet(extraction: LeaseExtractionResult): ExcelRow[] {
  const i = extraction.indexation
  return [
    {
      Champ: "Type d'indexation",
      Valeur: formatValue(getExtractedValue(i?.indexationType)),
      Confiance: i?.indexationType?.confidence || "missing",
    },
    {
      Champ: "Trimestre de référence",
      Valeur: formatValue(getExtractedValue(i?.referenceQuarter)),
      Confiance: i?.referenceQuarter?.confidence || "missing",
    },
    {
      Champ: "Première date d'indexation",
      Valeur: formatValue(getExtractedValue(i?.firstIndexationDate)),
      Confiance: i?.firstIndexationDate?.confidence || "missing",
    },
    {
      Champ: "Fréquence d'indexation",
      Valeur: formatValue(getExtractedValue(i?.indexationFrequency)),
      Confiance: i?.indexationFrequency?.confidence || "missing",
    },
  ]
}

function buildSecuritiesSheet(extraction: LeaseExtractionResult): ExcelRow[] {
  const s = extraction.securities
  return [
    {
      Champ: "Dépôt de garantie",
      Valeur: formatValue(getExtractedValue(s?.securityDepositAmount)),
      Confiance: s?.securityDepositAmount?.confidence || "missing",
    },
    {
      Champ: "Autres sûretés",
      Valeur: formatValue(getExtractedValue(s?.otherSecurities)),
      Confiance: s?.otherSecurities?.confidence || "missing",
    },
  ]
}

function buildSupportMeasuresSheet(
  extraction: LeaseExtractionResult
): ExcelRow[] {
  const sm = extraction.supportMeasures
  return [
    {
      Champ: "Franchise de loyer",
      Valeur: formatValue(getExtractedValue(sm?.hasRentFreeperiod)),
      Confiance: sm?.hasRentFreeperiod?.confidence || "missing",
    },
    {
      Champ: "Durée franchise (mois)",
      Valeur: formatValue(getExtractedValue(sm?.rentFreePeriodMonths)),
      Confiance: sm?.rentFreePeriodMonths?.confidence || "missing",
    },
    {
      Champ: "Montant franchise HT",
      Valeur: formatValue(getExtractedValue(sm?.rentFreePeriodAmount)),
      Confiance: sm?.rentFreePeriodAmount?.confidence || "missing",
    },
    {
      Champ: "Autres mesures",
      Valeur: formatValue(getExtractedValue(sm?.hasOtherMeasures)),
      Confiance: sm?.hasOtherMeasures?.confidence || "missing",
    },
    {
      Champ: "Description autres mesures",
      Valeur: formatValue(getExtractedValue(sm?.otherMeasuresDescription)),
      Confiance: sm?.otherMeasuresDescription?.confidence || "missing",
    },
  ]
}

function buildMetadataSheet(extraction: LeaseExtractionResult): ExcelRow[] {
  const meta = extraction.extractionMetadata
  return [
    { Champ: "ID Document", Valeur: extraction.documentId },
    { Champ: "Nom du fichier", Valeur: extraction.fileName },
    { Champ: "Date d'extraction", Valeur: extraction.extractionDate },
    { Champ: "Nombre de pages", Valeur: extraction.pageCount },
    { Champ: "Moteur OCR", Valeur: extraction.usedOcrEngine || "Aucun" },
    { Champ: "Champs totaux", Valeur: meta?.totalFields || 0 },
    { Champ: "Champs extraits", Valeur: meta?.extractedFields || 0 },
    { Champ: "Champs manquants", Valeur: meta?.missingFields || 0 },
    {
      Champ: "Confiance moyenne (%)",
      Valeur: meta?.averageConfidence
        ? Math.round(meta.averageConfidence * 100)
        : 0,
    },
    {
      Champ: "Temps de traitement (s)",
      Valeur: meta?.processingTimeMs
        ? (meta.processingTimeMs / 1000).toFixed(1)
        : 0,
    },
  ]
}

export function exportExtractionToExcel(
  extraction: LeaseExtractionResult
): void {
  const workbook = XLSX.utils.book_new()

  const sheetsData: { name: string; data: ExcelRow[] }[] = [
    { name: "Métadonnées", data: buildMetadataSheet(extraction) },
    { name: "Régime", data: buildRegimeSheet(extraction) },
    { name: "Parties", data: buildPartiesSheet(extraction) },
    { name: "Locaux", data: buildPremisesSheet(extraction) },
    { name: "Calendrier", data: buildCalendarSheet(extraction) },
    { name: "Loyer", data: buildRentSheet(extraction) },
    { name: "Charges & Taxes", data: buildChargesSheet(extraction) },
    { name: "Indexation", data: buildIndexationSheet(extraction) },
    { name: "Sûretés", data: buildSecuritiesSheet(extraction) },
    { name: "Accompagnement", data: buildSupportMeasuresSheet(extraction) },
  ]

  for (const sheet of sheetsData) {
    const worksheet = XLSX.utils.json_to_sheet(sheet.data)
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name)
  }

  const fileName = extraction.fileName?.replace(/\.pdf$/i, "") || "extraction"
  XLSX.writeFile(workbook, `${fileName}-extraction.xlsx`)
}
