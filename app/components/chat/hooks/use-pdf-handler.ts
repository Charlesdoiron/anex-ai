"use client"

import { useState, useRef } from "react"
import { MessageWithSources } from "../types"
import { SourceInfo } from "@/app/lib/llama-cloud-service/extract-text-from-nodes"

interface UsePdfHandlerProps {
  setMessages: (
    messages:
      | MessageWithSources[]
      | ((messages: MessageWithSources[]) => MessageWithSources[])
  ) => void
  onExtractionComplete?: () => void
}

export function usePdfHandler({
  setMessages,
  onExtractionComplete,
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
    try {
      // Create a dummy FormData (backend will ignore it in dev mode)
      const formData = new FormData()
      const dummyFile = new Blob(["dev"], { type: "application/pdf" })
      formData.append("file", dummyFile, "dev-mode.pdf")

      // const userMessage: MessageWithSources = {
      //   id: Date.now().toString(),
      //   role: "user",
      //   content: "🚀 Dev Mode: Using pre-parsed file from LlamaCloud",
      // }

      // // Add user message immediately
      // setMessages((prev) => [...prev, userMessage])

      // // Add processing indicator
      // setMessages((prev) => [
      //   ...prev,
      //   {
      //     id: `processing-${Date.now()}`,
      //     role: "assistant",
      //     content: "⏳ Querying pre-parsed document...",
      //   },
      // ])

      setProcessingStatus("🔍 Interrogation du document pré-analysé...")
      const response = await fetch("/api/extract-pdf", {
        method: "POST",
        body: formData,
      })

      setProcessingStatus("📊 Analyse des résultats...")

      // Remove processing indicator
      setMessages((prev) =>
        prev.filter((msg) => !msg.id.startsWith("processing-"))
      )

      const assistantMessages: MessageWithSources[] = []

      if (response.ok) {
        const result = await response.json()
        console.log("📄 PDF extraction result:", result)

        if (
          result.results &&
          Array.isArray(result.results) &&
          result.results.length > 0
        ) {
          result.results.forEach((queryResult: any, index: number) => {
            const content = `**Q: ${queryResult.query}**\n${
              queryResult.answer || "Aucune réponse trouvée."
            }`

            let answerSources: SourceInfo[] = []
            if (
              queryResult.sources &&
              Array.isArray(queryResult.sources) &&
              queryResult.sources.length > 0
            ) {
              const uniqueSources = queryResult.sources.filter(
                (source: any, idx: number, self: any[]) =>
                  idx ===
                  self.findIndex(
                    (s: any) =>
                      s.pageNumber === source.pageNumber &&
                      s.fileName === source.fileName
                  )
              )

              answerSources = uniqueSources.map((source: any) => ({
                pageNumber: source.pageNumber,
                fileName: source.fileName,
                score: source.score,
                startCharIdx: source.startCharIdx,
                endCharIdx: source.endCharIdx,
                metadata: source.metadata,
              }))
            }

            assistantMessages.push({
              id: `result-${Date.now()}-${index}`,
              role: "assistant",
              content,
              sources: answerSources.length > 0 ? answerSources : undefined,
            })
          })
        }
      } else {
        const errorMsg = await response.text()
        assistantMessages.push({
          id: `error-${Date.now()}`,
          role: "assistant",
          content: `❌ **Error**: ${errorMsg}`,
        })
      }

      setMessages((prev) => [...prev, ...assistantMessages])

      // Notify parent component that extraction is complete
      if (onExtractionComplete) {
        onExtractionComplete()
      }
    } catch (error) {
      console.error("Dev mode extraction error:", error)
      setMessages((prev) => [
        ...prev,
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
    setProcessingStatus("📤 Téléversement du PDF...")
    try {
      const formData = new FormData()
      formData.append("file", file)

      const userMessage: MessageWithSources = {
        id: Date.now().toString(),
        role: "user",
        content: `Uploaded PDF: ${file.name}`,
      }

      // Add user message immediately
      setMessages((prev) => [...prev, userMessage])

      // Add processing indicator
      setMessages((prev) => [
        ...prev,
        {
          id: `processing-${Date.now()}`,
          role: "assistant",
          content: "⏳ Processing PDF...",
        },
      ])

      setProcessingStatus("🔄 Analyse du document en cours...")
      const response = await fetch("/api/extract-pdf", {
        method: "POST",
        body: formData,
      })

      setProcessingStatus("📊 Extraction des informations...")

      // Remove processing indicator
      setMessages((prev) =>
        prev.filter((msg) => !msg.id.startsWith("processing-"))
      )

      const assistantMessages: MessageWithSources[] = []

      if (response.ok) {
        const result = await response.json()
        console.log("📄 PDF extraction result:", result)

        if (
          result.results &&
          Array.isArray(result.results) &&
          result.results.length > 0
        ) {
          result.results.forEach((queryResult: any, index: number) => {
            const content = `**Q: ${queryResult.query}**\n${
              queryResult.answer || "Aucune réponse trouvée."
            }`

            let answerSources: SourceInfo[] = []
            if (
              queryResult.sources &&
              Array.isArray(queryResult.sources) &&
              queryResult.sources.length > 0
            ) {
              const uniqueSources = queryResult.sources.filter(
                (source: any, idx: number, self: any[]) =>
                  idx ===
                  self.findIndex(
                    (s: any) =>
                      s.pageNumber === source.pageNumber &&
                      s.fileName === source.fileName
                  )
              )

              answerSources = uniqueSources.map((source: any) => ({
                pageNumber: source.pageNumber,
                fileName: source.fileName,
                score: source.score,
                startCharIdx: source.startCharIdx,
                endCharIdx: source.endCharIdx,
                metadata: source.metadata,
              }))
            }

            assistantMessages.push({
              id: `result-${Date.now()}-${index}`,
              role: "assistant",
              content,
              sources: answerSources.length > 0 ? answerSources : undefined,
            })
          })
        }
      } else {
        const errorMsg = await response.text()
        assistantMessages.push({
          id: `error-${Date.now()}`,
          role: "assistant",
          content: `❌ **Error**: ${errorMsg}`,
        })
      }

      setMessages((prev) => [...prev, ...assistantMessages])

      // Notify parent component that extraction is complete
      if (response.ok && onExtractionComplete) {
        onExtractionComplete()
      }

      setUploadedPdf(null)
    } catch (error) {
      console.error("PDF upload error:", error)
      setMessages((prev) => [
        ...prev,
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
