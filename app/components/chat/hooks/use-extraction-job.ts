"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import type { LeaseExtractionResult } from "@/app/lib/extraction/types"

type JobStatus = "pending" | "processing" | "completed" | "failed" | "cancelled"

interface JobProgress {
  jobId: string
  status: JobStatus
  progress: number
  stage: string | null
  message: string | null
  documentId: string | null
  errorMessage: string | null
}

interface UseExtractionJobReturn {
  isProcessing: boolean
  jobId: string | null
  progress: number
  status: JobStatus | null
  message: string | null
  result: LeaseExtractionResult | null
  error: string | null
  startExtraction: (file: File) => Promise<void>
  cancelPolling: () => void
  cancelExtraction: () => Promise<void>
  isCancelling: boolean
}

// Adaptive polling: starts at 1s, increases up to 3s
const POLL_INTERVAL_BASE_MS = 1000
const POLL_INTERVAL_MAX_MS = 3000
const POLL_INTERVAL_INCREMENT_MS = 300

export function useExtractionJob(
  onProgress?: (progress: JobProgress) => void,
  onComplete?: (result: LeaseExtractionResult) => void,
  onError?: (error: string) => void
): UseExtractionJobReturn {
  const [isProcessing, setIsProcessing] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<JobStatus | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [result, setResult] = useState<LeaseExtractionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)

  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const pollCountRef = useRef(0)

  const cancelPolling = useCallback(() => {
    if (pollingRef.current) {
      clearTimeout(pollingRef.current)
      pollingRef.current = null
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    pollCountRef.current = 0
  }, [])

  useEffect(() => {
    return () => {
      cancelPolling()
    }
  }, [cancelPolling])

  const getPollingInterval = useCallback(() => {
    return Math.min(
      POLL_INTERVAL_BASE_MS + pollCountRef.current * POLL_INTERVAL_INCREMENT_MS,
      POLL_INTERVAL_MAX_MS
    )
  }, [])

  const pollJobStatus = useCallback(
    async (id: string) => {
      if (!id) return

      abortControllerRef.current = new AbortController()

      try {
        // Don't request result until completed
        const response = await fetch(`/api/extraction-jobs/${id}`, {
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data = await response.json()

        const jobProgress: JobProgress = {
          jobId: data.jobId,
          status: data.status,
          progress: data.progress,
          stage: data.stage,
          message: data.message,
          documentId: data.documentId,
          errorMessage: data.errorMessage,
        }

        setProgress(data.progress)
        setStatus(data.status)
        setMessage(data.message)
        onProgress?.(jobProgress)

        if (data.status === "completed") {
          // Fetch result only when completed
          const resultResponse = await fetch(
            `/api/extraction-jobs/${id}?includeResult=true`
          )
          const resultData = await resultResponse.json()

          setIsProcessing(false)
          if (resultData.result) {
            setResult(resultData.result)
            onComplete?.(resultData.result)
          }
          cancelPolling()
          return
        }

        if (data.status === "failed") {
          setIsProcessing(false)
          const errorMsg = data.errorMessage || "Extraction échouée"
          setError(errorMsg)
          onError?.(errorMsg)
          cancelPolling()
          return
        }

        if (data.status === "cancelled") {
          setIsProcessing(false)
          const cancelledMsg = data.message || "Extraction annulée"
          setMessage(cancelledMsg)
          setError(cancelledMsg)
          onError?.(cancelledMsg)
          cancelPolling()
          return
        }

        // Continue polling with adaptive interval
        pollCountRef.current++
        const interval = getPollingInterval()
        pollingRef.current = setTimeout(() => {
          pollJobStatus(id)
        }, interval)
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return
        }

        console.error("Polling error:", err)

        const interval = getPollingInterval() * 2
        pollingRef.current = setTimeout(() => {
          pollJobStatus(id)
        }, interval)
      }
    },
    [onProgress, onComplete, onError, cancelPolling, getPollingInterval]
  )

  const startExtraction = useCallback(
    async (file: File) => {
      cancelPolling()

      setIsProcessing(true)
      setIsCancelling(false)
      setJobId(null)
      setProgress(0)
      setStatus("pending")
      setMessage("Envoi du fichier...")
      setResult(null)
      setError(null)

      try {
        const formData = new FormData()
        formData.append("file", file)

        const response = await fetch("/api/extraction-jobs", {
          method: "POST",
          body: formData,
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.message || `HTTP ${response.status}`)
        }

        const data = await response.json()

        if (!data.jobId) {
          throw new Error("Pas de jobId retourné")
        }

        setJobId(data.jobId)
        setMessage("Job créé, extraction en cours...")

        pollJobStatus(data.jobId)
      } catch (err) {
        setIsProcessing(false)
        const errorMsg =
          err instanceof Error ? err.message : "Erreur lors de l'envoi"
        setError(errorMsg)
        onError?.(errorMsg)
      }
    },
    [cancelPolling, pollJobStatus, onError]
  )

  const cancelExtraction = useCallback(async () => {
    if (!jobId || isCancelling || !isProcessing) {
      return
    }
    setIsCancelling(true)
    try {
      await fetch(`/api/extraction-jobs/${jobId}/cancel`, { method: "POST" })
      setStatus("cancelled")
      setMessage("Extraction annulée")
      setError("Extraction annulée")
    } catch (err) {
      console.error("Cancellation error:", err)
      setError("Impossible d'annuler l'extraction")
    } finally {
      setIsProcessing(false)
      cancelPolling()
      setIsCancelling(false)
      setJobId(null)
    }
  }, [cancelPolling, isCancelling, isProcessing, jobId])

  return {
    isProcessing,
    jobId,
    progress,
    status,
    message,
    result,
    error,
    startExtraction,
    cancelPolling,
    cancelExtraction,
    isCancelling,
  }
}
