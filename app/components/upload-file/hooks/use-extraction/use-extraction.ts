"use client"

import { useState } from "react"
import type {
  ExtractionProgress,
  LeaseExtractionResult,
} from "@/app/lib/extraction/types"

interface UseExtractionReturn {
  isProcessing: boolean
  processingStatus: string | null
  extractionResult: LeaseExtractionResult | null
  error: string | null
  progress: number
  handleExtraction: (file: File) => Promise<void>
  reset: () => void
}

export function useExtraction(): UseExtractionReturn {
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState<string | null>(null)
  const [extractionResult, setExtractionResult] =
    useState<LeaseExtractionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<number>(0)

  async function handleExtraction(file: File) {
    setIsProcessing(true)
    setProcessingStatus("📤 Chargement du PDF...")
    setError(null)
    setProgress(0)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("stream", "true")

      const response = await fetch("/api/extract-lease", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let result: LeaseExtractionResult | null = null
      let partialResult: Partial<LeaseExtractionResult> | null = null

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n\n")
          buffer = lines.pop() || ""

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6)) as
                  | ExtractionProgress
                  | {
                      type: "partial_result"
                      result: Partial<LeaseExtractionResult>
                    }
                  | {
                      type: "final_result"
                      result: LeaseExtractionResult
                      status?: string
                      message?: string
                      progress?: number
                    }
                  | { result: LeaseExtractionResult }

                if (data && typeof data === "object") {
                  if ("type" in data) {
                    if (data.type === "partial_result") {
                      partialResult = {
                        ...(partialResult || {}),
                        ...data.result,
                      }
                    } else if (data.type === "final_result") {
                      result = data.result
                      setExtractionResult(result)
                      if (data.message) setProcessingStatus(data.message)
                      if (data.progress !== undefined)
                        setProgress(data.progress)
                    }
                  } else if ("result" in data && !("type" in data)) {
                    result = data.result
                    setExtractionResult(result)
                  } else if (
                    "status" in data &&
                    !("type" in data) &&
                    !("result" in data)
                  ) {
                    const progressData = data as ExtractionProgress
                    setProcessingStatus(progressData.message)
                    setProgress(progressData.progress)
                  }
                }
              } catch (e) {
                console.warn("Failed to parse SSE data:", e)
              }
            }
          }
        }
      }

      if (!result) {
        throw new Error("Aucun résultat d'extraction reçu")
      }

      if (!result.documentId || !result.extractionMetadata) {
        throw new Error("Résultat d'extraction incomplet")
      }

      setProgress(100)
    } catch (error) {
      console.error("PDF extraction error:", error)
      setError(
        error instanceof Error
          ? error.message
          : "Erreur lors du traitement du PDF"
      )
    } finally {
      setIsProcessing(false)
    }
  }

  function reset() {
    setIsProcessing(false)
    setProcessingStatus(null)
    setExtractionResult(null)
    setError(null)
    setProgress(0)
  }

  return {
    isProcessing,
    processingStatus,
    extractionResult,
    error,
    progress,
    handleExtraction,
    reset,
  }
}
