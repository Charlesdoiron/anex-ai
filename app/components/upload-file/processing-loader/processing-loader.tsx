"use client"

import { Loader2 } from "lucide-react"
import { getStatusDescription } from "@/app/lib/status-labels"

interface ProcessingLoaderProps {
  status?: string | null
  progress?: number
}

export default function ProcessingLoader({
  status,
  progress = 0,
}: ProcessingLoaderProps) {
  const displayStatus = status
    ? getStatusDescription(status)
    : "Traitement en cours..."

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
      </div>
    </div>
  )
}
