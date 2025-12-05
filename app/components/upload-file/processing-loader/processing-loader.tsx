"use client"

import { useState } from "react"
import { Loader2, XCircle } from "lucide-react"
import { getStatusDescription } from "@/app/lib/status-labels"

interface ProcessingLoaderProps {
  status?: string | null
  progress?: number
  onCancel?: () => void
  isCancelling?: boolean
}

export default function ProcessingLoader({
  status,
  progress = 0,
  onCancel,
  isCancelling,
}: ProcessingLoaderProps) {
  const [showConfirm, setShowConfirm] = useState(false)

  const displayStatus = status
    ? getStatusDescription(status)
    : "Traitement en cours..."

  const handleCancelClick = () => {
    if (!showConfirm) {
      setShowConfirm(true)
      return
    }
    onCancel?.()
    setShowConfirm(false)
  }

  const handleCancelAbort = () => {
    setShowConfirm(false)
  }

  return (
    <div className="group relative bg-white rounded-2xl border-2 border-brand-green/20 p-8 sm:p-12 shadow-sm hover:shadow-xl transition-all duration-300">
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-cream/80 to-brand-green/5 rounded-2xl opacity-50" />

      <div className="relative flex flex-col items-center justify-center gap-6">
        {/* Animated loader */}
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-brand-green/10 flex items-center justify-center">
          <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 text-brand-green animate-spin" />
        </div>

        {/* Status message */}
        <div className="text-center w-full">
          <p className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
            {displayStatus}
          </p>

          {/* Progress bar */}
          {progress > 0 && (
            <div className="mt-4 max-w-md mx-auto">
              <div className="w-full bg-gray-200 rounded-full h-3 shadow-inner">
                <div
                  className="bg-brand-green h-3 rounded-full transition-all duration-500 ease-out shadow-sm"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 mt-2 font-medium">
                {progress}%
              </p>
            </div>
          )}
        </div>

        {onCancel && !showConfirm && (
          <button
            type="button"
            onClick={handleCancelClick}
            disabled={isCancelling}
            className="group/btn inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <XCircle className="w-4 h-4 text-gray-500 group-hover/btn:text-gray-700 transition-colors" />
            {isCancelling ? "Annulation..." : "Annuler"}
          </button>
        )}

        {onCancel && showConfirm && (
          <div className="flex flex-col items-center gap-3 w-full max-w-sm">
            <p className="text-sm text-gray-600 text-center">
              Êtes-vous sûr de vouloir annuler l&apos;extraction ?
            </p>
            <div className="flex gap-3 w-full">
              <button
                type="button"
                onClick={handleCancelAbort}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Non, continuer
              </button>
              <button
                type="button"
                onClick={handleCancelClick}
                disabled={isCancelling}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCancelling ? "Annulation..." : "Oui, annuler"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
