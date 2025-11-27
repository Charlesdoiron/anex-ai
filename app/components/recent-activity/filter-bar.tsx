"use client"

import { useState, useCallback, useMemo } from "react"
import { ChevronDown, X } from "lucide-react"
import {
  ExtractionFilters,
  EMPTY_FILTERS,
  REGIME_OPTIONS,
  DURATION_OPTIONS,
  SURFACE_OPTIONS,
  PURPOSE_OPTIONS,
  countActiveFilters,
  getFilterStats,
  type FilterableExtractionSummary,
} from "./filter-utils"
import type { LeaseRegime } from "@/app/lib/extraction/types"

interface FilterBarProps {
  extractions: FilterableExtractionSummary[]
  filters: ExtractionFilters
  onFiltersChange: (filters: ExtractionFilters) => void
  filteredCount: number
}

type FilterCategory = "regime" | "duration" | "surface" | "purpose"

export default function FilterBar({
  extractions,
  filters,
  onFiltersChange,
  filteredCount,
}: FilterBarProps) {
  const [openDropdown, setOpenDropdown] = useState<FilterCategory | null>(null)

  const stats = useMemo(() => getFilterStats(extractions), [extractions])
  const activeCount = countActiveFilters(filters)

  const toggleDropdown = useCallback((category: FilterCategory) => {
    setOpenDropdown((prev) => (prev === category ? null : category))
  }, [])

  const toggleFilter = useCallback(
    (category: FilterCategory, value: string) => {
      const currentValues = filters[category] as string[]
      const newValues = currentValues.includes(value)
        ? currentValues.filter((v) => v !== value)
        : [...currentValues, value]

      onFiltersChange({
        ...filters,
        [category]: newValues,
      })
    },
    [filters, onFiltersChange]
  )

  const clearFilters = useCallback(() => {
    onFiltersChange(EMPTY_FILTERS)
    setOpenDropdown(null)
  }, [onFiltersChange])

  const clearCategory = useCallback(
    (category: FilterCategory) => {
      onFiltersChange({
        ...filters,
        [category]: [],
      })
    },
    [filters, onFiltersChange]
  )

  if (extractions.length === 0) return null

  return (
    <div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Regime filter */}
        <FilterDropdown
          label="Régime"
          category="regime"
          options={REGIME_OPTIONS.map((o) => ({
            value: o.value,
            label: o.label,
            count: stats.regime[o.value] || 0,
          }))}
          selectedValues={filters.regime}
          isOpen={openDropdown === "regime"}
          onToggle={() => toggleDropdown("regime")}
          onSelect={(value) => toggleFilter("regime", value as LeaseRegime)}
          onClear={() => clearCategory("regime")}
        />

        {/* Duration filter */}
        <FilterDropdown
          label="Durée"
          category="duration"
          options={DURATION_OPTIONS.map((o) => ({
            value: o.value,
            label: o.label,
            count: stats.duration[o.value] || 0,
          }))}
          selectedValues={filters.duration}
          isOpen={openDropdown === "duration"}
          onToggle={() => toggleDropdown("duration")}
          onSelect={(value) => toggleFilter("duration", value)}
          onClear={() => clearCategory("duration")}
        />

        {/* Surface filter */}
        <FilterDropdown
          label="Surface"
          category="surface"
          options={SURFACE_OPTIONS.map((o) => ({
            value: o.value,
            label: o.label,
            count: stats.surface[o.value] || 0,
          }))}
          selectedValues={filters.surface}
          isOpen={openDropdown === "surface"}
          onToggle={() => toggleDropdown("surface")}
          onSelect={(value) => toggleFilter("surface", value)}
          onClear={() => clearCategory("surface")}
        />

        {/* Purpose filter */}
        <FilterDropdown
          label="Destination"
          category="purpose"
          options={PURPOSE_OPTIONS.map((o) => ({
            value: o.value,
            label: o.label,
            count: stats.purpose[o.value] || 0,
          }))}
          selectedValues={filters.purpose}
          isOpen={openDropdown === "purpose"}
          onToggle={() => toggleDropdown("purpose")}
          onSelect={(value) => toggleFilter("purpose", value)}
          onClear={() => clearCategory("purpose")}
        />

        {/* Clear all */}
        {activeCount > 0 && (
          <>
            <span className="w-px h-4 bg-gray-200 mx-1" />
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-1.5 py-1 text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={10} />
              Effacer
            </button>
          </>
        )}

        {/* Results count */}
        {activeCount > 0 && (
          <span className="ml-auto text-[11px] text-gray-400">
            {filteredCount} résultat{filteredCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Backdrop to close dropdowns */}
      {openDropdown && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setOpenDropdown(null)}
        />
      )}
    </div>
  )
}

interface FilterDropdownProps {
  label: string
  category: FilterCategory
  options: { value: string; label: string; count: number }[]
  selectedValues: string[]
  isOpen: boolean
  onToggle: () => void
  onSelect: (value: string) => void
  onClear: () => void
}

function FilterDropdown({
  label,
  options,
  selectedValues,
  isOpen,
  onToggle,
  onSelect,
  onClear,
}: FilterDropdownProps) {
  const hasSelection = selectedValues.length > 0
  const availableOptions = options.filter((o) => o.count > 0)

  if (availableOptions.length === 0) return null

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className={`
          flex items-center gap-1 px-2 py-1 text-[11px] rounded-md border transition-all
          ${
            hasSelection
              ? "bg-brand-green/10 border-brand-green/20 text-brand-green font-medium"
              : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
          }
        `}
      >
        <span>{label}</span>
        {hasSelection && (
          <span className="flex items-center justify-center w-3.5 h-3.5 text-[9px] font-bold bg-brand-green text-white rounded">
            {selectedValues.length}
          </span>
        )}
        <ChevronDown
          size={10}
          className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 z-20 min-w-[160px] bg-white rounded-md border border-gray-200 shadow-lg py-1">
          {availableOptions.map((option) => {
            const isSelected = selectedValues.includes(option.value)
            return (
              <button
                key={option.value}
                onClick={() => onSelect(option.value)}
                className={`
                  w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] text-left transition-colors
                  ${
                    isSelected
                      ? "bg-brand-green/5 text-brand-green"
                      : "text-gray-600 hover:bg-gray-50"
                  }
                `}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`
                      w-3 h-3 rounded-sm border flex items-center justify-center text-[8px] transition-colors
                      ${
                        isSelected
                          ? "bg-brand-green border-brand-green text-white"
                          : "border-gray-300"
                      }
                    `}
                  >
                    {isSelected && "✓"}
                  </span>
                  <span>{option.label}</span>
                </span>
                <span className="text-[10px] text-gray-400">
                  {option.count}
                </span>
              </button>
            )
          })}

          {hasSelection && (
            <>
              <div className="border-t border-gray-100 my-1" />
              <button
                onClick={onClear}
                className="w-full px-2.5 py-1.5 text-[11px] text-left text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Effacer
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
