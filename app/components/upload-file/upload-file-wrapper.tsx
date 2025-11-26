"use client"

import { toolType } from "@/app/static-data/agent"
import UploadFile from "./upload-file"
import DownloadResultButton from "./download-result-button"
import { useState } from "react"
import type {
  ExtractionProgress,
  LeaseExtractionResult,
} from "@/app/lib/extraction/types"
import { Loader2, AlertCircle } from "lucide-react"

export default function UploadFileWrapper({
  label,
  toolType,
}: {
  label?: string
  toolType: toolType
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isProcessingPdf, setIsProcessingPdf] = useState(false)
  const [processingStatus, setProcessingStatus] = useState<string | null>(null)
  const [extractionResult, setExtractionResult] =
    useState<LeaseExtractionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<number>(0)

  function handleFileSelect(file: File) {
    setSelectedFile(file)
    setError(null)
    setProgress(0)
  }

  function handleFileRemove() {
    setSelectedFile(null)
    setError(null)
    setProgress(0)
  }

  async function handleExtraction() {
    if (!selectedFile) {
      setError("Aucun fichier sélectionné")
      return
    }

    setIsProcessingPdf(true)
    setProcessingStatus("📤 Chargement du PDF...")
    setError(null)
    setProgress(0)

    try {
      const formData = new FormData()
      formData.append("file", selectedFile)
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
      let extractionResult: LeaseExtractionResult | null = null
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
                  // Check for type first to distinguish between different message types
                  if ("type" in data) {
                    if (data.type === "partial_result") {
                      partialResult = {
                        ...(partialResult || {}),
                        ...data.result,
                      }
                      // Don't set extractionResult from partial - wait for final
                    } else if (data.type === "final_result") {
                      extractionResult = data.result
                      setExtractionResult(extractionResult)
                      // Also update status and progress from final result
                      if (data.message) setProcessingStatus(data.message)
                      if (data.progress !== undefined)
                        setProgress(data.progress)
                    }
                  } else if ("result" in data && !("type" in data)) {
                    // Legacy format without type field
                    extractionResult = data.result
                    setExtractionResult(extractionResult)
                  } else if (
                    "status" in data &&
                    !("type" in data) &&
                    !("result" in data)
                  ) {
                    // This is a progress update (ExtractionProgress)
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

      // Ensure we have the final result before proceeding
      if (!extractionResult) {
        throw new Error("Aucun résultat d'extraction reçu")
      }

      // Verify the result is complete (has all required fields)
      if (
        !extractionResult.documentId ||
        !extractionResult.extractionMetadata
      ) {
        throw new Error("Résultat d'extraction incomplet")
      }

      // Ensure final progress is set
      setProgress(100)
    } catch (error) {
      console.error("PDF extraction error:", error)
      setError(
        error instanceof Error
          ? error.message
          : "Erreur lors du traitement du PDF"
      )
      setSelectedFile(null)
    } finally {
      setIsProcessingPdf(false)
      // Keep processingStatus for a moment to show final message, then it will be cleared when component re-renders with extractionResult
    }
  }

  function handleReset() {
    setSelectedFile(null)
    setIsProcessingPdf(false)
    setProcessingStatus(null)
    setExtractionResult(null)
    setError(null)
    setProgress(0)
  }

  // Only show download button if we have a complete extraction result
  if (
    extractionResult &&
    extractionResult.documentId &&
    extractionResult.extractionMetadata
  ) {
    return (
      <DownloadResultButton
        extraction={extractionResult}
        onReset={handleReset}
        label={label}
      />
    )
  }

  // Show only loader during processing
  if (isProcessingPdf) {
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
              {processingStatus || "Traitement en cours..."}
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

  // Show error if any
  if (error) {
    return (
      <div className="space-y-4">
        <div className="group relative bg-white rounded-2xl border-2 border-red-200 p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-900">
                Erreur lors du traitement
              </p>
              <p className="text-xs text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
        <UploadFile
          onFileSelect={handleFileSelect}
          onFileRemove={handleFileRemove}
          onAction={selectedFile ? handleExtraction : undefined}
          actionLabel={label}
          toolType={toolType}
        />
      </div>
    )
  }

  // Show upload component when not processing
  return (
    <UploadFile
      onFileSelect={handleFileSelect}
      onFileRemove={handleFileRemove}
      onAction={selectedFile ? handleExtraction : undefined}
      actionLabel={label}
      toolType={toolType}
    />
  )
}
