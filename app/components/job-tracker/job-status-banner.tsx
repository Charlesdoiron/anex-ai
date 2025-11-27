"use client"

import { useJobTracker } from "./job-tracker-provider"
import { X, FileText } from "lucide-react"
import { useEffect, useState, useCallback } from "react"

export function JobStatusBanner() {
  const { activeJob, jobStatus, progress, message, error, result, clearJob } =
    useJobTracker()
  const [isVisible, setIsVisible] = useState(false)
  const [isExiting, setIsExiting] = useState(false)

  const hasContent = activeJob || result || error

  const handleClose = useCallback(() => {
    setIsExiting(true)
    setTimeout(() => {
      clearJob()
      setIsExiting(false)
    }, 200)
  }, [clearJob])

  useEffect(() => {
    if (hasContent) {
      // Small delay for mount animation
      const timer = setTimeout(() => setIsVisible(true), 50)
      return () => clearTimeout(timer)
    } else {
      setIsVisible(false)
    }
  }, [hasContent])

  // Auto-dismiss after completion/failure
  useEffect(() => {
    const shouldAutoDismiss =
      jobStatus === "completed" || jobStatus === "failed"
    if (shouldAutoDismiss) {
      const timer = setTimeout(() => {
        handleClose()
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [jobStatus, handleClose])

  if (!hasContent) return null

  const isProcessing = jobStatus === "pending" || jobStatus === "processing"
  const isCompleted = jobStatus === "completed" || result
  const isFailed = jobStatus === "failed" || error

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ease-out ${
        isVisible && !isExiting
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-4"
      }`}
    >
      <div className="bg-white/95 backdrop-blur-xl shadow-2xl shadow-black/5 rounded-2xl border border-gray-100 overflow-hidden w-80">
        {/* Progress bar at top */}
        {isProcessing && (
          <div className="h-0.5 bg-gray-100">
            <div
              className="h-full bg-brand-green transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Status indicator */}
            <div className="relative flex-shrink-0">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  isProcessing
                    ? "bg-brand-green/5"
                    : isCompleted
                      ? "bg-emerald-50"
                      : "bg-red-50"
                }`}
              >
                <FileText
                  className={`w-5 h-5 ${
                    isProcessing
                      ? "text-brand-green"
                      : isCompleted
                        ? "text-emerald-600"
                        : "text-red-500"
                  }`}
                  strokeWidth={1.5}
                />
              </div>
              {isProcessing && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-brand-green" />
              )}
              {isCompleted && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-gray-900">
                  {isProcessing && "Extraction"}
                  {isCompleted && "Terminé"}
                  {isFailed && "Échec"}
                </span>
                <button
                  onClick={handleClose}
                  className="p-1 -mr-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {activeJob && (
                <p className="text-xs text-gray-500 truncate mt-0.5">
                  {activeJob.fileName}
                </p>
              )}

              {isProcessing && message && (
                <p className="text-xs text-gray-400 mt-2">{message}</p>
              )}

              {isProcessing && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs font-medium text-brand-green tabular-nums">
                    {progress}%
                  </span>
                  <span className="text-xs text-gray-300">•</span>
                  <span className="text-xs text-gray-400">en cours</span>
                </div>
              )}

              {isCompleted && (
                <p className="text-xs text-emerald-600 mt-1">
                  Résultat disponible
                </p>
              )}

              {isFailed && error && (
                <p className="text-xs text-red-500 mt-1 line-clamp-2">
                  {error}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
