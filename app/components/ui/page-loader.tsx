"use client"

interface PageLoaderProps {
  message?: string
  fullScreen?: boolean
  size?: "sm" | "md" | "lg"
}

export function PageLoader({
  message = "Chargement...",
  fullScreen = false,
  size = "md",
}: PageLoaderProps) {
  const sizeClasses = {
    sm: "w-6 h-6 border-2",
    md: "w-10 h-10 border-2",
    lg: "w-16 h-16 border-[3px]",
  }

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none">
        <div className="absolute inset-0 bg-white/60 dark:bg-gray-900/60 backdrop-blur-[2px]" />
        <div className="relative flex flex-col items-center gap-4 z-50">
          <div className="relative">
            <div
              className={`${sizeClasses[size]} border-gray-200 dark:border-gray-700 rounded-full animate-spin`}
            />
            <div
              className={`${sizeClasses[size]} border-t-brand-green dark:border-t-brand-green absolute top-0 left-0 rounded-full animate-spin`}
            />
          </div>
          {message && (
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 animate-pulse">
              {message}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center py-12">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div
            className={`${sizeClasses[size]} border-gray-200 dark:border-gray-700 rounded-full animate-spin`}
          />
          <div
            className={`${sizeClasses[size]} border-t-brand-green dark:border-t-brand-green absolute top-0 left-0 rounded-full animate-spin`}
          />
        </div>
        {message && (
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 animate-pulse">
            {message}
          </p>
        )}
      </div>
    </div>
  )
}
