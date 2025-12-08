/**
 * Excel export matching client template format "2511_Calcul-Loyer_Template-Livrable.xlsx"
 * Horizontal timeline with quarterly/monthly breakdown
 */

import * as XLSX from "xlsx"
import type { RentCalculationResult } from "@/app/lib/extraction/rent-calculation-service"
import type { RentSchedulePeriod } from "@/app/lib/lease/types"

type CellValue = string | number | null | undefined

const MONTH_NAMES_FR = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
]

// Utility functions
function formatDateFR(isoDate: string | null | undefined): string {
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
  return field?.value ?? null
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function getQuarter(month: number): number {
  return Math.floor((month - 1) / 3) + 1
}

function getEndOfQuarter(year: number, quarter: number): Date {
  const nextQuarterMonth = quarter * 3
  return new Date(Date.UTC(year, nextQuarterMonth, 0))
}

function dateToExcel(date: Date): number {
  const epoch = new Date(Date.UTC(1899, 11, 30))
  return Math.floor((date.getTime() - epoch.getTime()) / 86400000)
}

function parseISODate(isoString: string | null | undefined): Date | null {
  if (!isoString) return null
  const date = new Date(isoString)
  return isNaN(date.getTime()) ? null : date
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function padRow(
  values: CellValue[],
  targetCol: number,
  legendValue?: string
): CellValue[] {
  const row: CellValue[] = [...values]
  while (row.length < targetCol) {
    row.push("")
  }
  if (legendValue) {
    row.push(legendValue)
  }
  return row
}

interface ColumnData {
  header1: string
  header2: string
  daysInMonth: number | null
  daysSameIndex: number | null
  daysDiffIndex: number | null
  indexValue: number | null
  depositHT: number | null
  franchiseHT: number | null
  incentivesHT: number | null
  officeRentHT: number | null
  parkingRentHT: number | null
  chargesHT: number | null
  taxesHT: number | null
  otherHT: number | null
  totalHT: number | null
  isYearTotal?: boolean
  isQuarterTotal?: boolean
}

function buildClientTemplateExport(
  result: RentCalculationResult
): XLSX.WorkSheet {
  const extracted = result.extractedData
  const input = result.scheduleInput
  const summary = result.rentSchedule?.summary
  const schedule = result.rentSchedule?.schedule || []

  const startDateStr =
    getValue(extracted.calendar.effectiveDate) ||
    getValue(extracted.calendar.signatureDate)
  const startDate = parseISODate(startDateStr)
  const endDate = parseISODate(input?.endDate)

  const baseIndexValue = input?.baseIndexValue || 0
  const tcam = summary?.tcam || 0
  const frequency = getValue(extracted.rent.paymentFrequency)
  const isQuarterly = frequency === "quarterly"

  const duration = getValue(extracted.calendar.duration) || 9
  const annualRent = getValue(extracted.rent.annualRentExclTaxExclCharges)
  const quarterlyRent = getValue(extracted.rent.quarterlyRentExclTaxExclCharges)
  const parkingRentAnnual = getValue(
    extracted.rent.annualParkingRentExclCharges
  )

  const officeRentPerQuarter = annualRent ? annualRent / 4 : quarterlyRent || 0
  const parkingRentPerQuarter = parkingRentAnnual ? parkingRentAnnual / 4 : 0
  const monthlyOfficeRent = officeRentPerQuarter / 3
  const monthlyParkingRent = parkingRentPerQuarter / 3

  const depositMonths = input?.depositMonths ?? 3
  const franchiseMonths = input?.franchiseMonths ?? 0
  const incentiveAmount = input?.incentiveAmount ?? 0
  const chargesGrowthRate = input?.chargesGrowthRate ?? 0.02
  const chargesPerQuarter = input?.chargesHT ?? 0
  const taxesPerQuarter = input?.taxesHT ?? 0

  const data: CellValue[][] = []

  // === SECTION 1: DONNÉES D'ENTRÉE ===
  // Legend column at P (index 15)
  const LEGEND_COL = 15
  data.push(padRow(["Données"], LEGEND_COL, "LÉGENDE"))

  const effectiveDateDisplay = startDate ? formatDateFR(startDateStr) : "—"
  data.push(
    padRow(
      ["Date de prise d'effet du bail", effectiveDateDisplay],
      LEGEND_COL,
      "🔵 Données extraites du bail"
    )
  )

  // Calcul fin premier trimestre
  let endQ1Date: Date | null = null
  let daysUntilEndQ1 = 0
  if (startDate) {
    const q = getQuarter(startDate.getUTCMonth() + 1)
    endQ1Date = getEndOfQuarter(startDate.getUTCFullYear(), q)
    daysUntilEndQ1 =
      Math.round((endQ1Date.getTime() - startDate.getTime()) / 86400000) + 1
  }

  const endQ1DateDisplay = endQ1Date
    ? formatDateFR(endQ1Date.toISOString())
    : "—"
  data.push(
    padRow(
      [
        "Fin du premier trimestre à compter de la prise d'effet",
        endQ1DateDisplay,
      ],
      LEGEND_COL,
      "🟢 Calculs automatiques"
    )
  )

  data.push(
    padRow(
      [
        "# jours de la date de prise d'effet jusqu'à fin de trimestre",
        daysUntilEndQ1,
      ],
      LEGEND_COL
    )
  )

  const endDateDisplay = endDate ? formatDateFR(input?.endDate) : "—"
  data.push(
    padRow(
      ["Date de fin de bail", endDateDisplay, `(durée: ${duration} ans)`],
      LEGEND_COL,
      "🟡 Indices INSEE publiés"
    )
  )

  data.push(
    padRow(["Échéance de paiement", formatFrequency(frequency)], LEGEND_COL)
  )

  const indexTypeName = input?.indexType || "ILAT"
  // Use extracted reference quarter from lease if available, otherwise calculate from start date
  const extractedRefQuarter = getValue(extracted.indexation?.referenceQuarter)
  const indexRef = extractedRefQuarter
    ? extractedRefQuarter
    : startDate
      ? `${indexTypeName} T${getQuarter(startDate.getUTCMonth() + 1)} ${startDate.getUTCFullYear()}`
      : "—"
  data.push(
    padRow(
      ["Indice de référence", indexRef],
      LEGEND_COL,
      "🔴 Projections TCAM (estimées)"
    )
  )

  data.push(
    padRow(
      [
        "TCAM = taux d'évolution moyen de l'indice",
        "",
        "Évolution entre dernier indice connu et indice de référence",
      ],
      LEGEND_COL
    )
  )

  const tcamDisplay = tcam ? `${(tcam * 100).toFixed(4)}%` : "—"
  data.push(padRow(["TCAM valeur", tcamDisplay], LEGEND_COL))

  data.push(padRow(["Dépôt de garantie (en mois)", depositMonths], LEGEND_COL))

  // Franchise
  let franchiseEndDate: Date | null = null
  let franchiseDays = 0
  if (startDate && franchiseMonths > 0) {
    franchiseEndDate = new Date(
      Date.UTC(
        startDate.getUTCFullYear(),
        startDate.getUTCMonth() + franchiseMonths,
        startDate.getUTCDate() - 1
      )
    )
    franchiseDays =
      Math.round(
        (franchiseEndDate.getTime() - startDate.getTime()) / 86400000
      ) + 1
  }

  const franchiseEndDisplay = franchiseEndDate
    ? formatDateFR(franchiseEndDate.toISOString())
    : ""
  data.push(
    padRow(
      [
        "Franchise (en mois)",
        franchiseMonths || "—",
        franchiseEndDisplay,
        franchiseEndDisplay ? "(date de fin franchise)" : "",
        "",
        "",
        "",
        "",
        franchiseDays || "",
        franchiseDays ? "(jours de franchise)" : "",
      ],
      LEGEND_COL
    )
  )

  data.push(
    padRow(
      [
        "Mesures d'accompagnement",
        incentiveAmount > 0 ? formatCurrency(incentiveAmount) : "—",
        incentiveAmount > 0 ? "de travaux pris en charge" : "",
      ],
      LEGEND_COL
    )
  )

  const chargesRateDisplay = `${(chargesGrowthRate * 100).toFixed(1)}%`
  data.push(
    padRow(
      ["Hypothèse augmentation charges/taxes (par an)", chargesRateDisplay],
      LEGEND_COL
    )
  )

  // Séparateur
  data.push([])
  data.push([])

  // === SECTION 2: CALCUL DONNÉES FINANCIÈRES ===
  if (schedule.length === 0 || !startDate) {
    data.push(["Calcul données financières"])
    data.push([
      "Aucun échéancier calculé - données insuffisantes pour le calcul",
    ])
    const ws = XLSX.utils.aoa_to_sheet(data)
    ws["!cols"] = [{ wch: 55 }, { wch: 18 }, { wch: 18 }]
    return ws
  }

  // Build column data from schedule
  const columns: ColumnData[] = []

  // Base bail column - use period-appropriate rent values
  const baseOfficeRent = isQuarterly ? officeRentPerQuarter : monthlyOfficeRent
  const baseParkingRent = isQuarterly
    ? parkingRentPerQuarter
    : monthlyParkingRent
  const baseCharges = isQuarterly ? chargesPerQuarter : chargesPerQuarter / 3
  const baseTaxes = isQuarterly ? taxesPerQuarter : taxesPerQuarter / 3

  const baseDeposit = (monthlyOfficeRent + monthlyParkingRent) * depositMonths
  const baseFranchise =
    (monthlyOfficeRent + monthlyParkingRent) * franchiseMonths
  columns.push({
    header1: "Base bail",
    header2: isQuarterly ? "Trimestriel" : "Mensuel",
    daysInMonth: null,
    daysSameIndex: null,
    daysDiffIndex: null,
    indexValue: baseIndexValue,
    depositHT: roundCurrency(baseDeposit),
    franchiseHT: roundCurrency(baseFranchise),
    incentivesHT: incentiveAmount,
    officeRentHT: roundCurrency(baseOfficeRent),
    parkingRentHT: roundCurrency(baseParkingRent),
    chargesHT: roundCurrency(baseCharges),
    taxesHT: roundCurrency(baseTaxes),
    otherHT: 0,
    totalHT: roundCurrency(
      baseOfficeRent + baseParkingRent + baseCharges + baseTaxes
    ),
  })

  // Group schedule by year and quarter
  const yearQuarterMap = new Map<string, RentSchedulePeriod[]>()
  for (const period of schedule) {
    const pDate = new Date(period.periodStart)
    const year = pDate.getUTCFullYear()
    const q = period.quarter || getQuarter(pDate.getUTCMonth() + 1)
    const key = `${year}-Q${q}`
    if (!yearQuarterMap.has(key)) {
      yearQuarterMap.set(key, [])
    }
    yearQuarterMap.get(key)!.push(period)
  }

  // Accumulate year totals
  const yearTotals = new Map<
    number,
    {
      franchiseHT: number
      incentivesHT: number
      officeRentHT: number
      parkingRentHT: number
      chargesHT: number
      taxesHT: number
      totalHT: number
    }
  >()

  let currentYear: number | null = null
  let franchiseRemaining = franchiseMonths
  let incentiveRemaining = incentiveAmount

  // Sorted keys
  const sortedKeys = Array.from(yearQuarterMap.keys()).sort()

  for (const key of sortedKeys) {
    const periods = yearQuarterMap.get(key)!
    const [yearStr, qStr] = key.split("-")
    const year = parseInt(yearStr, 10)
    const quarter = parseInt(qStr.replace("Q", ""), 10)

    // Initialize year totals
    if (!yearTotals.has(year)) {
      yearTotals.set(year, {
        franchiseHT: 0,
        incentivesHT: 0,
        officeRentHT: 0,
        parkingRentHT: 0,
        chargesHT: 0,
        taxesHT: 0,
        totalHT: 0,
      })
    }

    // Add year total column when year changes
    if (currentYear !== null && year !== currentYear) {
      const yt = yearTotals.get(currentYear)!
      columns.push({
        header1: String(currentYear),
        header2: "",
        daysInMonth: null,
        daysSameIndex: null,
        daysDiffIndex: null,
        indexValue: null,
        depositHT: null,
        franchiseHT: roundCurrency(yt.franchiseHT),
        incentivesHT: roundCurrency(yt.incentivesHT),
        officeRentHT: roundCurrency(yt.officeRentHT),
        parkingRentHT: roundCurrency(yt.parkingRentHT),
        chargesHT: roundCurrency(yt.chargesHT),
        taxesHT: roundCurrency(yt.taxesHT),
        otherHT: 0,
        totalHT: roundCurrency(yt.totalHT),
        isYearTotal: true,
      })
    }
    currentYear = year

    // Quarter totals
    let qOffice = 0,
      qParking = 0,
      qCharges = 0,
      qTaxes = 0
    let qFranchise = 0,
      qIncentive = 0,
      qTotal = 0
    let qIndex = periods[0]?.indexValue || baseIndexValue

    // Process each period (month) in the quarter
    for (const period of periods) {
      const pDate = new Date(period.periodStart)
      const month = pDate.getUTCMonth() + 1
      const daysInMonth = getDaysInMonth(year, month)

      // Calculate prorated days
      let daysSameIndex = daysInMonth
      let daysDiffIndex = 0

      // Check if this is anniversary month
      if (
        startDate &&
        month === startDate.getUTCMonth() + 1 &&
        year > startDate.getUTCFullYear()
      ) {
        const anniversaryDay = startDate.getUTCDate()
        daysSameIndex = anniversaryDay - 1
        daysDiffIndex = daysInMonth - daysSameIndex
      }

      // Handle first month proratization
      let prorataFactor = 1
      if (
        startDate &&
        year === startDate.getUTCFullYear() &&
        month === startDate.getUTCMonth() + 1 &&
        startDate.getUTCDate() > 1
      ) {
        const remainingDays = daysInMonth - startDate.getUTCDate() + 1
        prorataFactor = remainingDays / daysInMonth
        daysSameIndex = remainingDays
      }

      // Calculate franchise for this period
      let periodFranchise = 0
      if (franchiseRemaining > 0) {
        const franchiseMonthsApplied = Math.min(
          franchiseRemaining,
          prorataFactor
        )
        periodFranchise =
          -(period.officeRentHT + period.parkingRentHT) * franchiseMonthsApplied
        franchiseRemaining -= franchiseMonthsApplied
      }

      // Calculate incentive (one-time)
      let periodIncentive = 0
      if (incentiveRemaining > 0) {
        periodIncentive = -incentiveRemaining
        incentiveRemaining = 0
      }

      // Month column (for monthly payments) or accumulate for quarterly
      if (!isQuarterly) {
        columns.push({
          header1: "",
          header2: MONTH_NAMES_FR[month - 1],
          daysInMonth,
          daysSameIndex,
          daysDiffIndex,
          indexValue: null,
          depositHT: null,
          franchiseHT:
            period.franchiseHT !== 0 ? roundCurrency(period.franchiseHT) : null,
          incentivesHT:
            period.incentivesHT !== 0
              ? roundCurrency(period.incentivesHT)
              : null,
          officeRentHT: roundCurrency(period.officeRentHT),
          parkingRentHT: roundCurrency(period.parkingRentHT),
          chargesHT: roundCurrency(period.chargesHT),
          taxesHT: roundCurrency(period.taxesHT),
          otherHT: roundCurrency(period.otherCostsHT),
          totalHT: roundCurrency(period.netRentHT),
        })
      }

      // Accumulate quarter totals
      qOffice += period.officeRentHT
      qParking += period.parkingRentHT
      qCharges += period.chargesHT
      qTaxes += period.taxesHT
      qFranchise += period.franchiseHT
      qIncentive += period.incentivesHT
      qTotal += period.netRentHT
      qIndex = period.indexValue
    }

    // Quarter summary column
    const qCol: ColumnData = {
      header1: `${quarter}T${String(year).slice(2)}`,
      header2: "",
      daysInMonth: null,
      daysSameIndex: periods.reduce((sum, p) => {
        const d = new Date(p.periodStart)
        return sum + getDaysInMonth(d.getUTCFullYear(), d.getUTCMonth() + 1)
      }, 0),
      daysDiffIndex: null,
      indexValue: qIndex,
      depositHT: roundCurrency(
        (monthlyOfficeRent + monthlyParkingRent) *
          depositMonths *
          (qIndex / baseIndexValue)
      ),
      franchiseHT: qFranchise !== 0 ? roundCurrency(qFranchise) : null,
      incentivesHT: qIncentive !== 0 ? roundCurrency(qIncentive) : null,
      officeRentHT: roundCurrency(qOffice),
      parkingRentHT: roundCurrency(qParking),
      chargesHT: roundCurrency(qCharges),
      taxesHT: roundCurrency(qTaxes),
      otherHT: 0,
      totalHT: roundCurrency(qTotal),
      isQuarterTotal: true,
    }

    // Insert quarter column before month columns for quarterly display
    if (isQuarterly) {
      columns.push(qCol)
    } else {
      // Find position to insert quarter header
      const insertPos = columns.length - periods.length
      columns.splice(insertPos, 0, qCol)
    }

    // Update year totals
    const yt = yearTotals.get(year)!
    yt.franchiseHT += qFranchise
    yt.incentivesHT += qIncentive
    yt.officeRentHT += qOffice
    yt.parkingRentHT += qParking
    yt.chargesHT += qCharges
    yt.taxesHT += qTaxes
    yt.totalHT += qTotal
  }

  // Add final year total
  if (currentYear !== null) {
    const yt = yearTotals.get(currentYear)!
    columns.push({
      header1: String(currentYear),
      header2: "",
      daysInMonth: null,
      daysSameIndex: null,
      daysDiffIndex: null,
      indexValue: null,
      depositHT: null,
      franchiseHT: roundCurrency(yt.franchiseHT),
      incentivesHT: roundCurrency(yt.incentivesHT),
      officeRentHT: roundCurrency(yt.officeRentHT),
      parkingRentHT: roundCurrency(yt.parkingRentHT),
      chargesHT: roundCurrency(yt.chargesHT),
      taxesHT: roundCurrency(yt.taxesHT),
      otherHT: 0,
      totalHT: roundCurrency(yt.totalHT),
      isYearTotal: true,
    })
  }

  // Build rows from columns
  data.push(["Calcul données financières"])

  const headerRow1: CellValue[] = [""]
  const headerRow2: CellValue[] = [""]
  const daysRow: CellValue[] = ["# jours / mois"]
  const daysSameRow: CellValue[] = [
    "# jours même indice jusqu'à fin de trimestre",
  ]
  const daysDiffRow: CellValue[] = [
    "# jours indice différent jusqu'à fin de trimestre",
  ]
  const indexRow: CellValue[] = ["Taux indice"]
  const depositRow: CellValue[] = ["Dépôt de garantie"]
  const franchiseRow: CellValue[] = ["Franchise"]
  const incentiveRow: CellValue[] = ["Mesures d'accompagnement"]
  const officeRow: CellValue[] = ["Loyer bureaux"]
  const parkingRow: CellValue[] = ["Loyer parking"]
  const chargesRow: CellValue[] = ["Provision pour charges"]
  const taxesRow: CellValue[] = ["Provision pour taxes"]
  const otherRow: CellValue[] = ["Autres (honoraires, assurance...)"]
  const totalRow: CellValue[] = ["TOTAL HT"]

  for (const col of columns) {
    headerRow1.push(col.header1)
    headerRow2.push(col.header2)
    daysRow.push(col.daysInMonth ?? "")
    daysSameRow.push(col.daysSameIndex ?? "")
    daysDiffRow.push(col.daysDiffIndex ?? "")
    indexRow.push(col.indexValue ?? "")
    depositRow.push(col.depositHT ?? "")
    franchiseRow.push(col.franchiseHT ?? "")
    incentiveRow.push(col.incentivesHT ?? "")
    officeRow.push(col.officeRentHT ?? "")
    parkingRow.push(col.parkingRentHT ?? "")
    chargesRow.push(col.chargesHT ?? "")
    taxesRow.push(col.taxesHT ?? "")
    otherRow.push(col.otherHT ?? "")
    totalRow.push(col.totalHT ?? "")
  }

  data.push(headerRow1)
  data.push(headerRow2)
  data.push(daysRow)
  data.push(daysSameRow)
  data.push(daysDiffRow)
  data.push(indexRow)
  data.push(depositRow)
  data.push(franchiseRow)
  data.push(incentiveRow)
  data.push(officeRow)
  data.push(parkingRow)
  data.push(chargesRow)
  data.push(taxesRow)
  data.push(otherRow)
  data.push(totalRow)

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(data)

  // Set column widths
  const cols: XLSX.ColInfo[] = [{ wch: 52 }]
  for (let i = 0; i < columns.length; i++) {
    cols.push({ wch: 14 })
  }
  ws["!cols"] = cols

  // Apply number formatting
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1")
  const dataStartRow = 17 // Row where financial data starts (0-indexed: Calcul données financières)

  for (let R = dataStartRow; R <= range.e.r; R++) {
    for (let C = 1; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C })
      const cell = ws[addr]
      if (cell && typeof cell.v === "number") {
        // TCAM row uses percentage format
        if (R === 8) {
          cell.z = "0.0000%"
        }
        // Charges growth rate
        else if (R === 13) {
          cell.z = "0.00%"
        }
        // Index values
        else if (R === dataStartRow + 5) {
          cell.z = "0.00"
        }
        // Currency values
        else if (R >= dataStartRow + 6 && cell.v !== 0) {
          cell.z = "#,##0.00"
        }
      }
    }
  }

  // Format date cells (Excel serial dates)
  const dateCells = ["B2", "B3", "B5"]
  for (const addr of dateCells) {
    const cell = ws[addr]
    if (cell && typeof cell.v === "number") {
      cell.z = "DD/MM/YYYY"
    }
  }

  return ws
}

export function exportRentCalculationToExcel(
  result: RentCalculationResult
): void {
  const workbook = XLSX.utils.book_new()

  const sheet = buildClientTemplateExport(result)
  XLSX.utils.book_append_sheet(workbook, sheet, "Calcul loyer")

  const fileName = result.fileName?.replace(/\.pdf$/i, "") || "calcul-loyer"
  XLSX.writeFile(workbook, `${fileName}-echeancier.xlsx`)
}

export function exportRentCalculationToExcelBuffer(
  result: RentCalculationResult
): Buffer {
  const workbook = XLSX.utils.book_new()

  const sheet = buildClientTemplateExport(result)
  XLSX.utils.book_append_sheet(workbook, sheet, "Calcul loyer")

  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }))
}

export function getRentCalculationExcelFileName(
  result: RentCalculationResult
): string {
  const baseName = result.fileName?.replace(/\.pdf$/i, "") || "calcul-loyer"
  return `${baseName}-echeancier.xlsx`
}

export function isRentCalculationResult(data: unknown): boolean {
  if (!data || typeof data !== "object") return false
  const obj = data as Record<string, unknown>

  if (obj.toolType === "calculation-rent") return true

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
