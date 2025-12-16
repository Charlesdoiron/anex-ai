/**
 * Excel export for rent calculation results
 * Produces a clean, formatted spreadsheet with monthly breakdown and yearly summaries
 */

import ExcelJS from "exceljs"
import type {
  RentCalculationResult,
  RentCalculationExtractedData,
} from "@/app/lib/extraction/rent-calculation-service"

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

function getDaysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

function formatDateFr(isoDate: string | null | undefined): string {
  if (!isoDate) return ""
  const date = new Date(isoDate)
  const day = String(date.getUTCDate()).padStart(2, "0")
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  const year = date.getUTCFullYear()
  return `${day}/${month}/${year}`
}

function getValue<T>(field: { value: T } | undefined | null): T | null {
  return field?.value ?? null
}

function round(value: number, decimals: number = 2): number {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals)
}

interface MonthlyData {
  year: number
  month: number
  monthName: string
  quarter: number
  quarterLabel: string
  daysInMonth: number
  daysInBail: number
  daysSameIndex: number
  daysDiffIndex: number
  indexValue: number
  officeRentHT: number
  parkingRentHT: number
  chargesHT: number
  taxesHT: number
  franchiseHT: number
  incentiveHT: number
  totalHT: number
  isFirstMonthOfYear?: boolean
  isLastMonthOfYear?: boolean
}

interface YearlySummary {
  year: number
  officeRentHT: number
  parkingRentHT: number
  chargesHT: number
  taxesHT: number
  franchiseHT: number
  incentiveHT: number
  totalHT: number
}

export async function generateRentCalculationExcel(
  result: RentCalculationResult
): Promise<Buffer> {
  const extracted = result.extractedData
  const schedule = result.rentSchedule?.schedule || []
  const summary = result.rentSchedule?.summary
  const input = result.scheduleInput

  const workbook = new ExcelJS.Workbook()

  if (!schedule.length || !input) {
    const ws = workbook.addWorksheet("Calcul loyer")
    ws.getCell("A1").value = "Aucun échéancier de loyer disponible"
    ws.getCell("A3").value =
      "Les données nécessaires pour calculer l'échéancier n'ont pas pu être extraites du bail."
    const buffer = await workbook.xlsx.writeBuffer()
    return Buffer.from(buffer)
  }

  const ws = workbook.addWorksheet("Calcul loyer")

  // Extract input data - use scheduleInput values (with fallbacks) for accuracy
  const effectiveDate = getValue(extracted.calendar.effectiveDate)
  const duration = getValue(extracted.calendar.duration) || 9
  // Use input.paymentFrequency which has the fallback applied
  const isQuarterly = input.paymentFrequency === "quarterly"
  // Use input.indexType which has the fallback applied
  const indexType = input.indexType || "ILAT"
  const referenceQuarter = getValue(extracted.indexation?.referenceQuarter)
  const tcam = summary?.tcam || 0
  const depositMonths = input.depositMonths || 3
  const franchiseMonths = input.franchiseMonths || 0
  const chargesGrowthRate = input.chargesGrowthRate || 0.02

  const startDate = effectiveDate
    ? new Date(effectiveDate)
    : new Date(schedule[0].periodStart)
  const endDateObj =
    schedule.length > 0
      ? new Date(schedule[schedule.length - 1].periodEnd)
      : (() => {
          const end = new Date(startDate)
          end.setUTCFullYear(end.getUTCFullYear() + duration)
          return end
        })()

  // Calculate first quarter end
  const startQuarter = Math.floor(startDate.getUTCMonth() / 3) + 1
  const endQ1Month = startQuarter * 3 - 1
  const endQ1 = new Date(
    Date.UTC(
      startDate.getUTCFullYear(),
      endQ1Month,
      getDaysInMonth(startDate.getUTCFullYear(), endQ1Month)
    )
  )
  const daysUntilEndQ1 =
    Math.floor((endQ1.getTime() - startDate.getTime()) / 86400000) + 1

  // Base rent per period (from input)
  const baseOfficeRent = input.officeRentHT || 0
  const baseParkingRent = input.parkingRentHT || 0
  const baseCharges = input.chargesHT || 0
  const baseTaxes = input.taxesHT || 0

  // Styles
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

  // ========== SECTION DONNÉES (Rows 1-17) ==========
  let row = 1
  ws.getCell(row, 1).value = ""
  row++

  // Title row with gray background
  ws.getCell(row, 2).value = "Données"
  ws.getCell(row, 2).font = { bold: true, size: 12 }
  ws.getCell(row, 2).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE7E6E6" },
  }
  ws.getCell(row, 2).border = allBorders
  row++

  // Data rows
  const dataRows = [
    ["Date de prise d'effet du bail", formatDateFr(effectiveDate)],
    [
      "Fin du premier trimestre à compter de la prise d'effet",
      formatDateFr(endQ1.toISOString().split("T")[0]),
    ],
    [
      "# jours de la date de prise d'effet jusqu'à fin de trimestre",
      daysUntilEndQ1,
    ],
    [
      "Date de fin de bail",
      formatDateFr(endDateObj.toISOString().split("T")[0]),
    ],
    ["Échéance de paiement", isQuarterly ? "Trimestriel" : "Mensuel"],
    [
      "Indice de référence",
      referenceQuarter
        ? referenceQuarter.includes(indexType)
          ? referenceQuarter
          : `${indexType} ${referenceQuarter}`
        : indexType,
    ],
    ["Dépôt de garantie (en mois)", depositMonths || ""],
    // Only show franchise fields if franchise is actually present
    ...(franchiseMonths > 0
      ? ([["Franchise (en mois)", franchiseMonths]] as Array<
          [string, string | number]
        >)
      : []),
    // Other support measures - only show if data is present
    ...(hasOtherMeasures(extracted)
      ? ([
          [
            "Autres mesures d'accompagnement",
            getOtherMeasuresDescription(extracted),
          ],
        ] as Array<[string, string | number]>)
      : []),
    [
      "Hypothèses augmentation charges et taxes (en %)",
      `${round(chargesGrowthRate * 100, 1)}%`,
    ],
  ]

  for (const [label, value] of dataRows) {
    ws.getCell(row, 2).value = label
    ws.getCell(row, 3).value = value
    ws.getCell(row, 2).border = allBorders
    ws.getCell(row, 3).border = allBorders
    row++
  }

  row++ // Empty row
  row++ // Empty row

  // ========== SECTION CALCUL DONNÉES FINANCIÈRES ==========
  const calcStartRow = row
  ws.getCell(row, 2).value = "Calcul données financières"
  ws.getCell(row, 2).font = { bold: true, size: 12 }
  ws.getCell(row, 2).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE7E6E6" },
  }
  ws.getCell(row, 2).border = allBorders
  row++

  // Build monthly breakdown
  const monthly = buildMonthlyBreakdown(schedule, startDate, endDateObj, input)
  const yearlySummaries = buildYearlySummaries(monthly)

  // Column structure:
  // Col A: empty
  // Col B: Row labels
  // Col C: Base bail (base values)
  // Col D: empty separator
  // Col E onwards: months with yearly summary columns inserted

  // Build column headers with year summaries
  const periodLabel = isQuarterly ? "(trimestriel)" : "(mensuel)"
  const headerRow1: (string | number | null)[] = ["", "", "Valeur initiale", ""]
  const headerRow2: (string | number | null)[] = ["", "", "", ""]

  // Track column indices for yearly summaries
  const yearSummaryColumns: number[] = []
  let currentYear = monthly[0]?.year
  let colIndex = 5 // Start from column E (1-indexed)

  for (let i = 0; i < monthly.length; i++) {
    const m = monthly[i]

    // Check if we need to insert a year summary column
    if (m.year !== currentYear) {
      // Insert year summary column
      yearSummaryColumns.push(colIndex)
      headerRow1.push(`Total ${currentYear}`)
      headerRow2.push("")
      colIndex++
      currentYear = m.year
    }

    // Add month column
    if (m.month % 3 === 0) {
      // First month of quarter, show quarter label
      headerRow1.push(m.quarterLabel)
    } else {
      headerRow1.push("")
    }
    headerRow2.push(m.monthName)
    colIndex++
  }

  // Add final year summary
  yearSummaryColumns.push(colIndex)
  headerRow1.push(`Total ${currentYear}`)
  headerRow2.push("")

  // Write header rows with highlighting for year summary columns
  for (let c = 0; c < headerRow1.length; c++) {
    const cell = ws.getCell(row, c + 1)
    cell.value = headerRow1[c]
    cell.font = { bold: true }
    cell.border = allBorders
    // Highlight year total columns
    const headerValue = String(headerRow1[c] || "")
    if (headerValue.startsWith("Total ")) {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF2F2F2" },
      }
    }
  }
  row++

  for (let c = 0; c < headerRow2.length; c++) {
    const cell = ws.getCell(row, c + 1)
    cell.value = headerRow2[c]
    cell.border = allBorders
    // Also highlight year total column in second header row
    const headerAbove = String(headerRow1[c] || "")
    if (headerAbove.startsWith("Total ")) {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF2F2F2" },
      }
    }
  }
  row++

  // Data rows - periodLabel indicates monthly or quarterly
  const rowLabels = [
    "# jours / mois",
    "# jours même indice",
    "# jours indice différent",
    "Taux indice",
    "", // Empty spacer
    "Dépôt de garantie",
    `Loyer bureaux HT HC ${periodLabel}`,
    `Loyer parkings HT HC ${periodLabel}`,
    `Charges HT ${periodLabel}`,
    `Taxes HT ${periodLabel}`,
    "Franchise",
    "Mesures d'accompagnement",
    "Total HT",
  ]

  // Base values column
  const baseValues: (number | string | null)[] = [
    null, // days
    null, // same index days
    null, // diff index days
    input.baseIndexValue || null, // index
    null, // spacer
    summary?.depositHT || null, // deposit
    baseOfficeRent, // office rent base
    baseParkingRent, // parking rent base
    baseCharges, // charges base
    baseTaxes, // taxes base
    null, // franchise
    null, // incentive
    null, // total
  ]

  for (let r = 0; r < rowLabels.length; r++) {
    const label = rowLabels[r]
    ws.getCell(row, 2).value = label
    ws.getCell(row, 3).value = baseValues[r]
    ws.getCell(row, 2).border = allBorders
    ws.getCell(row, 3).border = allBorders

    // Special formatting for Total row
    if (label === "Total HT") {
      ws.getCell(row, 2).font = { bold: true }
    }

    // Build data columns
    let dataCol = 5
    let yearIndex = 0
    let summaryColIdx = 0

    for (let m = 0; m < monthly.length; m++) {
      const md = monthly[m]

      // Check if we need a year summary column before this month
      if (m > 0 && monthly[m].year !== monthly[m - 1].year) {
        // Insert year summary with highlighting
        const ys = yearlySummaries[yearIndex]
        if (ys) {
          const summaryValue = getRowValueFromYearlySummary(ys, label)
          const cell = ws.getCell(row, dataCol)
          cell.value = summaryValue
          cell.border = allBorders
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF2F2F2" },
          }
          if (label === "Total HT") {
            cell.font = { bold: true }
          }
        }
        dataCol++
        yearIndex++
        summaryColIdx++
      }

      // Add month value
      const value = getRowValueFromMonthly(md, label)
      ws.getCell(row, dataCol).value = value
      ws.getCell(row, dataCol).border = allBorders

      dataCol++
    }

    // Final year summary with highlighting
    const lastYs = yearlySummaries[yearlySummaries.length - 1]
    if (lastYs) {
      const summaryValue = getRowValueFromYearlySummary(lastYs, label)
      const cell = ws.getCell(row, dataCol)
      cell.value = summaryValue
      cell.border = allBorders
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF2F2F2" },
      }
      if (label === "Total HT") {
        cell.font = { bold: true }
      }
    }

    row++
  }

  // Set column widths
  ws.getColumn(1).width = 3
  ws.getColumn(2).width = 45
  ws.getColumn(3).width = 15
  ws.getColumn(4).width = 3
  for (let c = 5; c <= ws.columnCount; c++) {
    ws.getColumn(c).width = 12
  }

  // Freeze header rows
  ws.views = [{ state: "frozen", ySplit: calcStartRow + 2 }]

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

function getRowValueFromMonthly(
  m: MonthlyData,
  label: string
): number | string | null {
  if (label === "# jours / mois") return m.daysInMonth
  if (label === "# jours même indice") return m.daysSameIndex
  if (label === "# jours indice différent") return m.daysDiffIndex
  if (label === "Taux indice") return round(m.indexValue, 2)
  if (label === "Dépôt de garantie") return null
  if (label.startsWith("Loyer bureaux HT HC")) return m.officeRentHT
  if (label.startsWith("Loyer parkings HT HC")) return m.parkingRentHT
  if (label.startsWith("Charges HT")) return m.chargesHT
  if (label.startsWith("Taxes HT")) return m.taxesHT
  if (label === "Franchise") return m.franchiseHT !== 0 ? m.franchiseHT : null
  if (label === "Mesures d'accompagnement")
    return m.incentiveHT !== 0 ? m.incentiveHT : null
  if (label === "Total HT") return m.totalHT
  return null
}

function getRowValueFromYearlySummary(
  ys: YearlySummary,
  label: string
): number | string | null {
  if (
    label === "# jours / mois" ||
    label === "# jours même indice" ||
    label === "# jours indice différent" ||
    label === "Taux indice" ||
    label === "Dépôt de garantie"
  )
    return null
  if (label.startsWith("Loyer bureaux HT HC")) return round(ys.officeRentHT)
  if (label.startsWith("Loyer parkings HT HC")) return round(ys.parkingRentHT)
  if (label.startsWith("Charges HT")) return round(ys.chargesHT)
  if (label.startsWith("Taxes HT")) return round(ys.taxesHT)
  if (label === "Franchise")
    return ys.franchiseHT !== 0 ? round(ys.franchiseHT) : null
  if (label === "Mesures d'accompagnement")
    return ys.incentiveHT !== 0 ? round(ys.incentiveHT) : null
  if (label === "Total HT") return round(ys.totalHT)
  return null
}

function buildMonthlyBreakdown(
  schedule: any[],
  startDate: Date,
  endDate: Date,
  input: any
): MonthlyData[] {
  const monthly: MonthlyData[] = []
  let currentDate = new Date(
    Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1)
  )

  const endYear = endDate.getUTCFullYear()
  const endMonth = endDate.getUTCMonth()
  const anniversaryDay = startDate.getUTCDate()
  const anniversaryMonth = startDate.getUTCMonth()

  const paymentFrequency = input.paymentFrequency || "quarterly"
  const isQuarterlyPayment = paymentFrequency === "quarterly"
  const baseIndex = input.baseIndexValue || 0
  const chargesGrowthRate = input.chargesGrowthRate || 0
  const franchiseMonths = input.franchiseMonths || 0

  const knownIndexPoints = (input.knownIndexPoints || []) as Array<{
    effectiveDate: string
    indexValue: number
  }>

  let franchiseMonthsRemaining = franchiseMonths
  let incentiveBalance = input.incentiveAmount || 0

  while (
    currentDate.getUTCFullYear() < endYear ||
    (currentDate.getUTCFullYear() === endYear &&
      currentDate.getUTCMonth() <= endMonth)
  ) {
    const year = currentDate.getUTCFullYear()
    const month = currentDate.getUTCMonth()
    const monthName = MONTH_NAMES_FR[month]
    const quarter = Math.floor(month / 3) + 1
    const quarterLabel = `${quarter}T${year.toString().slice(-2)}`

    const daysInMonth = getDaysInMonth(year, month)
    const monthStart = new Date(Date.UTC(year, month, 1))
    const monthEnd = new Date(Date.UTC(year, month, daysInMonth))

    const effectiveStart = monthStart < startDate ? startDate : monthStart
    const effectiveEnd = monthEnd > endDate ? endDate : monthEnd

    const daysInBail =
      effectiveStart <= effectiveEnd
        ? Math.floor(
            (effectiveEnd.getTime() - effectiveStart.getTime()) / 86400000
          ) + 1
        : 0

    // Anniversary detection for index change
    const isAnniversaryMonth =
      month === anniversaryMonth && year > startDate.getUTCFullYear()
    let daysSameIndex = daysInBail
    let daysDiffIndex = 0

    if (isAnniversaryMonth && daysInBail > 0) {
      const anniversaryDate = new Date(Date.UTC(year, month, anniversaryDay))
      if (
        anniversaryDate >= effectiveStart &&
        anniversaryDate <= effectiveEnd
      ) {
        daysSameIndex = anniversaryDay - effectiveStart.getUTCDate()
        if (daysSameIndex < 0) daysSameIndex = 0
        daysDiffIndex = daysInBail - daysSameIndex
      }
    }

    // Calculate index value
    let anniversariesPassed = 0
    for (let y = startDate.getUTCFullYear() + 1; y <= year; y++) {
      if (y < year || (y === year && month >= anniversaryMonth)) {
        anniversariesPassed++
      }
    }

    let indexValue = baseIndex
    if (anniversariesPassed > 0 && knownIndexPoints.length > 0) {
      const pointIndex = Math.min(
        anniversariesPassed - 1,
        knownIndexPoints.length - 1
      )
      indexValue = knownIndexPoints[pointIndex]?.indexValue || baseIndex
    }

    // Note: charges and taxes growth is already applied in the schedule
    // by the rent-schedule-calculator, so we use values directly

    // Find overlapping periods for rent calculation
    const overlappingPeriods = schedule.filter((p: any) => {
      const pStart = new Date(p.periodStart)
      const pEnd = new Date(p.periodEnd)
      return pStart <= monthEnd && pEnd >= monthStart
    })

    const isLastMonthOfQuarter = month % 3 === 2

    let officeRent = 0
    let parkingRent = 0
    let charges = 0
    let taxes = 0
    let franchise = 0
    let incentive = 0

    for (const p of overlappingPeriods) {
      const pStart = new Date(p.periodStart)
      const pEnd = new Date(p.periodEnd)

      const periodEndMonth = pEnd.getUTCMonth()
      const periodEndYear = pEnd.getUTCFullYear()
      const isPeriodEndingThisMonth =
        periodEndMonth === month && periodEndYear === year

      // For quarterly payments: only show rent on last month of quarter
      if (
        isQuarterlyPayment &&
        !isLastMonthOfQuarter &&
        !isPeriodEndingThisMonth
      ) {
        continue
      }

      const overlapStart = pStart > monthStart ? pStart : monthStart
      const overlapEnd = pEnd < monthEnd ? pEnd : monthEnd
      const daysOverlap =
        Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / 86400000) +
        1
      const periodTotalDays =
        Math.floor((pEnd.getTime() - pStart.getTime()) / 86400000) + 1

      const ratio =
        isQuarterlyPayment && isLastMonthOfQuarter && isPeriodEndingThisMonth
          ? 1
          : daysOverlap / periodTotalDays

      officeRent += (p.officeRentHT || 0) * ratio
      parkingRent += (p.parkingRentHT || 0) * ratio

      // Charges and taxes from schedule already include growth rate application
      charges += (p.chargesHT || 0) * ratio
      taxes += (p.taxesHT || 0) * ratio

      // Franchise from schedule (already calculated correctly there)
      franchise += (p.franchiseHT || 0) * ratio
    }

    // Handle incentives (only apply once in first period)
    if (incentiveBalance > 0 && monthly.length === 0) {
      incentive = -incentiveBalance
      incentiveBalance = 0
    }

    const totalHT = round(
      officeRent + parkingRent + charges + taxes + franchise + incentive
    )

    monthly.push({
      year,
      month,
      monthName,
      quarter,
      quarterLabel,
      daysInMonth,
      daysInBail,
      daysSameIndex,
      daysDiffIndex,
      indexValue,
      officeRentHT: round(officeRent),
      parkingRentHT: round(parkingRent),
      chargesHT: round(charges),
      taxesHT: round(taxes),
      franchiseHT: round(franchise),
      incentiveHT: round(incentive),
      totalHT,
      isFirstMonthOfYear: month === 0,
      isLastMonthOfYear: month === 11,
    })

    currentDate = new Date(Date.UTC(year, month + 1, 1))

    if (monthly.length > 150) break
  }

  return monthly
}

function buildYearlySummaries(monthly: MonthlyData[]): YearlySummary[] {
  const summaries = new Map<number, YearlySummary>()

  for (const m of monthly) {
    const existing = summaries.get(m.year) || {
      year: m.year,
      officeRentHT: 0,
      parkingRentHT: 0,
      chargesHT: 0,
      taxesHT: 0,
      franchiseHT: 0,
      incentiveHT: 0,
      totalHT: 0,
    }

    existing.officeRentHT += m.officeRentHT
    existing.parkingRentHT += m.parkingRentHT
    existing.chargesHT += m.chargesHT
    existing.taxesHT += m.taxesHT
    existing.franchiseHT += m.franchiseHT
    existing.incentiveHT += m.incentiveHT
    existing.totalHT += m.totalHT

    summaries.set(m.year, existing)
  }

  return Array.from(summaries.values()).sort((a, b) => a.year - b.year)
}

export async function exportRentCalculationToExcel(
  result: RentCalculationResult
): Promise<void> {
  const buffer = await generateRentCalculationExcel(result)
  const uint8Array = new Uint8Array(buffer)
  const blob = new Blob([uint8Array], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `${result.fileName.replace(/\.[^/.]+$/, "")}_calcul-loyer.xlsx`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function isRentCalculationResult(
  data: unknown
): data is RentCalculationResult {
  return (
    typeof data === "object" &&
    data !== null &&
    "toolType" in data &&
    data.toolType === "calculation-rent" &&
    "extractedData" in data &&
    "rentSchedule" in data
  )
}

function hasOtherMeasures(extracted: RentCalculationExtractedData): boolean {
  const desc = extracted.supportMeasures?.otherMeasuresDescription?.value
  return Boolean(
    desc && desc !== "Non mentionné" && desc !== "Non" && desc !== "—"
  )
}

function getOtherMeasuresDescription(
  extracted: RentCalculationExtractedData
): string {
  const desc = extracted.supportMeasures?.otherMeasuresDescription?.value
  if (!desc || desc === "Non mentionné" || desc === "Non") {
    return ""
  }
  return desc
}
