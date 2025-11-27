"use client"

import { useState } from "react"
import { Download, CheckCircle2, Eye } from "lucide-react"
import { exportRentCalculationToExcel } from "@/app/components/extraction/utils/rent-calculation-excel-export"
import RentCalculationDetailModal from "@/app/components/extraction-history/rent-calculation-detail-modal"

interface RentCalculationResultButtonProps {
  result: Record<string, unknown>
  onReset: () => void
  label?: string
}

export default function RentCalculationResultButton({
  result,
  onReset,
  label = "Télécharger votre résultat",
}: RentCalculationResultButtonProps) {
  const [showModal, setShowModal] = useState(false)

  function handleDownload() {
    if (!result) {
      console.error("No result available")
      return
    }

    try {
      const exportData = {
        documentId: result.documentId as string,
        fileName: result.fileName as string,
        extractionDate: result.extractionDate as string,
        pageCount: (result.pageCount as number) ?? 0,
        toolType: "calculation-rent" as const,
        extractedData: result.extractedData,
        rentSchedule: result.rentSchedule,
        scheduleInput: result.scheduleInput,
        metadata: (result.metadata as Record<string, unknown>) ?? {
          processingTimeMs: 0,
          retries: 0,
          extractionSuccess: true,
          scheduleSuccess: !!result.rentSchedule,
        },
      }
      exportRentCalculationToExcel(
        exportData as Parameters<typeof exportRentCalculationToExcel>[0]
      )
    } catch (error) {
      console.error("Error exporting to Excel:", error)
      alert("Erreur lors de l'export Excel. Veuillez réessayer.")
    }
  }

  return (
    <>
      <div className="group relative bg-white rounded-2xl border-2 border-brand-green/20 p-8 sm:p-12 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-cream/80 to-brand-green/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        <div className="relative flex flex-col items-center justify-center gap-6">
          <div className="w-20 h-20 rounded-full bg-brand-green/10 flex items-center justify-center group-hover:bg-brand-green group-hover:scale-110 transition-all duration-300">
            <CheckCircle2 className="w-10 h-10 text-brand-green group-hover:text-white transition-colors duration-300" />
          </div>

          <div className="text-center space-y-2">
            <h3 className="text-xl font-semibold text-gray-800">
              Calcul terminé !
            </h3>
            <p className="text-gray-600 max-w-xs">{label}</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
            <button
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-brand-green text-white rounded-xl font-medium hover:bg-brand-green/90 transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <Download className="w-5 h-5" />
              Excel
            </button>

            <button
              onClick={() => setShowModal(true)}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all duration-200"
            >
              <Eye className="w-5 h-5" />
              Voir
            </button>
          </div>

          <button
            onClick={onReset}
            className="text-sm text-gray-500 hover:text-brand-green transition-colors duration-200 underline underline-offset-2"
          >
            Nouveau calcul
          </button>
        </div>
      </div>

      <RentCalculationDetailModal
        result={
          showModal
            ? (result as unknown as Parameters<
                typeof RentCalculationDetailModal
              >[0]["result"])
            : null
        }
        onClose={() => setShowModal(false)}
      />
    </>
  )
}
