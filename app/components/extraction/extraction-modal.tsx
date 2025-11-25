"use client"

import type { LeaseExtractionResult } from "@/app/lib/extraction/types"
import { X } from "lucide-react"
import { ExtractionPanel } from "./extraction-panel"

interface ExtractionModalProps {
  open: boolean
  onClose: () => void
  extraction: LeaseExtractionResult | null
}

export function ExtractionModal({
  open,
  onClose,
  extraction,
}: ExtractionModalProps) {
  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="relative flex w-full max-w-5xl max-h-[85vh] flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Données extraites
            </p>
            {extraction && (
              <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                {extraction.fileName || "Document"}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            aria-label="Fermer les données extraites"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-50 to-slate-100 px-6 py-4 dark:from-gray-900 dark:to-gray-950">
          {extraction ? (
            <ExtractionPanel extraction={extraction} />
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
