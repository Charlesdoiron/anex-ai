"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/**
 * Detects chunk loading failures after a new deployment and gracefully reloads.
 * This handles the "version skew" problem when users have stale JS bundles.
 */
export function DeploymentGuard() {
  const router = useRouter()

  useEffect(() => {
    const handleChunkError = (event: ErrorEvent) => {
      const isChunkError =
        event.message?.includes("Loading chunk") ||
        event.message?.includes("ChunkLoadError") ||
        event.message?.includes(
          "Failed to fetch dynamically imported module"
        ) ||
        event.message?.includes("Importing a module script failed") ||
        event.message?.includes("error loading dynamically imported module")

      if (isChunkError) {
        event.preventDefault()

        // Clear Next.js cache and reload
        if ("caches" in window) {
          caches.keys().then((names) => {
            names.forEach((name) => caches.delete(name))
          })
        }

        // Use router.refresh() first for a softer reload
        router.refresh()

        // If still failing, do a hard reload after a short delay
        setTimeout(() => {
          window.location.reload()
        }, 500)
      }
    }

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const errorMessage = event.reason?.message || String(event.reason)

      const isChunkError =
        errorMessage.includes("Loading chunk") ||
        errorMessage.includes("ChunkLoadError") ||
        errorMessage.includes("Failed to fetch dynamically imported module") ||
        errorMessage.includes("Importing a module script failed") ||
        errorMessage.includes("error loading dynamically imported module")

      if (isChunkError) {
        event.preventDefault()

        if ("caches" in window) {
          caches.keys().then((names) => {
            names.forEach((name) => caches.delete(name))
          })
        }

        router.refresh()
        setTimeout(() => {
          window.location.reload()
        }, 500)
      }
    }

    window.addEventListener("error", handleChunkError)
    window.addEventListener("unhandledrejection", handleUnhandledRejection)

    return () => {
      window.removeEventListener("error", handleChunkError)
      window.removeEventListener("unhandledrejection", handleUnhandledRejection)
    }
  }, [router])

  return null
}
