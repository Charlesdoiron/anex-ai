"use client"

import { useState, useRef, useCallback } from "react"
import { MessageWithSources } from "../types"
import type { LeaseExtractionResult } from "@/app/lib/extraction/types"
import { useExtractionJob } from "./use-extraction-job"

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
}: UsePdfHandlerProps) {
  const [uploadedPdf, setUploadedPdf] = useState<File | null>(null)
  const [processingMessageId, setProcessingMessageId] = useState<string | null>(
    null
  )
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleProgress = useCallback(
    (progress: { progress: number; message: string | null }) => {
      if (!processingMessageId) return
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === processingMessageId
            ? {
                ...msg,
                content: `⏳ ${progress.message || "Traitement..."} (${progress.progress}%)`,
              }
            : msg
        )
      )
    },
    [processingMessageId, setMessages]
  )

  const handleComplete = useCallback(
    (result: LeaseExtractionResult) => {
      if (processingMessageId) {
        setMessages((prev) =>
          prev.filter((msg) => msg.id !== processingMessageId)
        )
      }

      const summary = formatExtractionSummary(result)
      setMessages((prev) => [
        ...prev,
        {
          id: `extraction-${Date.now()}`,
          role: "assistant",
          content: summary,
        },
      ])

      onDocumentReady?.(result)
      onExtractionComplete?.()
      setUploadedPdf(null)
      setProcessingMessageId(null)
    },
    [processingMessageId, setMessages, onDocumentReady, onExtractionComplete]
  )

  const handleError = useCallback(
    (error: string) => {
      if (processingMessageId) {
        setMessages((prev) => [
          ...prev.filter((msg) => msg.id !== processingMessageId),
          {
            id: `pdf-error-${Date.now()}`,
            role: "assistant",
            content: `❌ Erreur lors du traitement du PDF: ${error}`,
          },
        ])
      }
      setUploadedPdf(null)
      setProcessingMessageId(null)
    },
    [processingMessageId, setMessages]
  )

  const {
    isProcessing: isProcessingPdf,
    progress,
    message,
    startExtraction,
    cancelExtraction,
    isCancelling,
  } = useExtractionJob(handleProgress, handleComplete, handleError)

  const processingStatus = isProcessingPdf
    ? message || `Traitement... (${progress}%)`
    : null

  async function handlePdfUpload(file: File) {
    const msgId = `processing-${Date.now()}`
    setProcessingMessageId(msgId)

    const userMessage: MessageWithSources = {
      id: Date.now().toString(),
      role: "user",
      content: `📄 Document uploadé: ${file.name}`,
    }

    setMessages((prev) => [
      ...prev,
      userMessage,
      {
        id: msgId,
        role: "assistant",
        content: "⏳ Envoi du fichier...",
      },
    ])

    await startExtraction(file)
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file && file.type === "application/pdf") {
      setUploadedPdf(file)
      await handlePdfUpload(file)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } else if (file) {
      alert("Veuillez sélectionner un fichier PDF")
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  async function removePdf() {
    await cancelExtraction()
    setUploadedPdf(null)
    setProcessingMessageId(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  // DEV MODE: Kept for backward compatibility but uses job queue
  async function handleDevModeExtraction() {
    const msgId = `processing-${Date.now()}`
    setProcessingMessageId(msgId)

    setMessages((prev) => [
      ...prev,
      {
        id: msgId,
        role: "assistant",
        content: "⏳ Mode développement: démarrage...",
      },
    ])

    const dummyFile = new File(["dev"], "dev-mode.pdf", {
      type: "application/pdf",
    })
    await startExtraction(dummyFile)
  }

  return {
    uploadedPdf,
    isProcessingPdf,
    processingStatus,
    fileInputRef,
    handleFileSelect,
    removePdf,
    isCancelling,
    handleDevModeExtraction,
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
  summary += `- Temps de traitement: ${(meta.processingTimeMs / 1000).toFixed(1)}s\n\n`

  if (
    result.regime?.regime?.value &&
    result.regime.regime.value !== "unknown"
  ) {
    summary += `**Régime du bail:** ${result.regime.regime.value}\n\n`
  }

  if (result.parties?.landlord?.name?.value) {
    summary += `**Bailleur:** ${safeString(result.parties.landlord.name.value)}\n`
  }
  if (result.parties?.tenant?.name?.value) {
    summary += `**Locataire:** ${safeString(result.parties.tenant.name.value)}\n\n`
  }

  if (result.premises?.surfaceArea?.value) {
    summary += `**Surface:** ${safeNumber(result.premises.surfaceArea.value)} m²\n`
  }
  if (result.premises?.address?.value) {
    summary += `**Adresse:** ${safeString(result.premises.address.value)}\n\n`
  }

  const annualRent = safeNumber(
    result.rent?.annualRentExclTaxExclCharges?.value
  )
  if (annualRent !== null) {
    summary += `**Loyer annuel (HTHC):** ${annualRent.toLocaleString("fr-FR")} €\n`
  }
  if (result.calendar?.effectiveDate?.value) {
    summary += `**Date de prise d'effet:** ${new Date(result.calendar.effectiveDate.value).toLocaleDateString("fr-FR")}\n`
  }
  if (result.calendar?.duration?.value) {
    summary += `**Durée:** ${safeNumber(result.calendar.duration.value)} ans\n\n`
  }

  summary += `📅 **Date d'extraction:** ${new Date(result.extractionDate).toLocaleString("fr-FR")}`

  return summary
}

function safeNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const parsed = parseFloat(value.replace(/[^\d.-]/g, ""))
    return isNaN(parsed) ? null : parsed
  }
  if (typeof value === "object" && value !== null && "value" in value) {
    return safeNumber((value as { value: unknown }).value)
  }
  return null
}

function safeString(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value
  if (typeof value === "number") return String(value)
  if (typeof value === "object" && value !== null && "value" in value) {
    return safeString((value as { value: unknown }).value)
  }
  return ""
}
