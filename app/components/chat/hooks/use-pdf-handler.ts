"use client"

import { useState, useRef } from "react"
import { MessageWithSources } from "../types"
import { SourceInfo } from "@/app/lib/rag/types"
import type {
  ExtractionProgress,
  LeaseExtractionResult,
} from "@/app/lib/extraction/types"

interface UsePdfHandlerProps {
  setMessages: (
    messages:
      | MessageWithSources[]
      | ((messages: MessageWithSources[]) => MessageWithSources[])
  ) => void
  onExtractionComplete?: () => void
  onDocumentReady?: (result: LeaseExtractionResult) => void
  onPartialResult?: (partialResult: Partial<LeaseExtractionResult>) => void
}

export function usePdfHandler({
  setMessages,
  onExtractionComplete,
  onDocumentReady,
  onPartialResult,
}: UsePdfHandlerProps) {
  const [uploadedPdf, setUploadedPdf] = useState<File | null>(null)
  const [isProcessingPdf, setIsProcessingPdf] = useState(false)
  const [processingStatus, setProcessingStatus] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ============================================
  // DEV MODE: Trigger extraction without file upload
  // ============================================
  async function handleDevModeExtraction() {
    setIsProcessingPdf(true)
    setProcessingStatus("🚀 Mode développement: connexion au pipeline...")

    const processingMessageId = `processing-${Date.now()}`

    try {
      const formData = new FormData()
      const dummyFile = new Blob(["dev"], { type: "application/pdf" })
      formData.append("file", dummyFile, "dev-mode.pdf")
      formData.append("stream", "true")

      setMessages((prev) => [
        ...prev,
        {
          id: processingMessageId,
          role: "assistant",
          content: "⏳ Démarrage de l'extraction...",
        },
      ])

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
                  | { type: "final_result"; result: LeaseExtractionResult }
                  | { result: LeaseExtractionResult }

                if (data && typeof data === "object") {
                  if ("type" in data && data.type === "partial_result") {
                    partialResult = { ...(partialResult || {}), ...data.result }
                    onPartialResult?.(partialResult)
                    if (!extractionResult && partialResult.documentId) {
                      onDocumentReady?.(partialResult as LeaseExtractionResult)
                    }
                  } else if ("type" in data && data.type === "final_result") {
                    extractionResult = data.result
                    onDocumentReady?.(extractionResult)
                  } else if ("result" in data && !("type" in data)) {
                    extractionResult = data.result
                    onDocumentReady?.(extractionResult)
                  } else if ("status" in data) {
                    setProcessingStatus(data.message)
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === processingMessageId
                          ? {
                              ...msg,
                              content: `⏳ ${data.message} (${data.progress}%)`,
                            }
                          : msg
                      )
                    )
                  }
                }
              } catch (e) {
                console.warn("Failed to parse SSE data:", e)
              }
            }
          }
        }
      }

      setMessages((prev) =>
        prev.filter((msg) => msg.id !== processingMessageId)
      )

      if (extractionResult) {
        const summary = formatExtractionSummary(extractionResult)
        setMessages((prev) => [
          ...prev,
          {
            id: `extraction-${Date.now()}`,
            role: "assistant",
            content: summary,
          },
        ])
        onDocumentReady?.(extractionResult)
      }

      if (onExtractionComplete) {
        onExtractionComplete()
      }
    } catch (error) {
      console.error("Dev mode extraction error:", error)
      setMessages((prev) => [
        ...prev.filter((msg) => msg.id !== processingMessageId),
        {
          id: `dev-error-${Date.now()}`,
          role: "assistant",
          content: `❌ Erreur dev mode: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        },
      ])
    } finally {
      setIsProcessingPdf(false)
      setProcessingStatus(null)
    }
  }
  // ============================================

  async function handlePdfUpload(file: File) {
    setIsProcessingPdf(true)
    setProcessingStatus("📤 Chargement du PDF...")

    const processingMessageId = `processing-${Date.now()}`

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("stream", "true")

      const userMessage: MessageWithSources = {
        id: Date.now().toString(),
        role: "user",
        content: `📄 Document uploadé: ${file.name}`,
      }

      setMessages((prev) => [...prev, userMessage])

      setMessages((prev) => [
        ...prev,
        {
          id: processingMessageId,
          role: "assistant",
          content: "⏳ Démarrage de l'extraction...",
        },
      ])

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
                  | { type: "final_result"; result: LeaseExtractionResult }
                  | { result: LeaseExtractionResult }

                if (data && typeof data === "object") {
                  if ("type" in data && data.type === "partial_result") {
                    partialResult = { ...(partialResult || {}), ...data.result }
                    onPartialResult?.(partialResult)
                    if (!extractionResult && partialResult.documentId) {
                      onDocumentReady?.(partialResult as LeaseExtractionResult)
                    }
                  } else if ("type" in data && data.type === "final_result") {
                    extractionResult = data.result
                    onDocumentReady?.(extractionResult)
                  } else if ("result" in data && !("type" in data)) {
                    extractionResult = data.result
                    onDocumentReady?.(extractionResult)
                  } else if ("status" in data) {
                    setProcessingStatus(data.message)
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === processingMessageId
                          ? {
                              ...msg,
                              content: `⏳ ${data.message} (${data.progress}%)`,
                            }
                          : msg
                      )
                    )
                  }
                }
              } catch (e) {
                console.warn("Failed to parse SSE data:", e)
              }
            }
          }
        }
      }

      setMessages((prev) =>
        prev.filter((msg) => msg.id !== processingMessageId)
      )

      if (extractionResult) {
        const summary = formatExtractionSummary(extractionResult)
        setMessages((prev) => [
          ...prev,
          {
            id: `extraction-${Date.now()}`,
            role: "assistant",
            content: summary,
          },
        ])
        onDocumentReady?.(extractionResult)
      }

      if (onExtractionComplete) {
        onExtractionComplete()
      }

      setUploadedPdf(null)
    } catch (error) {
      console.error("PDF upload error:", error)
      setMessages((prev) => [
        ...prev.filter((msg) => msg.id !== processingMessageId),
        {
          id: `pdf-error-${Date.now()}`,
          role: "assistant",
          content: `❌ Erreur lors du traitement du PDF: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        },
      ])
      setUploadedPdf(null)
    } finally {
      setIsProcessingPdf(false)
      setProcessingStatus(null)
    }
  }

  function formatExtractionSummary(result: LeaseExtractionResult): string {
    const meta = result.extractionMetadata
    const confidenceEmoji =
      meta.averageConfidence > 0.8
        ? "✅"
        : meta.averageConfidence > 0.6
          ? "⚠️"
          : "❌"

    let summary = `## 📋 Résultat de l'extraction\n\n`
    summary += `${confidenceEmoji} **Statistiques:**\n`
    summary += `- Champs extraits: ${meta.extractedFields}/${meta.totalFields}\n`
    summary += `- Champs manquants: ${meta.missingFields}\n`
    summary += `- Confiance moyenne: ${(meta.averageConfidence * 100).toFixed(1)}%\n`
    summary += `- Temps de traitement: ${(meta.processingTimeMs / 1000).toFixed(1)}s\n\n`

    if (
      result.regime?.regime?.value &&
      result.regime.regime.value !== "unknown"
    ) {
      summary += `**Régime du bail:** ${result.regime.regime.value}\n\n`
    }

    if (result.parties?.landlord?.name?.value) {
      summary += `**Bailleur:** ${result.parties.landlord.name.value}\n`
    }
    if (result.parties?.tenant?.name?.value) {
      summary += `**Locataire:** ${result.parties.tenant.name.value}\n\n`
    }

    if (result.premises?.surfaceArea?.value) {
      summary += `**Surface:** ${result.premises.surfaceArea.value} m²\n`
    }
    if (result.premises?.address?.value) {
      summary += `**Adresse:** ${result.premises.address.value}\n\n`
    }

    if (result.rent?.annualRentExclTaxExclCharges?.value) {
      summary += `**Loyer annuel (HTHC):** ${result.rent.annualRentExclTaxExclCharges.value.toLocaleString("fr-FR")} €\n`
    }
    if (result.calendar?.effectiveDate?.value) {
      summary += `**Date de prise d'effet:** ${new Date(result.calendar.effectiveDate.value).toLocaleDateString("fr-FR")}\n`
    }
    if (result.calendar?.duration?.value) {
      summary += `**Durée:** ${result.calendar.duration.value} ans\n\n`
    }

    summary += `\n📄 **Document ID:** ${result.documentId}\n`
    summary += `📅 **Date d'extraction:** ${new Date(result.extractionDate).toLocaleString("fr-FR")}`

    return summary
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file && file.type === "application/pdf") {
      setUploadedPdf(file)
      console.log("PDF selected:", file.name)
      await handlePdfUpload(file)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } else if (file) {
      alert("Please select a PDF file")
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  function removePdf() {
    setUploadedPdf(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return {
    uploadedPdf,
    isProcessingPdf,
    processingStatus,
    fileInputRef,
    handleFileSelect,
    removePdf,
    handleDevModeExtraction, // DEV MODE: expose dev mode extraction
  }
}
