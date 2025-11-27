"use client"

import { useState } from "react"
import { Download, CheckCircle2, Eye } from "lucide-react"
import type { LeaseExtractionResult } from "@/app/lib/extraction/types"
import { exportExtractionToExcel } from "@/app/components/extraction/utils/excel-export"
import ExtractionDetailModal from "@/app/components/extraction-history/extraction-detail-modal"

interface DownloadResultButtonProps {
  extraction: LeaseExtractionResult | null
  onReset: () => void
  label?: string
}

export default function DownloadResultButton({
  extraction,
  onReset,
  label = "Télécharger votre résultat",
}: DownloadResultButtonProps) {
  const [showModal, setShowModal] = useState(false)

  async function handleDownload() {
    if (!extraction) {
      console.error("No extraction result available")
      return
    }

    if (!extraction.documentId || !extraction.extractionMetadata) {
      console.error("Extraction result is incomplete:", extraction)
      alert("Le résultat d'extraction est incomplet. Veuillez réessayer.")
      return
    }

    try {
      await exportExtractionToExcel(extraction)
    } catch (error) {
      console.error("Error exporting to Excel:", error)
      alert("Erreur lors de l'export Excel. Veuillez réessayer.")
    }
  }

  return (
    <>
      <div className="group relative bg-white rounded-2xl border-2 border-brand-green/20 p-8 sm:p-12 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
        {/* Gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-cream/80 to-brand-green/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        <div className="relative flex flex-col items-center justify-center gap-6">
          {/* Success icon */}
          <div className="w-20 h-20 rounded-full bg-brand-green/10 flex items-center justify-center group-hover:bg-brand-green group-hover:scale-110 transition-all duration-300">
            <CheckCircle2 className="w-10 h-10 text-brand-green group-hover:text-white transition-colors duration-300" />
          </div>

          {/* Message */}
          <div className="text-center">
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 group-hover:text-brand-green transition-colors">
              Prêt à télécharger
            </h3>
            <p className="text-sm sm:text-base text-gray-600">
              Votre traitement est terminé
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <button
              onClick={handleDownload}
              className="relative w-full sm:w-auto inline-flex items-center justify-center gap-3 rounded-xl bg-brand-green px-8 py-4 text-base font-semibold text-white shadow-lg hover:shadow-xl hover:bg-brand-green/90 transition-all duration-300 group-hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green"
            >
              <Download className="w-5 h-5" />
              <span>{label}</span>
            </button>

            <button
              onClick={() => setShowModal(true)}
              className="relative w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border-2 border-brand-green/30 bg-white px-6 py-4 text-base font-medium text-brand-green hover:bg-brand-green/5 hover:border-brand-green/50 transition-all duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green"
            >
              <Eye className="w-5 h-5" />
              <span>Voir les données</span>
            </button>
          </div>

          {/* Reset option */}
          <button
            onClick={onReset}
            className="text-sm text-gray-500 hover:text-brand-green transition-colors duration-200 underline-offset-4 hover:underline"
          >
            Traiter un autre fichier
          </button>
        </div>
      </div>

      {showModal && (
        <ExtractionDetailModal
          extraction={extraction}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}
