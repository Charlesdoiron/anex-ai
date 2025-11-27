"use client"

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react"
import type { LeaseExtractionResult } from "@/app/lib/extraction/types"
import {
  saveActiveJob,
  getActiveJob,
  clearActiveJob,
  type PersistedJob,
} from "@/app/lib/jobs/job-persistence"

type JobStatus = "pending" | "processing" | "completed" | "failed" | null

interface JobTrackerContextType {
  activeJob: PersistedJob | null
  jobStatus: JobStatus
  progress: number
  message: string | null
  result: LeaseExtractionResult | null
  error: string | null
  startJob: (jobId: string, fileName: string) => void
  clearJob: () => void
}

const JobTrackerContext = createContext<JobTrackerContextType | null>(null)

const POLL_INTERVAL_BASE_MS = 1500
const POLL_INTERVAL_MAX_MS = 4000

export function JobTrackerProvider({ children }: { children: ReactNode }) {
  const [activeJob, setActiveJob] = useState<PersistedJob | null>(null)
  const [jobStatus, setJobStatus] = useState<JobStatus>(null)
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const [result, setResult] = useState<LeaseExtractionResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const pollCountRef = useRef(0)

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearTimeout(pollingRef.current)
      pollingRef.current = null
    }
    pollCountRef.current = 0
  }, [])

  const clearJob = useCallback(() => {
    stopPolling()
    clearActiveJob()
    setActiveJob(null)
    setJobStatus(null)
    setProgress(0)
    setMessage(null)
    setResult(null)
    setError(null)
  }, [stopPolling])

  const pollJob = useCallback(
    async (jobId: string) => {
      try {
        const response = await fetch(`/api/extraction-jobs/${jobId}`)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data = await response.json()

        setJobStatus(data.status)
        setProgress(data.progress || 0)
        setMessage(data.message)

        if (data.status === "completed") {
          const resultResponse = await fetch(
            `/api/extraction-jobs/${jobId}?includeResult=true`
          )
          const resultData = await resultResponse.json()
          setResult(resultData.result || null)
          clearActiveJob()
          stopPolling()
          return
        }

        if (data.status === "failed") {
          setError(data.errorMessage || "Extraction échouée")
          clearActiveJob()
          stopPolling()
          return
        }

        // Continue polling
        pollCountRef.current++
        const interval = Math.min(
          POLL_INTERVAL_BASE_MS + pollCountRef.current * 300,
          POLL_INTERVAL_MAX_MS
        )
        pollingRef.current = setTimeout(() => pollJob(jobId), interval)
      } catch (err) {
        console.error("Job polling error:", err)
        // Retry on error
        pollingRef.current = setTimeout(() => pollJob(jobId), 3000)
      }
    },
    [stopPolling]
  )

  const startJob = useCallback(
    (jobId: string, fileName: string) => {
      stopPolling()

      const job: PersistedJob = {
        jobId,
        fileName,
        startedAt: new Date().toISOString(),
      }

      saveActiveJob(job)
      setActiveJob(job)
      setJobStatus("pending")
      setProgress(0)
      setMessage("Démarrage...")
      setResult(null)
      setError(null)

      pollJob(jobId)
    },
    [pollJob, stopPolling]
  )

  // Restore job on mount
  useEffect(() => {
    const stored = getActiveJob()
    if (stored) {
      setActiveJob(stored)
      setJobStatus("processing")
      setMessage("Reprise du suivi...")
      pollJob(stored.jobId)
    }

    return () => stopPolling()
  }, [pollJob, stopPolling])

  return (
    <JobTrackerContext.Provider
      value={{
        activeJob,
        jobStatus,
        progress,
        message,
        result,
        error,
        startJob,
        clearJob,
      }}
    >
      {children}
    </JobTrackerContext.Provider>
  )
}

export function useJobTracker() {
  const context = useContext(JobTrackerContext)
  if (!context) {
    throw new Error("useJobTracker must be used within JobTrackerProvider")
  }
  return context
}
