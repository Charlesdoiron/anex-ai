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
  series: InseeRentalIndexPoint[]
): { baseIndexValue: number | null; knownIndexPoints: KnownIndexPointInput[] } {
  if (!series.length) {
    return { baseIndexValue: null, knownIndexPoints: [] }
  }

  const effectiveDate = parseISODateSafe(effectiveDateISO)
  const baseDate = effectiveDate ?? new Date()
  const baseYear = baseDate.getUTCFullYear()
  const baseQuarter = getQuarter(baseDate)
  const anniversaryDay = baseDate.getUTCDate()
  const anniversaryMonth = baseDate.getUTCMonth()

  const baseRow =
    series.find(
      (row) => row.year === baseYear && row.quarter === baseQuarter
    ) ?? series[series.length - 1]

  const horizonEndYear = baseYear + Math.max(1, horizonYears)

  // Only get indices for anniversary dates (same quarter each year)
  // NOT all quarters of all years
  const knownIndexPoints: KnownIndexPointInput[] = []

  for (let year = baseYear; year <= horizonEndYear; year++) {
    const indexRow = series.find(
      (row) => row.year === year && row.quarter === baseQuarter
    )

    if (indexRow) {
      // Set effective date to the actual anniversary date
      const anniversaryDate = new Date(
        Date.UTC(year, anniversaryMonth, anniversaryDay)
      )
      knownIndexPoints.push({
        effectiveDate: anniversaryDate.toISOString().split("T")[0]!,
        indexValue: indexRow.value,
      })
    }
  }

  return {
    baseIndexValue: baseRow.value,
    knownIndexPoints,
  }
}

function getQuarter(date: Date): number {
  return Math.floor(date.getUTCMonth() / 3) + 1
}

function toQuarterStartISO(year: number, quarter: number): string {
  const monthIndex = (quarter - 1) * 3
  const date = new Date(Date.UTC(year, monthIndex, 1))
  return date.toISOString().split("T")[0]!
}

function parseISODateSafe(value: string | null | undefined): Date | null {
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
