"use client"

import { useState, useCallback, useEffect } from "react"
import type { LeaseExtractionResult } from "@/app/lib/extraction/types"
import { useJobTracker } from "@/app/components/job-tracker"
import type { toolType } from "@/app/static-data/agent"

interface UseExtractionReturn {
  isProcessing: boolean
  isSubmitting: boolean
  processingStatus: string | null
  extractionResult: LeaseExtractionResult | null
  error: string | null
  progress: number
  handleExtraction: (file: File) => Promise<void>
  reset: () => void
  cancel: () => Promise<void>
  isCancelling: boolean
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
    cancelJob,
  } = useJobTracker()

  const [localResult, setLocalResult] = useState<LeaseExtractionResult | null>(
    null
  )
  const [localError, setLocalError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)

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
      if (isSubmitting) return

      setLocalResult(null)
      setLocalError(null)
      setIsSubmitting(true)

      try {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("toolType", toolType)

        const response = await fetch("/api/extraction-jobs", {
          method: "POST",
          body: formData,
        })

        const data = await response.json().catch(() => ({}))

        // Handle duplicate job - use existing job instead of showing error
        if (response.status === 409 && data.existingJobId) {
          startJob(data.existingJobId, file.name)
          return
        }

        if (!response.ok) {
          throw new Error(data.message || `Erreur HTTP ${response.status}`)
        }

        if (!data.jobId) {
          throw new Error("Pas de jobId retourné par le serveur")
        }

        startJob(data.jobId, file.name)
      } catch (err) {
        const errorMsg =
          err instanceof Error
            ? err.message
            : "Erreur lors du traitement du PDF"
        setLocalError(errorMsg)
      } finally {
        setIsSubmitting(false)
      }
    },
    [startJob, toolType, isSubmitting]
  )

  const reset = useCallback(() => {
    clearJob()
    setLocalResult(null)
    setLocalError(null)
    setIsSubmitting(false)
  }, [clearJob])

  const cancel = useCallback(async () => {
    if (!activeJob || isCancelling) {
      return
    }
    setIsCancelling(true)
    setLocalError(null)
    try {
      await cancelJob()
    } finally {
      setIsCancelling(false)
    }
  }, [activeJob, cancelJob, isCancelling])

  return {
    isProcessing,
    isSubmitting,
    processingStatus,
    extractionResult: localResult || trackerResult,
    error: localError || trackerError,
    progress: trackerProgress,
    handleExtraction,
    reset,
    cancel,
    isCancelling,
  }
}
