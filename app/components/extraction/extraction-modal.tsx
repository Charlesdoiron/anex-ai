"use client"

import { useState } from "react"
import type { LeaseExtractionResult } from "@/app/lib/extraction/types"
import type { ComputeLeaseRentScheduleResult } from "@/app/lib/lease/types"
import {
  X,
  FileSpreadsheet,
  Calculator,
  FileText,
  ChevronLeft,
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
}

export function ExtractionModal({
  open,
  onClose,
  extraction,
  isLoading = false,
  error = null,
}: ExtractionModalProps) {
  const [view, setView] = useState<ModalView>("actions")
  const [rentSchedule, setRentSchedule] =
    useState<ComputeLeaseRentScheduleResult | null>(null)
  const [isComputingSchedule, setIsComputingSchedule] = useState(false)
  const [scheduleError, setScheduleError] = useState<string | null>(null)

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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="relative flex w-full max-w-5xl max-h-[85vh] flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
          <div className="flex items-center gap-3">
            {view !== "actions" && (
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                aria-label="Retour"
              >
                <ChevronLeft size={16} strokeWidth={2} />
              </button>
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {view === "actions" && "Actions disponibles"}
                {view === "extraction" && "Données extraites"}
                {view === "schedule" && "Échéancier des loyers"}
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
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            aria-label="Fermer"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-50 to-slate-100 px-6 py-6 dark:from-gray-900 dark:to-gray-950">
          {error ? (
            <div className="flex h-40 flex-col items-center justify-center text-sm text-red-600 dark:text-red-400">
              <p className="font-medium">Erreur de chargement</p>
              <p className="mt-2 text-xs">{error}</p>
            </div>
          ) : isLoading && !extraction ? (
            <div className="flex h-40 flex-col items-center justify-center text-sm text-gray-600 dark:text-gray-300">
              <span className="mb-3 inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-blue-600 border-r-transparent" />
              <p>Chargement des données complètes…</p>
            </div>
          ) : extraction ? (
            <>
              {view === "actions" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button
                      onClick={handleExportExcel}
                      className="group relative flex flex-col items-center gap-4 rounded-xl border-2 border-gray-200 bg-white p-6 text-center shadow-sm transition-all hover:border-emerald-500 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-emerald-500"
                    >
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 transition-transform group-hover:scale-110 dark:bg-emerald-900/30 dark:text-emerald-400">
                        <FileSpreadsheet size={28} strokeWidth={1.5} />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                          Exporter Excel
                        </h3>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Télécharger toutes les données extraites au format
                          .xlsx
                        </p>
                      </div>
                    </button>

                    <button
                      onClick={handleComputeSchedule}
                      disabled={!canComputeSchedule || isComputingSchedule}
                      className="group relative flex flex-col items-center gap-4 rounded-xl border-2 border-gray-200 bg-white p-6 text-center shadow-sm transition-all hover:border-blue-500 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-gray-200 disabled:hover:shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-500 dark:disabled:hover:border-gray-700"
                    >
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-blue-600 transition-transform group-hover:scale-110 group-disabled:group-hover:scale-100 dark:bg-blue-900/30 dark:text-blue-400">
                        {isComputingSchedule ? (
                          <span className="h-6 w-6 animate-spin rounded-full border-2 border-solid border-blue-600 border-r-transparent" />
                        ) : (
                          <Calculator size={28} strokeWidth={1.5} />
                        )}
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                          Calculer échéancier
                        </h3>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {canComputeSchedule
                            ? "Générer le calendrier des loyers avec indexation"
                            : "Données insuffisantes (loyer, fréquence, dates)"}
                        </p>
                      </div>
                    </button>

                    <button
                      onClick={() => setView("extraction")}
                      className="group relative flex flex-col items-center gap-4 rounded-xl border-2 border-gray-200 bg-white p-6 text-center shadow-sm transition-all hover:border-purple-500 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-purple-500"
                    >
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-purple-100 text-purple-600 transition-transform group-hover:scale-110 dark:bg-purple-900/30 dark:text-purple-400">
                        <FileText size={28} strokeWidth={1.5} />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                          Voir les données
                        </h3>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Consulter le détail de l&apos;extraction
                        </p>
                      </div>
                    </button>
                  </div>

                  {scheduleError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                      <p className="font-medium">Erreur de calcul</p>
                      <p className="mt-1">{scheduleError}</p>
                    </div>
                  )}

                  <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
                    <h4 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
                      Résumé de l&apos;extraction
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                      <div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {extraction.pageCount ?? "-"}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Pages
                        </p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {extraction.extractionMetadata?.extractedFields ??
                            "-"}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Champs extraits
                        </p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {extraction.extractionMetadata?.averageConfidence
                            ? `${Math.round(extraction.extractionMetadata.averageConfidence * 100)}%`
                            : "-"}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Confiance
                        </p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {extraction.regime?.regime?.value || "-"}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Régime
                        </p>
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
            <div className="flex h-40 flex-col items-center justify-center text-sm text-gray-600 dark:text-gray-300">
              <span className="mb-3 inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-blue-600 border-r-transparent" />
              <p>Données en cours de préparation…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
