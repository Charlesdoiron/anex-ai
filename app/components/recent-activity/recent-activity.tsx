"use client"

import { useState, useCallback, useMemo, lazy, Suspense } from "react"
import Link from "next/link"
import {
  FileText,
  Clock,
  Download,
  ChevronRight,
  Activity,
  ArrowRight,
} from "lucide-react"
import type { LeaseExtractionResult } from "@/app/lib/extraction/types"
import { exportExtractionToExcel } from "@/app/components/extraction/utils/excel-export"
import FilterBar from "./filter-bar"
import {
  type ExtractionFilters,
  EMPTY_FILTERS,
  matchesFilters,
} from "./filter-utils"
import { useExtractions } from "@/app/lib/hooks/use-extractions"

const ExtractionDetailModal = lazy(
  () => import("@/app/components/extraction-history/extraction-detail-modal")
)

interface RecentActivityProps {
  agentSlug: string
  maxItems?: number
  showFilters?: boolean
}

export default function RecentActivity({
  agentSlug,
  maxItems = 5,
  showFilters = false,
}: RecentActivityProps) {
  const { extractions, isLoading: loading } = useExtractions()
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [selectedExtraction, setSelectedExtraction] =
    useState<LeaseExtractionResult | null>(null)
  const [filters, setFilters] = useState<ExtractionFilters>(EMPTY_FILTERS)

  const filteredExtractions = useMemo(() => {
    const filtered = extractions.filter((e) => matchesFilters(e, filters))
    return showFilters ? filtered : filtered.slice(0, maxItems)
  }, [extractions, filters, maxItems, showFilters])

  function formatRelativeTime(dateString: string) {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60)
    )

    if (diffInMinutes < 1) return "À l'instant"
    if (diffInMinutes < 60) return `Il y a ${diffInMinutes} min`

    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) return `Il y a ${diffInHours}h`

    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays === 1) return "Hier"
    if (diffInDays < 7) return `Il y a ${diffInDays} jours`

    return date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
    })
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
          exportExtractionToExcel(extraction)
        }
      }
    } catch (error) {
      console.error("Error downloading extraction:", error)
    } finally {
      setDownloadingId(null)
    }
  }

  async function handleView(extractionId: string) {
    try {
      const response = await fetch(`/api/extractions/${extractionId}`)
      if (response.ok) {
        const json = await response.json()
        const extraction = json.extraction || json.data
        if (extraction) {
          setSelectedExtraction(extraction)
        }
      }
    } catch (error) {
      console.error("Error fetching extraction:", error)
    }
  }

  const handleCloseModal = useCallback(() => {
    setSelectedExtraction(null)
  }, [])

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-md bg-gray-100 animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
            <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
          </div>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-gray-50 rounded-md animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (extractions.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-brand-cream flex items-center justify-center">
          <Activity className="w-5 h-5 text-brand-green" />
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">
          Aucune activité récente
        </h3>
        <p className="text-sm text-gray-500 mb-5 max-w-sm mx-auto">
          Commencez par extraire les données d&apos;un bail commercial pour voir
          votre historique ici.
        </p>
        <Link
          href={`/agent/${agentSlug}/extraction-baux-commerciaux`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-green text-white text-sm font-medium rounded-md hover:bg-brand-green/90 transition-colors"
        >
          <span>Nouvelle extraction</span>
          <ArrowRight size={16} />
        </Link>
      </div>
    )
  }

  const hasActiveFilters =
    filters.regime.length > 0 ||
    filters.duration.length > 0 ||
    filters.surface.length > 0 ||
    filters.purpose.length > 0

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-brand-green/10 text-brand-green">
                <Activity size={18} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Activité récente
                </h3>
                <p className="text-xs text-gray-500">
                  Vos dernières extractions
                </p>
              </div>
            </div>
            <Link
              href={`/agent/${agentSlug}/extraction-baux-commerciaux`}
              className="text-xs font-medium text-brand-green hover:underline underline-offset-4 flex items-center gap-1"
            >
              Voir tout
              <ChevronRight size={12} />
            </Link>
          </div>
        </div>

        {showFilters && extractions.length > 1 && (
          <div className="px-6 pt-4">
            <FilterBar
              extractions={extractions}
              filters={filters}
              onFiltersChange={setFilters}
              filteredCount={filteredExtractions.length}
            />
          </div>
        )}

        {filteredExtractions.length === 0 && hasActiveFilters ? (
          <div className="px-6 py-8 text-center">
            <p className="text-sm text-gray-500">
              Aucun bail ne correspond aux filtres sélectionnés
            </p>
            <button
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="mt-2 text-sm text-brand-green hover:underline"
            >
              Effacer les filtres
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredExtractions.map((extraction, index) => {
              const rawName =
                typeof extraction.fileName === "string"
                  ? extraction.fileName
                  : ""
              const displayName = rawName
                ? rawName.replace(/\.pdf$/i, "")
                : `Document ${index + 1}`

              return (
                <div
                  key={extraction.id ?? `item-${index}`}
                  onClick={() => handleView(extraction.id)}
                  className="group px-5 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-brand-green/10 group-hover:text-brand-green transition-colors">
                    <FileText size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate group-hover:text-brand-green transition-colors">
                      {displayName}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {formatRelativeTime(extraction.createdAt)}
                      </span>
                      {extraction.pageCount && (
                        <span>{extraction.pageCount} pages</span>
                      )}
                      {extraction.surfaceArea && (
                        <span>{extraction.surfaceArea} m²</span>
                      )}
                      {extraction.regime && (
                        <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-medium">
                          {extraction.regime}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleDownload(extraction.id, e)}
                      disabled={downloadingId === extraction.id}
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
                    className="text-gray-300 group-hover:text-brand-green transition-colors"
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {selectedExtraction && (
        <Suspense fallback={null}>
          <ExtractionDetailModal
            extraction={selectedExtraction}
            onClose={handleCloseModal}
          />
        </Suspense>
      )}
    </>
  )
}
