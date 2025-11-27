"use client"

import {
  useEffect,
  useState,
  useImperativeHandle,
  forwardRef,
  useMemo,
  useCallback,
} from "react"
import {
  FileText,
  Clock,
  Download,
  ChevronRight,
  History,
  Calculator,
  AlertCircle,
} from "lucide-react"
import type { LeaseExtractionResult } from "@/app/lib/extraction/types"
import { exportExtractionToExcel } from "@/app/components/extraction/utils/excel-export"
import {
  exportRentCalculationToExcel,
  isRentCalculationResult,
} from "@/app/components/extraction/utils/rent-calculation-excel-export"
import FilterBar from "@/app/components/recent-activity/filter-bar"
import {
  type FilterableExtractionSummary,
  type ExtractionFilters,
  EMPTY_FILTERS,
  matchesFilters,
} from "@/app/components/recent-activity/filter-utils"
import type { toolType } from "@/app/static-data/agent"

const TOOL_TYPE_CONFIG: Record<
  string,
  { label: string; icon: typeof FileText; color: string; bgColor: string }
> = {
  "extraction-lease": {
    label: "Extraction",
    icon: FileText,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  "calculation-rent": {
    label: "Loyer",
    icon: Calculator,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
  },
}

interface GroupedExtractions {
  today: FilterableExtractionSummary[]
  yesterday: FilterableExtractionSummary[]
  thisWeek: FilterableExtractionSummary[]
  older: FilterableExtractionSummary[]
}

type ExtractionData = LeaseExtractionResult | Record<string, unknown>

interface ExtractionHistoryProps {
  onViewExtraction?: (extraction: ExtractionData) => void
  compact?: boolean
  maxItems?: number
  showFilters?: boolean
  toolType?: toolType
}

export interface ExtractionHistoryHandle {
  refresh: () => Promise<void>
}

const ExtractionHistory = forwardRef<
  ExtractionHistoryHandle,
  ExtractionHistoryProps
>(function ExtractionHistory(
  { onViewExtraction, compact = false, maxItems, showFilters = true, toolType },
  ref
) {
  const [extractions, setExtractions] = useState<FilterableExtractionSummary[]>(
    []
  )
  const [loading, setLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [filters, setFilters] = useState<ExtractionFilters>(EMPTY_FILTERS)

  const filteredExtractions = useMemo(() => {
    return extractions.filter((e) => matchesFilters(e, filters))
  }, [extractions, filters])

  const fetchExtractions = useCallback(async () => {
    try {
      setLoading(true)
      const url = toolType
        ? `/api/extractions?toolType=${toolType}`
        : "/api/extractions"
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        const list =
          (Array.isArray(data.extractions) && data.extractions) ||
          (Array.isArray(data.data) && data.data) ||
          []
        setExtractions(list.filter(Boolean))
      }
    } catch (error) {
      console.error("Error fetching extractions:", error)
    } finally {
      setLoading(false)
    }
  }, [toolType])

  useImperativeHandle(ref, () => ({
    refresh: fetchExtractions,
  }))

  useEffect(() => {
    fetchExtractions()
  }, [fetchExtractions])

  function groupExtractions(
    items: FilterableExtractionSummary[] = []
  ): GroupedExtractions {
    const now = new Date()
    const groups: GroupedExtractions = {
      today: [],
      yesterday: [],
      thisWeek: [],
      older: [],
    }

    items.forEach((extraction) => {
      const date = new Date(extraction.createdAt)
      const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

      if (diffInHours < 24) {
        groups.today.push(extraction)
      } else if (diffInHours < 48) {
        groups.yesterday.push(extraction)
      } else if (diffInHours < 168) {
        groups.thisWeek.push(extraction)
      } else {
        groups.older.push(extraction)
      }
    })

    return groups
  }

  function formatTime(dateString: string) {
    const date = new Date(dateString)
    return date.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString)
    return date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
    })
  }

  function formatFileSize(bytes: number | null) {
    if (!bytes) return ""
    if (bytes < 1024) return `${bytes} o`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
  }

  async function handleDownload(extractionId: string, e: React.MouseEvent) {
    e.stopPropagation()
    setDownloadingId(extractionId)
    try {
      const response = await fetch(`/api/extractions/${extractionId}`)
      if (response.ok) {
        const json = await response.json()
        const extraction = json.extraction || json.data
        if (extraction) {
          if (isRentCalculationResult(extraction)) {
            exportRentCalculationToExcel(extraction)
          } else {
            exportExtractionToExcel(extraction)
          }
        }
      }
    } catch (error) {
      console.error("Error downloading extraction:", error)
    } finally {
      setDownloadingId(null)
    }
  }

  async function handleView(extractionId: string) {
    if (!onViewExtraction) return
    setViewingId(extractionId)
    try {
      const response = await fetch(`/api/extractions/${extractionId}`)
      if (response.ok) {
        const json = await response.json()
        const extraction = json.extraction || json.data
        if (extraction) {
          onViewExtraction(extraction)
        }
      }
    } catch (error) {
      console.error("Error fetching extraction:", error)
    } finally {
      setViewingId(null)
    }
  }

  const displayedExtractions = maxItems
    ? filteredExtractions.slice(0, maxItems)
    : filteredExtractions
  const groupedExtractions = groupExtractions(displayedExtractions)
  const hasActiveFilters =
    filters.regime.length > 0 ||
    filters.duration.length > 0 ||
    filters.surface.length > 0 ||
    filters.purpose.length > 0

  function renderExtractionItem(
    extraction: FilterableExtractionSummary,
    index: number,
    showTime = false
  ) {
    const rawName =
      typeof extraction.fileName === "string" ? extraction.fileName : ""
    const displayName = rawName
      ? rawName.replace(/\.pdf$/i, "")
      : `Document ${index + 1}`
    const isViewing = viewingId === extraction.id

    // Tool type styling
    const extractionToolType =
      (extraction as { toolType?: string }).toolType || "extraction-lease"
    const typeConfig =
      TOOL_TYPE_CONFIG[extractionToolType] ||
      TOOL_TYPE_CONFIG["extraction-lease"]
    const TypeIcon = typeConfig.icon

    // Check for failed/low confidence extraction
    const hasError =
      extraction.averageConfidence !== null &&
      extraction.averageConfidence < 0.3
    const isLowConfidence =
      extraction.averageConfidence !== null &&
      extraction.averageConfidence >= 0.3 &&
      extraction.averageConfidence < 0.6

    return (
      <div
        key={extraction.id ?? `item-${index}`}
        onClick={() => !isViewing && handleView(extraction.id)}
        className={`group flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${
          isViewing
            ? "bg-brand-green/5 cursor-wait"
            : hasError
              ? "cursor-pointer hover:bg-red-50/50 bg-red-50/30"
              : "cursor-pointer hover:bg-gray-50"
        }`}
      >
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
            isViewing
              ? "bg-brand-green/10 text-brand-green"
              : hasError
                ? "bg-red-100 text-red-500"
                : `${typeConfig.bgColor} ${typeConfig.color} group-hover:opacity-80`
          }`}
        >
          {isViewing ? (
            <div className="w-3.5 h-3.5 border-2 border-brand-green/30 border-t-brand-green rounded-full animate-spin" />
          ) : hasError ? (
            <AlertCircle size={14} />
          ) : (
            <TypeIcon size={14} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`text-sm font-medium truncate transition-colors ${
                isViewing
                  ? "text-brand-green"
                  : hasError
                    ? "text-red-700"
                    : "text-gray-800 group-hover:text-brand-green"
              }`}
            >
              {displayName}
            </span>
            {!toolType && (
              <span
                className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide ${
                  hasError
                    ? "bg-red-100 text-red-600"
                    : `${typeConfig.bgColor} ${typeConfig.color}`
                }`}
              >
                {hasError ? "Échec" : typeConfig.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400 flex-wrap">
            {isViewing ? (
              <span className="text-brand-green/70">Chargement...</span>
            ) : hasError ? (
              <span className="text-red-500">
                Extraction incomplète ou échouée
              </span>
            ) : (
              <>
                <span className="flex items-center gap-1">
                  <Clock size={10} />
                  {showTime
                    ? formatTime(extraction.createdAt)
                    : formatDate(extraction.createdAt)}
                </span>
                {extraction.pageCount && (
                  <span>{extraction.pageCount} pages</span>
                )}
                {extractionToolType === "extraction-lease" &&
                  extraction.surfaceArea && (
                    <span>{extraction.surfaceArea} m²</span>
                  )}
                {extractionToolType === "extraction-lease" &&
                  extraction.regime && (
                    <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-medium">
                      {extraction.regime}
                    </span>
                  )}
                {isLowConfidence && (
                  <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-medium">
                    Données clés manquantes
                  </span>
                )}
              </>
            )}
          </div>
        </div>
        <div
          className={`flex items-center gap-1 transition-opacity ${
            isViewing ? "opacity-0" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          <button
            onClick={(e) => handleDownload(extraction.id, e)}
            disabled={downloadingId === extraction.id || isViewing}
            className="p-1.5 rounded-md text-gray-400 hover:text-brand-green hover:bg-white transition-colors disabled:opacity-50"
            title="Télécharger Excel"
          >
            {downloadingId === extraction.id ? (
              <div className="w-3.5 h-3.5 border-2 border-brand-green/30 border-t-brand-green rounded-full animate-spin" />
            ) : (
              <Download size={14} />
            )}
          </button>
        </div>
        <ChevronRight
          size={14}
          className={`transition-colors ${
            isViewing
              ? "text-brand-green"
              : "text-gray-300 group-hover:text-brand-green"
          }`}
        />
      </div>
    )
  }

  function renderExtractionGroup(
    title: string,
    items: FilterableExtractionSummary[],
    showTime = false
  ) {
    if (items.length === 0) return null

    return (
      <div className="mb-4 last:mb-0">
        <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 px-3">
          {title}
        </h4>
        <div className="space-y-0.5">
          {items.map((extraction, index) =>
            renderExtractionItem(extraction, index, showTime)
          )}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="rounded-lg p-6 bg-white border border-gray-200">
        <div className="flex flex-col items-center justify-center py-6">
          <div className="relative">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200"></div>
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand-green absolute top-0 left-0"></div>
          </div>
          <p className="text-xs text-gray-400 mt-3">Chargement...</p>
        </div>
      </div>
    )
  }

  if (extractions.length === 0) {
    return null
  }

  if (compact) {
    return (
      <div className="space-y-0.5">
        {displayedExtractions.map((extraction, index) =>
          renderExtractionItem(extraction, index, true)
        )}
      </div>
    )
  }

  return (
    <div className="rounded-lg bg-white border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-brand-green/10 text-brand-green">
            <History size={16} strokeWidth={1.5} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              Extractions précédentes
            </h3>
            <p className="text-xs text-gray-500">
              {extractions.length} document{extractions.length > 1 ? "s" : ""}{" "}
              traité{extractions.length > 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      {showFilters && extractions.length > 1 && (
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
          <FilterBar
            extractions={extractions}
            filters={filters}
            onFiltersChange={setFilters}
            filteredCount={filteredExtractions.length}
          />
        </div>
      )}

      {filteredExtractions.length === 0 && hasActiveFilters ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-gray-500">
            Aucun bail ne correspond aux filtres sélectionnés
          </p>
          <button
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="mt-2 text-xs text-brand-green hover:underline"
          >
            Effacer les filtres
          </button>
        </div>
      ) : (
        <div className="p-2 max-h-[350px] overflow-y-auto scrollbar-thin">
          {renderExtractionGroup("Aujourd'hui", groupedExtractions.today, true)}
          {renderExtractionGroup("Hier", groupedExtractions.yesterday)}
          {renderExtractionGroup("Cette semaine", groupedExtractions.thisWeek)}
          {renderExtractionGroup("Plus ancien", groupedExtractions.older)}
        </div>
      )}
    </div>
  )
})

export default ExtractionHistory
