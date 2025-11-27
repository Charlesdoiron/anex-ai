"use client"

import { useState, useCallback, useRef } from "react"
import { toolType } from "@/app/static-data/agent"
import UploadFileWrapper from "./upload-file-wrapper"
import ExtractionHistory, {
  ExtractionHistoryHandle,
} from "@/app/components/extraction-history/extraction-history"
import ExtractionDetailModal from "@/app/components/extraction-history/extraction-detail-modal"
import RentCalculationDetailModal from "@/app/components/extraction-history/rent-calculation-detail-modal"
import type { LeaseExtractionResult } from "@/app/lib/extraction/types"
import { isRentCalculationResult } from "@/app/components/extraction/utils/rent-calculation-excel-export"

interface UploadFileWithHistoryProps {
  label?: string
  toolType: toolType
}

type ExtractionData = LeaseExtractionResult | Record<string, unknown>

export default function UploadFileWithHistory({
  label,
  toolType,
}: UploadFileWithHistoryProps) {
  const [selectedExtraction, setSelectedExtraction] =
    useState<LeaseExtractionResult | null>(null)
  const [selectedRentCalculation, setSelectedRentCalculation] = useState<Record<
    string,
    unknown
  > | null>(null)
  const historyRef = useRef<ExtractionHistoryHandle>(null)

  const handleViewExtraction = useCallback((data: ExtractionData) => {
    if (isRentCalculationResult(data)) {
      setSelectedRentCalculation(data as Record<string, unknown>)
      setSelectedExtraction(null)
    } else {
      setSelectedExtraction(data as LeaseExtractionResult)
      setSelectedRentCalculation(null)
    }
  }, [])

  const handleCloseModal = useCallback(() => {
    setSelectedExtraction(null)
    setSelectedRentCalculation(null)
  }, [])

  const handleExtractionComplete = useCallback(() => {
    historyRef.current?.refresh()
  }, [])

  return (
    <div className="space-y-6">
      <UploadFileWrapper
        label={label}
        toolType={toolType}
        onExtractionComplete={handleExtractionComplete}
      />

      {/* <ExtractionHistory
        ref={historyRef}
        onViewExtraction={handleViewExtraction}
        toolType={toolType}
      /> */}

      <ExtractionDetailModal
        extraction={selectedExtraction}
        onClose={handleCloseModal}
      />

      <RentCalculationDetailModal
        result={
          selectedRentCalculation as Parameters<
            typeof RentCalculationDetailModal
          >[0]["result"]
        }
        onClose={handleCloseModal}
      />
    </div>
  )
}
