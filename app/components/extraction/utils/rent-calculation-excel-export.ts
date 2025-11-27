import * as XLSX from "xlsx"
import type { RentCalculationResult } from "@/app/lib/extraction/rent-calculation-service"
import type {
  RentSchedulePeriod,
  YearlyTotalSummary,
} from "@/app/lib/lease/types"

type CellValue = string | number | null

function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "—"
  try {
    const date = new Date(isoDate)
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  } catch {
    return isoDate
  }
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—"
  return `${value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
}

function formatFrequency(freq: string | null | undefined): string {
  if (freq === "monthly") return "Mensuel"
  if (freq === "quarterly") return "Trimestriel"
  return freq || "—"
}

function getValue<T>(field: { value: T } | undefined | null): T | null {
  if (!field) return null
  return field.value
}

function setCellStyle(
  ws: XLSX.WorkSheet,
  cell: string,
  style: Partial<XLSX.CellObject>
): void {
  if (!ws[cell]) ws[cell] = { t: "s", v: "" }
  Object.assign(ws[cell], style)
}

function buildCompactSinglePageExport(
  result: RentCalculationResult
): XLSX.WorkSheet {
  const extracted = result.extractedData
  const input = result.scheduleInput
  const schedule = result.rentSchedule?.schedule || []
  const yearlyTotals = result.rentSchedule?.summary?.yearlyTotals || []
  const summary = result.rentSchedule?.summary

  // Build the grid - using array of arrays for precise control
  const data: CellValue[][] = []

  // Row 0: Title
  data.push([
    "ÉCHÉANCIER DE LOYER",
    null,
    null,
    null,
    null,
    null,
    null,
    `Document: ${result.fileName?.replace(/\.pdf$/i, "") || "—"}`,
  ])

  // Row 1: Subtitle / date
  data.push([
    `Généré le ${formatDate(result.extractionDate)}`,
    null,
    null,
    null,
    null,
    null,
    null,
    result.pageCount ? `${result.pageCount} pages` : null,
  ])

  // Row 2: Empty separator
  data.push([])

  // Row 3: Section headers
  data.push([
    "DONNÉES DU BAIL",
    null,
    null,
    null,
    "PARAMÈTRES DE CALCUL",
    null,
    null,
    null,
  ])

  // Row 4-8: Key data in two columns
  const effectiveDate = formatDate(getValue(extracted.calendar.effectiveDate))
  const signatureDate = formatDate(getValue(extracted.calendar.signatureDate))
  const duration = getValue(extracted.calendar.duration)
  const frequency = formatFrequency(getValue(extracted.rent.paymentFrequency))
  const annualRent = getValue(extracted.rent.annualRentExclTaxExclCharges)
  const quarterlyRent = getValue(extracted.rent.quarterlyRentExclTaxExclCharges)
  const parkingRent = getValue(extracted.rent.annualParkingRentExclCharges)

  data.push([
    "Date d'effet",
    effectiveDate,
    null,
    null,
    "Période",
    `${formatDate(input?.startDate)} → ${formatDate(input?.endDate)}`,
    null,
    null,
  ])

  data.push([
    "Date signature",
    signatureDate,
    null,
    null,
    "Indice de base",
    input?.baseIndexValue ?? "—",
    null,
    null,
  ])

  data.push([
    "Durée",
    duration ? `${duration} ans` : "—",
    null,
    null,
    "Loyer bureaux/période",
    formatCurrency(input?.officeRentHT),
    null,
    null,
  ])

  data.push([
    "Fréquence",
    frequency,
    null,
    null,
    "Loyer parking/période",
    formatCurrency(input?.parkingRentHT),
    null,
    null,
  ])

  // Row 8: Rents
  const rentDisplay = annualRent
    ? formatCurrency(annualRent) + "/an"
    : quarterlyRent
      ? formatCurrency(quarterlyRent) + "/trim"
      : "—"

  data.push([
    "Loyer bureaux HT",
    rentDisplay,
    null,
    null,
    "Dépôt garantie HT",
    formatCurrency(summary?.depositHT),
    null,
    null,
  ])

  data.push([
    "Loyer parking HT",
    parkingRent ? formatCurrency(parkingRent) + "/an" : "—",
    null,
    null,
    "TCAM",
    summary?.tcam ? `${(summary.tcam * 100).toFixed(2)}%` : "—",
    null,
    null,
  ])

  // Row 10: Empty separator
  data.push([])

  // Row 11: Yearly totals header
  data.push(["RÉCAPITULATIF ANNUEL", null, null, null, null, null, null, null])

  // Row 12: Yearly totals column headers
  data.push([
    "Année",
    "Loyer base HT",
    "Charges HT",
    "Taxes HT",
    "Franchise HT",
    "Incentives HT",
    "LOYER NET HT",
    null,
  ])

  // Yearly totals data
  yearlyTotals.forEach((year: YearlyTotalSummary) => {
    data.push([
      year.year,
      year.baseRentHT,
      year.chargesHT,
      year.taxesHT,
      year.franchiseHT,
      year.incentivesHT,
      year.netRentHT,
      null,
    ])
  })

  // Empty row if no yearly data
  if (yearlyTotals.length === 0) {
    data.push([
      "Aucun échéancier calculé",
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ])
  }

  // Add separator
  data.push([])

  // Schedule header
  data.push(["ÉCHÉANCIER DÉTAILLÉ", null, null, null, null, null, null, null])

  // Schedule column headers
  data.push([
    "Période",
    "Début",
    "Fin",
    "Indice",
    "Bureaux HT",
    "Parking HT",
    "Net HT",
    null,
  ])

  // Schedule data - limit to fit page (about 25 rows available)
  const maxScheduleRows = 20
  const displaySchedule = schedule.slice(0, maxScheduleRows)

  displaySchedule.forEach((period: RentSchedulePeriod) => {
    const periodLabel =
      period.periodType === "month"
        ? `${period.year}-${String(period.month).padStart(2, "0")}`
        : `${period.year} T${period.quarter}`

    data.push([
      periodLabel,
      formatDate(period.periodStart),
      formatDate(period.periodEnd),
      period.indexValue.toFixed(2),
      period.officeRentHT,
      period.parkingRentHT,
      period.netRentHT,
      null,
    ])
  })

  // Show truncation notice if schedule was cut
  if (schedule.length > maxScheduleRows) {
    data.push([
      `... et ${schedule.length - maxScheduleRows} périodes supplémentaires`,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ])
  }

  // Empty row if no schedule
  if (schedule.length === 0) {
    data.push([
      "Aucune période calculée",
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ])
  }

  // Create worksheet from array of arrays
  const ws = XLSX.utils.aoa_to_sheet(data)

  // Set column widths for single page layout
  ws["!cols"] = [
    { wch: 18 }, // A: Labels
    { wch: 14 }, // B: Values
    { wch: 12 }, // C
    { wch: 10 }, // D
    { wch: 18 }, // E: Labels
    { wch: 14 }, // F: Values
    { wch: 14 }, // G
    { wch: 14 }, // H
  ]

  // Set row heights for better readability
  ws["!rows"] = [
    { hpt: 22 }, // Title row
    { hpt: 16 }, // Subtitle
    { hpt: 10 }, // Separator
  ]

  // Set print area to fit one page
  ws["!printArea"] = `A1:H${data.length}`

  return ws
}

export function exportRentCalculationToExcel(
  result: RentCalculationResult
): void {
  const workbook = XLSX.utils.book_new()

  // Single compact sheet
  const sheet = buildCompactSinglePageExport(result)
  XLSX.utils.book_append_sheet(workbook, sheet, "Échéancier")

  const fileName = result.fileName?.replace(/\.pdf$/i, "") || "calcul-loyer"
  XLSX.writeFile(workbook, `${fileName}-echeancier.xlsx`)
}

export function isRentCalculationResult(data: unknown): boolean {
  if (!data || typeof data !== "object") return false
  const obj = data as Record<string, unknown>

  // Check for toolType (stored in DB)
  if (obj.toolType === "calculation-rent") return true

  // Check for rent calculation structure (extractedData with calendar/rent fields)
  if (obj.extractedData && typeof obj.extractedData === "object") {
    const extracted = obj.extractedData as Record<string, unknown>
    return (
      extracted.calendar !== undefined &&
      extracted.rent !== undefined &&
      obj.rentSchedule !== undefined
    )
  }

  return false
}
