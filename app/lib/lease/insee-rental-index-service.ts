import { prisma } from "@/app/lib/prisma"
import {
  DEFAULT_LEASE_INDEX_TYPE,
  type KnownIndexPointInput,
  type LeaseIndexType,
} from "./types"

export interface InseeRentalIndexPoint {
  year: number
  quarter: number
  value: number
}

/**
 * Get INSEE rental index series for a specific index type
 * Falls back to default index type if requested type has no data
 */
export async function getInseeRentalIndexSeries(
  indexType: LeaseIndexType = DEFAULT_LEASE_INDEX_TYPE
): Promise<InseeRentalIndexPoint[]> {
  // Try to get data for the requested index type
  const rows = await prisma.insee_rental_reference_index.findMany({
    where: { indexType: indexType },
    orderBy: [{ year: "asc" }, { quarter: "asc" }],
  })

  // If no data for requested type, fallback to default
  if (rows.length === 0 && indexType !== DEFAULT_LEASE_INDEX_TYPE) {
    console.warn(
      `[INSEE] Série ${indexType} demandée mais indisponible (0 enregistrements). ` +
        `Utilisation du fallback ${DEFAULT_LEASE_INDEX_TYPE}.`
    )
    return getInseeRentalIndexSeries(DEFAULT_LEASE_INDEX_TYPE)
  }

  return rows.map((row) => ({
    year: row.year,
    quarter: row.quarter,
    value: row.value,
  }))
}

/**
 * Check which index types have data available in the database
 */
export async function getAvailableIndexTypes(): Promise<LeaseIndexType[]> {
  const result = await prisma.insee_rental_reference_index.groupBy({
    by: ["indexType"],
    _count: true,
  })

  return result
    .filter((r) => (r._count ?? 0) > 0)
    .map((r) => r.indexType as LeaseIndexType)
}

export function buildIndexInputsForLease(
  effectiveDateISO: string | null | undefined,
  horizonYears: number,
  series: InseeRentalIndexPoint[],
  explicitReferenceQuarter?: number | null
): {
  baseIndexValue: number | null
  knownIndexPoints: KnownIndexPointInput[]
  tcam?: number
} {
  if (!series.length) {
    return { baseIndexValue: null, knownIndexPoints: [] }
  }

  const effectiveDate = parseISODateSafe(effectiveDateISO)
  const baseDate = effectiveDate ?? new Date()
  const baseYear = baseDate.getUTCFullYear()
  const anniversaryDay = baseDate.getUTCDate()
  const anniversaryMonth = baseDate.getUTCMonth()

  // Use explicit reference quarter from lease if provided, otherwise calculate from date
  const baseQuarter = explicitReferenceQuarter ?? getQuarter(baseDate)

  const baseRow =
    series.find(
      (row) => row.year === baseYear && row.quarter === baseQuarter
    ) ?? series[series.length - 1]

  const horizonEndYear = baseYear + Math.max(1, horizonYears)

  // Calculate TCAM from historical data (last 3 years if available)
  const tcam = computeTcamFromSeries(series, baseQuarter)

  // Generate index points for anniversary dates (not base year)
  const knownIndexPoints: KnownIndexPointInput[] = []
  let lastKnownIndex = baseRow.value
  let lastKnownYear = baseYear

  for (let year = baseYear + 1; year <= horizonEndYear; year++) {
    const indexRow = series.find(
      (row) => row.year === year && row.quarter === baseQuarter
    )

    const anniversaryDate = new Date(
      Date.UTC(year, anniversaryMonth, anniversaryDay)
    )

    let indexValue: number
    if (indexRow) {
      // Use actual INSEE data if available
      indexValue = indexRow.value
      lastKnownIndex = indexValue
      lastKnownYear = year
    } else if (tcam !== undefined) {
      // Extrapolate using TCAM from last known index
      const yearsFromLastKnown = year - lastKnownYear
      indexValue = lastKnownIndex * Math.pow(1 + tcam, yearsFromLastKnown)
    } else {
      // No TCAM available, use last known value
      indexValue = lastKnownIndex
    }

    knownIndexPoints.push({
      effectiveDate: anniversaryDate.toISOString().split("T")[0]!,
      indexValue: Math.round(indexValue * 100) / 100,
    })
  }

  return {
    baseIndexValue: baseRow.value,
    knownIndexPoints,
    tcam,
  }
}

/**
 * Compute TCAM (Taux de Croissance Annuel Moyen) from historical index data
 * Uses 3 years of data if available for the specified quarter
 */
function computeTcamFromSeries(
  series: InseeRentalIndexPoint[],
  quarter: number
): number | undefined {
  // Filter to only the specified quarter
  const quarterData = series
    .filter((row) => row.quarter === quarter)
    .sort((a, b) => a.year - b.year)

  if (quarterData.length < 2) {
    return undefined
  }

  // Use last 3 years of data if available, otherwise use all available data
  const yearsToUse = Math.min(3, quarterData.length - 1)
  const startIndex = quarterData.length - 1 - yearsToUse
  const endIndex = quarterData.length - 1

  const startValue = quarterData[startIndex].value
  const endValue = quarterData[endIndex].value
  const years = quarterData[endIndex].year - quarterData[startIndex].year

  if (years <= 0 || startValue <= 0) {
    return undefined
  }

  return Math.pow(endValue / startValue, 1 / years) - 1
}

export function getQuarter(date: Date): number {
  return Math.floor(date.getUTCMonth() / 3) + 1
}

export function parseISODateSafe(
  value: string | null | undefined
): Date | null {
  if (!value) {
    return null
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }
  return new Date(
    Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate())
  )
}
