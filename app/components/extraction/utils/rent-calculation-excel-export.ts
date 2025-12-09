/**
 * Excel export matching EXACT client template format "2511_Calcul-Loyer_Template-Livrable.xlsx"
 * Monthly breakdown with day-by-day granularity (ligne 22: # jours/mois)
 */

import * as XLSX from "xlsx"
import type { RentCalculationResult } from "@/app/lib/extraction/rent-calculation-service"

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

function formatDateForExcel(
  isoDate: string | null | undefined
): number | string {
  if (!isoDate) return ""
  const date = new Date(isoDate)
  const epoch = new Date(Date.UTC(1899, 11, 30))
  return Math.floor((date.getTime() - epoch.getTime()) / 86400000)
}

function getValue<T>(field: { value: T } | undefined | null): T | null {
  return field?.value ?? null
}

function round(value: number, decimals: number = 2): number {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals)
}

interface MonthlyBreakdownItem {
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
}

export function generateRentCalculationExcel(
  result: RentCalculationResult
): Buffer {
  const extracted = result.extractedData
  const schedule = result.rentSchedule?.schedule || []
  const summary = result.rentSchedule?.summary
  const input = result.scheduleInput

  if (!schedule.length || !input) {
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([
      ["Aucun échéancier de loyer disponible"],
      [""],
      [
        "Les données nécessaires pour calculer l'échéancier n'ont pas pu être extraites du bail.",
      ],
    ])
    XLSX.utils.book_append_sheet(wb, ws, "Calcul loyer")
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
    return Buffer.from(buffer)
  }

  const wb = XLSX.utils.book_new()
  const wsData: any[][] = []

  // ========== SECTION DONNÉES (Lignes 1-18) ==========
  wsData.push([""]) // Ligne 1
  wsData.push(["", "Données"])

  const effectiveDate = getValue(extracted.calendar.effectiveDate)
  const duration = getValue(extracted.calendar.duration) || 9
  const frequency = getValue(extracted.rent.paymentFrequency)
  const indexType = getValue(extracted.indexation?.indexationType) || "ILAT"
  const referenceQuarter = getValue(extracted.indexation?.referenceQuarter)
  const tcam = summary?.tcam || 0
  const depositMonths = input.depositMonths || 3
  const franchiseMonths = input.franchiseMonths || 0
  const chargesGrowth = input.chargesGrowthRate || 0.02

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

  // Fin premier trimestre
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

  wsData.push([
    "",
    "Date de prise d'effet du bail",
    formatDateForExcel(effectiveDate),
    "",
    "par exemple",
  ])
  wsData.push([
    "",
    "Fin du premier trimestre à compter de la prise d'effet",
    formatDateForExcel(endQ1.toISOString().split("T")[0]),
    "",
    `(fin T${startQuarter} ${startDate.getUTCFullYear().toString().slice(-2)})`,
  ])
  wsData.push([
    "",
    "# jours de la date de prise d'effet jusqu'à fin de trimestre",
    daysUntilEndQ1,
  ])
  const endDateStr = endDateObj.toISOString().split("T")[0]
  wsData.push([
    "",
    "Date de fin de bail",
    formatDateForExcel(endDateStr || null),
    "",
    "(peut être directement indiquée dans le bail)",
  ])
  wsData.push([
    "",
    "Echéance de paiement",
    frequency === "quarterly" ? "Trimestriel" : "Mensuel",
    "",
    "par exemple (peut être mensuel)",
  ])
  wsData.push([
    "",
    "Indice de référence",
    referenceQuarter || `${indexType} (à déterminer)`,
    "",
    "par exemple (aussi possible ILC)",
  ])
  wsData.push([
    "",
    "TCAM = taux d'évolution moyen de l'indice",
    "",
    "",
    "Evolution à compter du dernier indice connu",
  ])
  wsData.push(["", "TCAM valeur", tcam ? round(tcam, 6) : 0])
  wsData.push(["", "Dépôt de garantie (en mois)", depositMonths])
  wsData.push(["", "Franchise (en mois)", franchiseMonths])
  wsData.push([
    "",
    "Echéance de paiement franchise",
    "Mensuellement à compter de la date de prise d'effet",
    "",
    "par exemple",
  ])
  wsData.push(["", "Mesures d'accompagnement", "—", "", "par exemple"])
  wsData.push([
    "",
    "Echéance de paiement mesures d'accompagnement",
    "Sur présentation de facture",
    "",
    "par exemple",
  ])
  wsData.push([
    "",
    "Hypothèses augmentation charges et taxes",
    chargesGrowth,
    "",
    "choix arbitraire",
  ])
  wsData.push([""]) // Ligne 17
  wsData.push([""]) // Ligne 18

  // ========== CALCUL DONNÉES FINANCIÈRES (Ligne 19+) ==========
  wsData.push([
    "",
    "Calcul données financières",
    "Taux indice connu (publié sur site INSEE)",
  ])

  // Build monthly breakdown
  const monthly = buildMonthlyBreakdown(schedule, startDate, endDateObj, input)

  // Ligne 20-21 : Headers
  const headerRow1: any[] = ["", "", "Base bail", ""]
  const headerRow2: any[] = ["", "", frequency || "Trimestriel", ""]
  const daysRow: any[] = ["", "# jours / mois", "", ""]
  const sameDaysRow: any[] = [
    "",
    "# jours même indice jusqu'à fin de trimestre",
    "",
    "",
  ]
  const diffDaysRow: any[] = [
    "",
    "# jours indice différent jusqu'à fin de trimestre",
    "",
    "",
  ]
  const indexRow: any[] = ["", "Taux indice", input.baseIndexValue || "", ""]

  // Data rows
  const depositRow: any[] = [
    "",
    "Dépôt de garantie",
    summary?.depositHT || 0,
    "",
  ]
  const officeRentRow: any[] = ["", "Loyer bureaux HT HC", "", ""]
  const parkingRentRow: any[] = ["", "Loyer parkings HT HC", "", ""]
  const chargesRow: any[] = ["", "Charges HT", "", ""]
  const taxesRow: any[] = ["", "Taxes HT", "", ""]
  const franchiseRow: any[] = ["", "Franchise", "", ""]
  const incentiveRow: any[] = ["", "Mesures d'accompagnement", "", ""]
  const totalRow: any[] = ["", "Total HT", "", ""]

  // Fill monthly columns
  let lastQuarter = 0
  for (const m of monthly) {
    if (m.quarter !== lastQuarter) {
      headerRow1.push(m.quarterLabel)
      lastQuarter = m.quarter
    } else {
      headerRow1.push("")
    }

    headerRow2.push(m.monthName)
    daysRow.push(m.daysInMonth)
    sameDaysRow.push(m.daysSameIndex || 0)
    diffDaysRow.push(m.daysDiffIndex || 0)
    indexRow.push(round(m.indexValue, 2))

    depositRow.push("")
    officeRentRow.push(m.officeRentHT)
    parkingRentRow.push(m.parkingRentHT)
    chargesRow.push(m.chargesHT)
    taxesRow.push(m.taxesHT)
    franchiseRow.push(m.franchiseHT)
    incentiveRow.push(m.incentiveHT)
    totalRow.push(m.totalHT)
  }

  wsData.push(headerRow1)
  wsData.push(headerRow2)
  wsData.push(daysRow)
  wsData.push(sameDaysRow)
  wsData.push(diffDaysRow)
  wsData.push(indexRow)
  wsData.push([""]) // Spacer
  wsData.push(depositRow)
  wsData.push(officeRentRow)
  wsData.push(parkingRentRow)
  wsData.push(chargesRow)
  wsData.push(taxesRow)
  wsData.push(franchiseRow)
  wsData.push(incentiveRow)
  wsData.push(totalRow)

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // Column widths
  const cols: XLSX.ColInfo[] = [
    { wch: 2 },
    { wch: 50 },
    { wch: 18 },
    { wch: 3 },
  ]
  for (let i = 0; i < monthly.length; i++) {
    cols.push({ wch: 12 })
  }
  ws["!cols"] = cols

  XLSX.utils.book_append_sheet(wb, ws, "Calcul loyer")

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
  return Buffer.from(buffer)
}

function buildMonthlyBreakdown(
  schedule: any[],
  startDate: Date,
  endDate: Date,
  input: any
): MonthlyBreakdownItem[] {
  const monthly: MonthlyBreakdownItem[] = []
  let currentDate = new Date(
    Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1)
  )

  const endYear = endDate.getUTCFullYear()
  const endMonth = endDate.getUTCMonth()
  const anniversaryDay = startDate.getUTCDate()
  const anniversaryMonth = startDate.getUTCMonth()

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

    // Anniversary detection
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

    // Find overlapping periods
    const overlappingPeriods = schedule.filter((p: any) => {
      const pStart = new Date(p.periodStart)
      const pEnd = new Date(p.periodEnd)
      return pStart <= monthEnd && pEnd >= monthStart
    })

    let officeRent = 0
    let parkingRent = 0
    let charges = 0
    let taxes = 0
    let franchise = 0
    let indexValue = input.baseIndexValue || 0

    for (const p of overlappingPeriods) {
      const pStart = new Date(p.periodStart)
      const pEnd = new Date(p.periodEnd)

      const overlapStart = pStart > monthStart ? pStart : monthStart
      const overlapEnd = pEnd < monthEnd ? pEnd : monthEnd

      const daysOverlap =
        Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / 86400000) +
        1

      const periodTotalDays =
        Math.floor((pEnd.getTime() - pStart.getTime()) / 86400000) + 1

      const ratio = daysOverlap / periodTotalDays

      officeRent += (p.officeRentHT || 0) * ratio
      parkingRent += (p.parkingRentHT || 0) * ratio
      charges += (p.chargesHT || 0) * ratio
      taxes += (p.taxesHT || 0) * ratio
      franchise += (p.franchiseHT || 0) * ratio
      indexValue = p.indexValue || indexValue
    }

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
      incentiveHT: 0,
      totalHT: round(officeRent + parkingRent + charges + taxes + franchise),
    })

    currentDate = new Date(Date.UTC(year, month + 1, 1))

    if (monthly.length > 120) break
  }

  return monthly
}

export function exportRentCalculationToExcel(
  result: RentCalculationResult
): void {
  const buffer = generateRentCalculationExcel(result)
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
