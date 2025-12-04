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

export async function getInseeRentalIndexSeries(
  indexType: LeaseIndexType = DEFAULT_LEASE_INDEX_TYPE
): Promise<InseeRentalIndexPoint[]> {
  if (indexType !== DEFAULT_LEASE_INDEX_TYPE) {
    console.warn(
      `[INSEE] Série ${indexType} demandée mais indisponible. Utilisation du fallback ${DEFAULT_LEASE_INDEX_TYPE}.`
    )
  }

  const rows = await prisma.insee_rental_reference_index.findMany({
    orderBy: [{ year: "asc" }, { quarter: "asc" }],
  })

  return rows.map((row) => ({
    year: row.year,
    quarter: row.quarter,
    value: row.value,
  }))
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

  const baseRow =
    series.find(
      (row) => row.year === baseYear && row.quarter === baseQuarter
    ) ?? series[series.length - 1]

  const horizonEndYear = baseYear + Math.max(1, horizonYears)
  const knownIndexPoints: KnownIndexPointInput[] = series
    .filter((row) => row.year >= baseRow.year && row.year <= horizonEndYear)
    .map((row) => ({
      effectiveDate: toQuarterStartISO(row.year, row.quarter),
      indexValue: row.value,
    }))

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
