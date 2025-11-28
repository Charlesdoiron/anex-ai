/**
 * Filter utilities for extraction summaries
 * Designed to handle LLM-generated data with missing values gracefully
 */

import type { LeaseRegime } from "@/app/lib/extraction/types"

// Regime filter (discrete enum values)
export const REGIME_OPTIONS = [
  { value: "commercial", label: "Commercial", icon: "🏢" },
  { value: "civil", label: "Civil", icon: "📄" },
  { value: "précaire", label: "Précaire", icon: "⏳" },
  { value: "dérogatoire", label: "Dérogatoire", icon: "📋" },
  { value: "BEFA", label: "BEFA", icon: "🏗️" },
] as const

// Duration ranges (years) - common commercial lease durations
export const DURATION_OPTIONS = [
  { value: "short", label: "≤ 3 ans", min: 0, max: 3 },
  { value: "medium", label: "4-6 ans", min: 4, max: 6 },
  { value: "long", label: "7-9 ans", min: 7, max: 9 },
  { value: "very_long", label: "> 9 ans", min: 10, max: Infinity },
] as const

// Surface ranges (m²)
export const SURFACE_OPTIONS = [
  { value: "small", label: "< 100 m²", min: 0, max: 99 },
  { value: "medium", label: "100-500 m²", min: 100, max: 500 },
  { value: "large", label: "500-1000 m²", min: 500, max: 1000 },
  { value: "very_large", label: "> 1000 m²", min: 1001, max: Infinity },
] as const

// Annual rent ranges (€)
export const RENT_OPTIONS = [
  { value: "low", label: "< 50k €", min: 0, max: 49999 },
  { value: "medium", label: "50-100k €", min: 50000, max: 100000 },
  { value: "high", label: "100-200k €", min: 100001, max: 200000 },
  { value: "very_high", label: "> 200k €", min: 200001, max: Infinity },
] as const

// Purpose normalization - maps LLM variations to categories
const PURPOSE_MAPPINGS: Record<string, string> = {
  bureaux: "bureaux",
  bureau: "bureaux",
  offices: "bureaux",
  office: "bureaux",
  commerce: "commerce",
  boutique: "commerce",
  magasin: "commerce",
  retail: "commerce",
  restauration: "restauration",
  restaurant: "restauration",
  café: "restauration",
  bar: "restauration",
  entrepôt: "logistique",
  entrepot: "logistique",
  stockage: "logistique",
  logistique: "logistique",
  warehouse: "logistique",
  industrie: "industrie",
  industriel: "industrie",
  atelier: "industrie",
  usine: "industrie",
  mixte: "mixte",
}

export const PURPOSE_OPTIONS = [
  { value: "bureaux", label: "Bureaux", icon: "💼" },
  { value: "commerce", label: "Commerce", icon: "🛍️" },
  { value: "restauration", label: "Restauration", icon: "🍽️" },
  { value: "logistique", label: "Logistique", icon: "📦" },
  { value: "industrie", label: "Industrie", icon: "🏭" },
  { value: "mixte", label: "Mixte", icon: "🔀" },
] as const

/**
 * Normalize purpose text to a standard category
 * Returns null if unable to categorize (avoids false positives)
 */
export function normalizePurpose(
  rawPurpose: string | null | undefined
): string | null {
  if (!rawPurpose) return null

  const normalized = rawPurpose.toLowerCase().trim()

  // Direct match
  if (PURPOSE_MAPPINGS[normalized]) {
    return PURPOSE_MAPPINGS[normalized]
  }

  // Partial match (contains keyword)
  for (const [key, category] of Object.entries(PURPOSE_MAPPINGS)) {
    if (normalized.includes(key)) {
      return category
    }
  }

  return null
}

/**
 * Filter state types
 */
export interface ExtractionFilters {
  regime: LeaseRegime[]
  duration: string[] // 'short' | 'medium' | 'long' | 'very_long'
  surface: string[] // 'small' | 'medium' | 'large' | 'very_large'
  rent: string[] // 'low' | 'medium' | 'high' | 'very_high'
  purpose: string[] // normalized categories
}

export const EMPTY_FILTERS: ExtractionFilters = {
  regime: [],
  duration: [],
  surface: [],
  rent: [],
  purpose: [],
}

/**
 * Filterable extraction summary
 */
export interface FilterableExtractionSummary {
  id: string
  documentId: string
  fileName: string
  fileSize: number | null
  pageCount: number | null
  pipelineId: string | null
  createdAt: string
  // Filterable fields
  regime: LeaseRegime | null
  duration: number | null
  surfaceArea: number | null
  annualRent: number | null
  purpose: string | null // normalized
  averageConfidence: number | null
}

/**
 * Check if an extraction matches the current filters
 * Returns true if no filters are active or if extraction matches all active filters
 */
export function matchesFilters(
  extraction: FilterableExtractionSummary,
  filters: ExtractionFilters
): boolean {
  // Regime filter
  if (filters.regime.length > 0) {
    if (!extraction.regime || !filters.regime.includes(extraction.regime)) {
      return false
    }
  }

  // Duration filter
  if (filters.duration.length > 0) {
    if (extraction.duration === null) return false
    const matchesDuration = filters.duration.some((rangeKey) => {
      const range = DURATION_OPTIONS.find((r) => r.value === rangeKey)
      if (!range) return false
      return (
        extraction.duration! >= range.min && extraction.duration! <= range.max
      )
    })
    if (!matchesDuration) return false
  }

  // Surface filter
  if (filters.surface.length > 0) {
    if (extraction.surfaceArea === null) return false
    const matchesSurface = filters.surface.some((rangeKey) => {
      const range = SURFACE_OPTIONS.find((r) => r.value === rangeKey)
      if (!range) return false
      return (
        extraction.surfaceArea! >= range.min &&
        extraction.surfaceArea! <= range.max
      )
    })
    if (!matchesSurface) return false
  }

  // Rent filter
  if (filters.rent.length > 0) {
    if (extraction.annualRent === null) return false
    const matchesRent = filters.rent.some((rangeKey) => {
      const range = RENT_OPTIONS.find((r) => r.value === rangeKey)
      if (!range) return false
      return (
        extraction.annualRent! >= range.min &&
        extraction.annualRent! <= range.max
      )
    })
    if (!matchesRent) return false
  }

  // Purpose filter
  if (filters.purpose.length > 0) {
    if (!extraction.purpose || !filters.purpose.includes(extraction.purpose)) {
      return false
    }
  }

  return true
}

/**
 * Count active filters
 */
export function countActiveFilters(filters: ExtractionFilters): number {
  return (
    filters.regime.length +
    filters.duration.length +
    filters.surface.length +
    filters.rent.length +
    filters.purpose.length
  )
}

/**
 * Get filter statistics from a list of extractions
 * Useful for showing counts next to filter options
 */
export function getFilterStats(extractions: FilterableExtractionSummary[]) {
  const stats = {
    regime: {} as Record<string, number>,
    duration: {} as Record<string, number>,
    surface: {} as Record<string, number>,
    rent: {} as Record<string, number>,
    purpose: {} as Record<string, number>,
    missing: {
      regime: 0,
      duration: 0,
      surface: 0,
      rent: 0,
      purpose: 0,
    },
  }

  for (const extraction of extractions) {
    // Regime
    if (extraction.regime) {
      stats.regime[extraction.regime] =
        (stats.regime[extraction.regime] || 0) + 1
    } else {
      stats.missing.regime++
    }

    // Duration
    if (extraction.duration !== null) {
      for (const range of DURATION_OPTIONS) {
        if (
          extraction.duration >= range.min &&
          extraction.duration <= range.max
        ) {
          stats.duration[range.value] = (stats.duration[range.value] || 0) + 1
          break
        }
      }
    } else {
      stats.missing.duration++
    }

    // Surface
    if (extraction.surfaceArea !== null) {
      for (const range of SURFACE_OPTIONS) {
        if (
          extraction.surfaceArea >= range.min &&
          extraction.surfaceArea <= range.max
        ) {
          stats.surface[range.value] = (stats.surface[range.value] || 0) + 1
          break
        }
      }
    } else {
      stats.missing.surface++
    }

    // Rent
    if (extraction.annualRent !== null) {
      for (const range of RENT_OPTIONS) {
        if (
          extraction.annualRent >= range.min &&
          extraction.annualRent <= range.max
        ) {
          stats.rent[range.value] = (stats.rent[range.value] || 0) + 1
          break
        }
      }
    } else {
      stats.missing.rent++
    }

    // Purpose
    if (extraction.purpose) {
      stats.purpose[extraction.purpose] =
        (stats.purpose[extraction.purpose] || 0) + 1
    } else {
      stats.missing.purpose++
    }
  }

  return stats
}

