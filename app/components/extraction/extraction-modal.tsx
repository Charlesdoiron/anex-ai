"use client"

import { useState, useEffect } from "react"
import type { LeaseExtractionResult } from "@/app/lib/extraction/types"
import type { ComputeLeaseRentScheduleResult } from "@/app/lib/lease/types"
import {
  X,
  FileSpreadsheet,
  Calculator,
  FileText,
  ChevronLeft,
  FileIcon,
  Hash,
  Percent,
  Scale,
} from "lucide-react"
import { ExtractionPanel } from "./extraction-panel"
import { RentSchedulePanel } from "./rent-schedule-panel"
import { exportExtractionToExcel } from "./utils/excel-export"

type ModalView = "actions" | "extraction" | "schedule"

interface ExtractionModalProps {
  open: boolean
  onClose: () => void
  extraction: LeaseExtractionResult | null
  isLoading?: boolean
  error?: string | null
  initialView?: ModalView
}

export function ExtractionModal({
  open,
  onClose,
  extraction,
  isLoading = false,
  error = null,
  initialView = "actions",
}: ExtractionModalProps) {
  const [view, setView] = useState<ModalView>(initialView)
  const [rentSchedule, setRentSchedule] =
    useState<ComputeLeaseRentScheduleResult | null>(null)
  const [isComputingSchedule, setIsComputingSchedule] = useState(false)
  const [scheduleError, setScheduleError] = useState<string | null>(null)

  // Reset view when modal opens with a different initialView
  useEffect(() => {
    if (open) {
      setView(initialView)
    }
  }, [open, initialView])

  if (!open) {
    return null
  }

  async function handleComputeSchedule() {
    if (!extraction) return

    setIsComputingSchedule(true)
    setScheduleError(null)

    try {
      const response = await fetch("/api/rent/compute-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extractionId: extraction.documentId }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          errorData.error || "Impossible de calculer l'échéancier"
        )
      }

      const data = await response.json()
      setRentSchedule(data.schedule)
      setView("schedule")
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : "Erreur inconnue")
    } finally {
      setIsComputingSchedule(false)
    }
  }

  function handleExportExcel() {
    if (!extraction) return
    exportExtractionToExcel(extraction)
  }

  function handleBack() {
    setView("actions")
  }

  const canComputeSchedule =
    extraction?.rent?.paymentFrequency?.value &&
    (extraction?.rent?.annualRentExclTaxExclCharges?.value ||
      extraction?.rent?.quarterlyRentExclTaxExclCharges?.value) &&
    (extraction?.calendar?.effectiveDate?.value ||
      extraction?.calendar?.signatureDate?.value)

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/30 p-0 sm:p-4">
      <div className="relative flex w-full sm:max-w-4xl max-h-[90vh] sm:max-h-[85vh] flex-col rounded-t-xl sm:rounded-lg border border-gray-200 bg-[#fef9f4] shadow-xl dark:border-gray-700 dark:bg-[#343541] safe-bottom">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 dark:border-gray-700">
          <div className="flex items-center gap-2.5">
            {view !== "actions" && (
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors"
                aria-label="Retour"
              >
                <ChevronLeft size={16} strokeWidth={2} />
              </button>
            )}
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {view === "actions" && "Actions"}
                {view === "extraction" && "Données extraites"}
                {view === "schedule" && "Échéancier"}
              </p>
              {extraction && (
                <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                  {extraction.fileName || "Document"}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors"
            aria-label="Fermer"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 scrollbar-thin">
          {error ? (
            <div className="flex h-32 flex-col items-center justify-center text-sm text-red-600 dark:text-red-400">
              <p className="font-medium">Erreur de chargement</p>
              <p className="mt-1 text-xs text-gray-500">{error}</p>
            </div>
          ) : isLoading && !extraction ? (
            <div className="flex h-32 flex-col items-center justify-center text-sm text-gray-600 dark:text-gray-300">
              <div className="relative mb-3">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-200 dark:border-gray-600" />
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-gray-600 dark:border-gray-300 absolute top-0 left-0" />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Chargement des données…
              </p>
            </div>
          ) : extraction ? (
            <>
              {view === "actions" && (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <button
                      onClick={handleExportExcel}
                      className="group w-full flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 text-left transition-all hover:border-gray-300 hover:shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
                        <FileSpreadsheet size={18} strokeWidth={1.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          Exporter en Excel
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Télécharger les données extraites (.xlsx)
                        </p>
                      </div>
                    </button>

                    <button
                      onClick={handleComputeSchedule}
                      disabled={!canComputeSchedule || isComputingSchedule}
                      className="group w-full flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 text-left transition-all hover:border-gray-300 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-gray-200 disabled:hover:shadow-none dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600 dark:disabled:hover:border-gray-700"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                        {isComputingSchedule ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-r-transparent dark:border-blue-400" />
                        ) : (
                          <Calculator size={18} strokeWidth={1.5} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          Calculer l&apos;échéancier
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {canComputeSchedule
                            ? "Générer le calendrier des loyers indexés"
                            : "Données insuffisantes (loyer, fréquence, dates)"}
                        </p>
                      </div>
                    </button>

                    <button
                      onClick={() => setView("extraction")}
                      className="group w-full flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 text-left transition-all hover:border-gray-300 hover:shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        <FileText size={18} strokeWidth={1.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          Voir les données
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Consulter le détail de l&apos;extraction
                        </p>
                      </div>
                    </button>
                  </div>

                  {scheduleError && (
                    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/10 dark:text-red-400">
                      <p className="text-xs font-medium">Erreur de calcul</p>
                      <p className="mt-0.5 text-xs opacity-80">
                        {scheduleError}
                      </p>
                    </div>
                  )}

                  <div className="border-t border-gray-200 pt-5 dark:border-gray-700">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                      Résumé
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                      <div className="flex items-center gap-2.5 rounded-md border border-gray-200 bg-white px-3 py-2.5 dark:border-gray-700 dark:bg-gray-800">
                        <FileIcon
                          size={14}
                          className="text-gray-400 flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                            {extraction.pageCount ?? "–"}
                          </p>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400">
                            Pages
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 rounded-md border border-gray-200 bg-white px-3 py-2.5 dark:border-gray-700 dark:bg-gray-800">
                        <Hash
                          size={14}
                          className="text-gray-400 flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                            {extraction.extractionMetadata?.extractedFields ??
                              "–"}
                          </p>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400">
                            Champs
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 rounded-md border border-gray-200 bg-white px-3 py-2.5 dark:border-gray-700 dark:bg-gray-800">
                        <Percent
                          size={14}
                          className="text-gray-400 flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                            {extraction.extractionMetadata?.averageConfidence
                              ? `${Math.round(extraction.extractionMetadata.averageConfidence * 100)}%`
                              : "–"}
                          </p>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400">
                            Confiance
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 rounded-md border border-gray-200 bg-white px-3 py-2.5 dark:border-gray-700 dark:bg-gray-800">
                        <Scale
                          size={14}
                          className="text-gray-400 flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {extraction.regime?.regime?.value || "–"}
                          </p>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400">
                            Régime
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {view === "extraction" && (
                <ExtractionPanel extraction={extraction} />
              )}

              {view === "schedule" && rentSchedule && (
                <RentSchedulePanel
                  schedule={rentSchedule}
                  fileName={extraction.fileName}
                />
              )}
            </>
          ) : (
            <div className="flex h-32 flex-col items-center justify-center text-sm text-gray-600 dark:text-gray-300">
              <div className="relative mb-3">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-200 dark:border-gray-600" />
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-gray-600 dark:border-gray-300 absolute top-0 left-0" />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Préparation des données…
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
