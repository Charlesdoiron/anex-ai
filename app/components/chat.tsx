"use client"

import { useChat } from "@ai-sdk/react"
import {
  useEffect,
  useMemo,
  useState,
  useCallback,
  lazy,
  Suspense,
} from "react"
import { Sidebar } from "./chat/sidebar"
import { TopBar } from "./chat/top-bar"
import { MessagesArea } from "./chat/messages-area"
import { InputArea } from "./chat/input-area"
import {
  MessageWithSources,
  StreamStatusEvent,
  isStreamStatusEvent,
} from "./chat/types"
import { usePdfHandler } from "./chat/hooks/use-pdf-handler"
import { useDataExtraction } from "./chat/hooks/use-data-extraction"
import { ProcessingStatus } from "./chat/processing-status"
import { exportAllToPDF } from "./chat/utils/export-utils"
import { RagStatusFeed } from "./chat/rag-status-feed"
import type { LeaseExtractionResult } from "@/app/lib/extraction/types"
import { exportExtractionToExcel } from "./extraction/utils/excel-export"

const ExtractionModal = lazy(() =>
  import("./extraction/extraction-modal").then((mod) => ({
    default: mod.ExtractionModal,
  }))
)

export function Chat() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarKey, setSidebarKey] = useState(0)
  const [activeDocument, setActiveDocument] = useState<{
    id: string
    fileName: string
  } | null>(null)
  const [showExtractionPanel, setShowExtractionPanel] = useState(false)
  const [extraction, setExtraction] = useState<LeaseExtractionResult | null>(
    null
  )
  const [isLoadingExtraction, setIsLoadingExtraction] = useState(false)
  const [extractionError, setExtractionError] = useState<string | null>(null)

  const {
    messages,
    input,
    handleInputChange,
    isLoading,
    setMessages,
    stop,
    append,
    setInput,
    data: streamData,
    setData,
  } = useChat({
    api: "/api/chat",
    body: activeDocument
      ? {
          data: {
            documentId: activeDocument.id,
            fileName: activeDocument.fileName,
          },
        }
      : undefined,
  })

  const {
    uploadedPdf,
    isProcessingPdf,
    processingStatus,
    fileInputRef,
    handleFileSelect,
    removePdf,
    handleDevModeExtraction, // DEV MODE
  } = usePdfHandler({
    setMessages: setMessages as (
      messages:
        | MessageWithSources[]
        | ((messages: MessageWithSources[]) => MessageWithSources[])
    ) => void,
    onExtractionComplete: () => setSidebarKey((prev) => prev + 1),
    onDocumentReady: (result) => {
      setActiveDocument({
        id: result.documentId,
        fileName: result.fileName,
      })
      setExtraction(result as LeaseExtractionResult)
    },
    onPartialResult: (partialResult) => {
      if (partialResult.documentId && !extraction) {
        setActiveDocument({
          id: partialResult.documentId,
          fileName: partialResult.fileName || "Document",
        })
        setExtraction(partialResult as LeaseExtractionResult)
      } else if (
        extraction &&
        partialResult.documentId === extraction.documentId
      ) {
        setExtraction({
          ...extraction,
          ...partialResult,
        } as LeaseExtractionResult)
      }
    },
  })

  const { isExtractingData, extractionStatus, handleExtractData } =
    useDataExtraction({
      messages: messages as MessageWithSources[],
      setMessages: setMessages as (
        messages:
          | MessageWithSources[]
          | ((messages: MessageWithSources[]) => MessageWithSources[])
      ) => void,
    })

  useEffect(() => {
    setShowExtractionPanel(false)
    setExtraction(null)
  }, [activeDocument?.id])

  const loadExtraction = useCallback(async (documentId: string) => {
    try {
      setIsLoadingExtraction(true)
      setExtractionError(null)
      const response = await fetch(`/api/extractions/${documentId}`)
      if (!response.ok) {
        throw new Error("Failed to load extraction")
      }
      const data = await response.json()
      setExtraction(data.data ?? null)
    } catch (error) {
      setExtractionError(
        error instanceof Error ? error.message : "Unexpected error"
      )
    } finally {
      setIsLoadingExtraction(false)
    }
  }, [])

  const handleExtractionClick = useCallback(
    async (extraction: { id: string; fileName: string }) => {
      setSidebarOpen(false)
      setActiveDocument({
        id: extraction.id,
        fileName: extraction.fileName,
      })
      await loadExtraction(extraction.id)
      setMessages([
        {
          id: Date.now().toString(),
          role: "user",
          content: `📄 Document chargé: ${extraction.fileName}`,
        },
      ])
    },
    [loadExtraction, setMessages]
  )

  const handleToggleExtractionPanel = useCallback(() => {
    if (!activeDocument) {
      return
    }
    setShowExtractionPanel((current) => {
      const next = !current
      if (next && (!extraction || !extraction.extractionMetadata)) {
        void loadExtraction(activeDocument.id)
      }
      return next
    })
  }, [activeDocument, extraction, loadExtraction])

  const handleFormSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()

      if (!input.trim()) {
        return
      }

      setData([])

      await append(
        {
          role: "user",
          content: input,
        },
        activeDocument
          ? {
              data: {
                documentId: activeDocument.id,
                fileName: activeDocument.fileName,
              },
            }
          : undefined
      )
      setInput("")
    },
    [input, activeDocument, setData, append, setInput]
  )

  const handleClearChat = useCallback(() => {
    setMessages([])
    setActiveDocument(null)
    setData(undefined)
  }, [setMessages, setData])

  const handleExportPDF = useCallback(async () => {
    await exportAllToPDF(messages as MessageWithSources[])
  }, [messages])

  const handleExportExcel = useCallback(() => {
    if (!extraction) return
    exportExtractionToExcel(extraction)
  }, [extraction])

  const hasAssistantMessages = messages.some(
    (m) => m.role === "assistant" && m.content.trim()
  )

  const showChatExportButtons =
    hasAssistantMessages &&
    !isLoading &&
    !isExtractingData &&
    !isProcessingPdf &&
    messages.length > 0

  const canExportExtraction =
    !!extraction?.extractionMetadata && !isLoading && !isProcessingPdf

  const statusEvents = useMemo(() => {
    if (!Array.isArray(streamData)) {
      return []
    }
    return (streamData as unknown[]).filter(
      isStreamStatusEvent
    ) as StreamStatusEvent[]
  }, [streamData])

  return (
    <div className="flex h-screen-safe bg-white dark:bg-[#343541] overflow-hidden">
      <ProcessingStatus status={processingStatus || extractionStatus} />

      {/* Mobile backdrop */}
      <div
        className={`sidebar-backdrop md:hidden ${sidebarOpen ? "visible" : ""}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      <Sidebar
        key={sidebarKey}
        isOpen={sidebarOpen}
        onNewChat={handleClearChat}
        onExtractionClick={handleExtractionClick}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onClearChat={handleClearChat}
          onExtractData={handleExtractData}
          hasMessages={messages.length > 0}
          isExtractingData={isExtractingData}
          isLoading={isLoading}
          isProcessingPdf={isProcessingPdf}
          activeDocument={activeDocument}
          onToggleExtractionPanel={
            activeDocument ? handleToggleExtractionPanel : undefined
          }
          showExtractionPanel={showExtractionPanel}
        />

        {activeDocument && showExtractionPanel && (
          <Suspense fallback={null}>
            <ExtractionModal
              open={true}
              onClose={() => setShowExtractionPanel(false)}
              extraction={extraction}
              isLoading={isLoadingExtraction}
              error={extractionError}
            />
          </Suspense>
        )}

        <RagStatusFeed events={statusEvents} isStreaming={isLoading} />

        {(canExportExtraction || showChatExportButtons) && (
          <div className="border-b border-gray-200 dark:border-gray-700 bg-[#fef9f4] dark:bg-[#343541]">
            <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-3">
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                {canExportExtraction && (
                  <button
                    onClick={handleExportExcel}
                    className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors touch-manipulation"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <span className="hidden sm:inline">
                      Exporter Excel (données)
                    </span>
                    <span className="sm:hidden">Excel</span>
                  </button>
                )}
                {showChatExportButtons && (
                  <button
                    onClick={handleExportPDF}
                    className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md transition-colors touch-manipulation"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                      />
                    </svg>
                    <span className="hidden sm:inline">
                      Export PDF (conversation)
                    </span>
                    <span className="sm:hidden">PDF</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <MessagesArea
          messages={messages as MessageWithSources[]}
          isLoading={isLoading}
          isProcessing={!!(processingStatus || extractionStatus)}
        />

        <InputArea
          input={input}
          onInputChange={handleInputChange}
          onSubmit={handleFormSubmit}
          onStop={stop}
          onFileSelect={handleFileSelect}
          uploadedPdf={uploadedPdf}
          onRemovePdf={removePdf}
          isLoading={isLoading}
          isProcessingPdf={isProcessingPdf}
          fileInputRef={fileInputRef}
          onDevModeExtract={
            process.env.NEXT_PUBLIC_USE_DEV_MODE === "true"
              ? handleDevModeExtraction
              : undefined
          }
        />
      </div>
    </div>
  )
}
