"use client"

import { useState, useCallback, useEffect } from "react"
import type { LeaseExtractionResult } from "@/app/lib/extraction/types"
import { useJobTracker } from "@/app/components/job-tracker"
import type { toolType } from "@/app/static-data/agent"

interface UseExtractionReturn {
  isProcessing: boolean
  processingStatus: string | null
  extractionResult: LeaseExtractionResult | null
  error: string | null
  progress: number
  handleExtraction: (file: File) => Promise<void>
  reset: () => void
}

interface UseExtractionOptions {
  toolType?: toolType
}

export function useExtraction(
  options: UseExtractionOptions = {}
): UseExtractionReturn {
  const { toolType = "extraction-lease" } = options
  const {
    activeJob,
    jobStatus,
    progress: trackerProgress,
    message,
    result: trackerResult,
    error: trackerError,
    startJob,
    clearJob,
  } = useJobTracker()

  const [localResult, setLocalResult] = useState<LeaseExtractionResult | null>(
    null
  )
  const [localError, setLocalError] = useState<string | null>(null)

  // Sync tracker result to local state
  useEffect(() => {
    if (trackerResult) {
      setLocalResult(trackerResult)
    }
  }, [trackerResult])

  useEffect(() => {
    if (trackerError) {
      setLocalError(trackerError)
    }
  }, [trackerError])

  const isProcessing = jobStatus === "pending" || jobStatus === "processing"

  const processingStatus = isProcessing ? message : null

  const handleExtraction = useCallback(
    async (file: File) => {
      setLocalResult(null)
      setLocalError(null)

      try {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("toolType", toolType)

        const response = await fetch("/api/extraction-jobs", {
          method: "POST",
          body: formData,
        })

        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(data.message || `Erreur HTTP ${response.status}`)
        }

        const data = await response.json()

        if (!data.jobId) {
          throw new Error("Pas de jobId retourné par le serveur")
        }

        // Start tracking globally
        startJob(data.jobId, file.name)
      } catch (err) {
        const errorMsg =
          err instanceof Error
            ? err.message
            : "Erreur lors du traitement du PDF"
        setLocalError(errorMsg)
      }
    },
    [startJob, toolType]
  )

  const reset = useCallback(() => {
    clearJob()
    setLocalResult(null)
    setLocalError(null)
  }, [clearJob])

  return {
    isProcessing,
    processingStatus,
    extractionResult: localResult || trackerResult,
    error: localError || trackerError,
    progress: trackerProgress,
    handleExtraction,
    reset,
  }
}
