"use client"

import { useChat } from "@ai-sdk/react"
import { useMemo, useState } from "react"
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
import { exportAllToPDF, exportAllToCSV } from "./chat/utils/export-utils"
import { RagStatusFeed } from "./chat/rag-status-feed"

export function Chat() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarKey, setSidebarKey] = useState(0)
  const [activeDocument, setActiveDocument] = useState<{
    id: string
    fileName: string
  } | null>(null)

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

  async function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
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
  }

  function handleClearChat() {
    setMessages([])
    setActiveDocument(null)
    setData(undefined)
  }

  const handleExportPDF = async () => {
    await exportAllToPDF(messages as MessageWithSources[])
  }

  const handleExportCSV = async () => {
    await exportAllToCSV(messages as MessageWithSources[])
  }

  const hasAssistantMessages = messages.some(
    (m) => m.role === "assistant" && m.content.trim()
  )

  const showExportButtons =
    hasAssistantMessages &&
    !isLoading &&
    !isExtractingData &&
    !isProcessingPdf &&
    messages.length > 0

  const statusEvents = useMemo(() => {
    if (!Array.isArray(streamData)) {
      return []
    }
    return (streamData as unknown[]).filter(
      isStreamStatusEvent
    ) as StreamStatusEvent[]
  }, [streamData])

  return (
    <div className="flex h-screen bg-white dark:bg-[#343541]">
      <ProcessingStatus status={processingStatus || extractionStatus} />

      <Sidebar
        key={sidebarKey}
        isOpen={sidebarOpen}
        onNewChat={handleClearChat}
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
        />

        <RagStatusFeed events={statusEvents} isStreaming={isLoading} />

        {showExportButtons && (
          <div className="border-b border-gray-200 dark:border-gray-700 bg-[#fef9f4] dark:bg-[#343541]">
            <div className="max-w-7xl mx-auto px-4 py-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleExportPDF}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md transition-colors"
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
                  Export PDF
                </button>
                <button
                  onClick={handleExportCSV}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md transition-colors"
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
                  Export CSV
                </button>
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
