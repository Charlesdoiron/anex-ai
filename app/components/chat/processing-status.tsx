"use client"

interface ProcessingStatusProps {
  status: string | null
  progress?: number
}

export function ProcessingStatus({ status, progress }: ProcessingStatusProps) {
  if (!status) return null

  return (
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 animate-in fade-in duration-300">
      <div className="bg-white dark:bg-[#40414f] px-6 py-4 rounded-2xl shadow-lg dark:shadow-xl border border-gray-300 dark:border-gray-700 min-w-[300px]">
        <div className="flex items-center gap-3">
          {/* Spinner */}
          <div className="flex-shrink-0">
            <svg
              className="animate-spin h-5 w-5 text-gray-800 dark:text-gray-300"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          </div>

          {/* Status text */}
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {status}
            </p>
            {progress !== undefined && (
              <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                <div
                  className="bg-gray-800 dark:bg-gray-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
