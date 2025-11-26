"use client"

import { useEffect, useState } from "react"
import { FileText, Clock, Files, Calendar } from "lucide-react"

interface SidebarProps {
  isOpen: boolean
  onNewChat: () => void
  onExtractionClick?: (extraction: Extraction) => void
}

interface Extraction {
  id: string
  fileName: string
  fileSize: number | null
  pageCount: number | null
  pipelineId: string | null
  createdAt: string
}

interface GroupedExtractions {
  today: Extraction[]
  yesterday: Extraction[]
  thisWeek: Extraction[]
  older: Extraction[]
}

export function Sidebar({
  isOpen,
  onNewChat,
  onExtractionClick,
}: SidebarProps) {
  const [extractions, setExtractions] = useState<Extraction[]>([])
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState(false)
  const [clearMessage, setClearMessage] = useState<string | null>(null)

  const isTestMode = process.env.NEXT_PUBLIC_APP_MODE === "test"

  useEffect(() => {
    if (isOpen) {
      fetchExtractions()
    }
  }, [isOpen])

  async function fetchExtractions() {
    try {
      setLoading(true)
      const response = await fetch("/api/extractions")
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
  }

  function groupExtractions(
    extractions: Extraction[] = []
  ): GroupedExtractions {
    const now = new Date()
    const groups: GroupedExtractions = {
      today: [],
      yesterday: [],
      thisWeek: [],
      older: [],
    }

    extractions.forEach((extraction) => {
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
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
  }

  function formatBytes(bytes: number) {
    if (!bytes) return "0 o"
    if (bytes < 1024) return `${bytes} o`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
  }

  async function handleClearData() {
    setClearing(true)
    setClearMessage(null)
    try {
      const response = await fetch("/api/admin/clear-data", {
        method: "POST",
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || "Impossible de nettoyer les données.")
      }

      const totalFiles = data?.summary?.totalFiles ?? 0
      const totalSize = data?.summary?.totalSizeBytes ?? 0
      setClearMessage(
        `Données effacées (${totalFiles} fichiers, ${formatBytes(totalSize)})`
      )
      setExtractions([])
    } catch (error) {
      setClearMessage(
        error instanceof Error
          ? error.message
          : "Erreur inattendue lors du nettoyage."
      )
    } finally {
      setClearing(false)
      await fetchExtractions()
    }
  }

  const groupedExtractions = groupExtractions(extractions)

  function renderExtractionGroup(
    title: string,
    items: Extraction[],
    showTime = false
  ) {
    if (items.length === 0) return null

    return (
      <div className="mb-6">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-3">
          {title}
        </h4>
        <div className="space-y-1">
          {items.map((extraction, index) => {
            const rawName =
              typeof extraction.fileName === "string" ? extraction.fileName : ""
            const displayName = rawName
              ? rawName.replace(/\.pdf$/i, "")
              : `Document ${index + 1}`

            return (
              <div
                key={extraction.id ?? `${title}-${index}`}
                onClick={() => onExtractionClick?.(extraction)}
                className="group mx-2 p-2.5 rounded-lg hover:bg-white/80 dark:hover:bg-gray-800/50 cursor-pointer transition-all duration-200 border border-transparent hover:border-gray-200 dark:hover:border-gray-700 hover:shadow-sm"
              >
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex-shrink-0">
                    <FileText size={14} strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate leading-tight mb-1">
                      {displayName}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400">
                      <Clock size={10} />
                      <span>
                        {showTime
                          ? formatTime(extraction.createdAt)
                          : formatDate(extraction.createdAt)}
                      </span>
                      {extraction.pageCount && (
                        <>
                          <span className="text-gray-300 dark:text-gray-600">
                            •
                          </span>
                          <Files size={10} />
                          <span>{extraction.pageCount}p</span>
                        </>
                      )}
                      {extraction.fileSize && (
                        <>
                          <span className="text-gray-300 dark:text-gray-600">
                            •
                          </span>
                          <span>{formatFileSize(extraction.fileSize)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`${
        isOpen ? "w-72" : "w-0"
      } transition-all duration-300 bg-[#fef9f4] dark:bg-[#202123] flex flex-col overflow-hidden ${
        isOpen ? "border-r border-gray-200 dark:border-gray-800" : ""
      }`}
    >
      {isOpen && (
        <>
          <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin">
            <div className="py-4 mt-12">
              <div className="px-3 mb-4">
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 mb-1">
                  <Calendar size={16} strokeWidth={2} />
                  <h3 className="text-sm font-semibold">Historique</h3>
                </div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed">
                  Vos extractions récentes
                </p>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="relative">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 dark:border-gray-700"></div>
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-600 absolute top-0 left-0"></div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                    Chargement...
                  </p>
                </div>
              ) : extractions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <div className="p-3 rounded-full bg-gray-100 dark:bg-gray-800 mb-3">
                    <Files size={20} className="text-gray-400" />
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 text-center font-medium mb-1">
                    Aucune extraction
                  </p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-500 text-center leading-relaxed">
                    Téléversez un PDF pour commencer
                  </p>
                </div>
              ) : (
                <>
                  {renderExtractionGroup(
                    "Aujourd'hui",
                    groupedExtractions.today,
                    true
                  )}
                  {renderExtractionGroup("Hier", groupedExtractions.yesterday)}
                  {renderExtractionGroup(
                    "Cette semaine",
                    groupedExtractions.thisWeek
                  )}
                  {renderExtractionGroup(
                    "Plus ancien",
                    groupedExtractions.older
                  )}
                </>
              )}
            </div>
          </div>

          {(extractions.length > 0 || isTestMode) && (
            <div className="p-3 border-t border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50 space-y-2">
              {extractions.length > 0 && (
                <div className="text-[10px] text-gray-500 dark:text-gray-400 text-center">
                  <span className="font-medium">{extractions.length}</span>{" "}
                  extraction{extractions.length > 1 ? "s" : ""} au total
                </div>
              )}

              {isTestMode && (
                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleClearData}
                    disabled={clearing}
                    className="text-xs font-medium px-3 py-2 rounded-md border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {clearing
                      ? "Nettoyage en cours..."
                      : "Vider les données locales"}
                  </button>
                  {clearMessage && (
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 text-center">
                      {clearMessage}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
