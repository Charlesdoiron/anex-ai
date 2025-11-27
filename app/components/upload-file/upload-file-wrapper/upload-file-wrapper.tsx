"use client"

import { toolType } from "@/app/static-data/agent"
import UploadFile from "../upload-file/upload-file"
import DownloadResultButton from "../download-result-button/download-result-button"
import RentCalculationResultButton from "../download-result-button/rent-calculation-result-button"
import ProcessingLoader from "../processing-loader/processing-loader"
import ErrorDisplay from "../error-display/error-display"
import { useState, useEffect, useRef } from "react"
import { useExtraction } from "../hooks/use-extraction/use-extraction"

interface UploadFileWrapperProps {
  label?: string
  toolType: toolType
  onExtractionComplete?: () => void
}

export default function UploadFileWrapper({
  label,
  toolType,
  onExtractionComplete,
}: UploadFileWrapperProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const {
    isProcessing,
    processingStatus,
    extractionResult,
    error,
    progress,
    handleExtraction,
    reset,
  } = useExtraction({ toolType })

  const hasNotifiedRef = useRef(false)

  // Check for result completion - handles both lease extraction and rent calculation
  const hasValidResult =
    extractionResult?.documentId &&
    (extractionResult?.extractionMetadata || // Lease extraction
      (extractionResult as unknown as Record<string, unknown>)?.metadata) // Rent calculation

  useEffect(() => {
    if (hasValidResult && !hasNotifiedRef.current) {
      hasNotifiedRef.current = true
      onExtractionComplete?.()
    }
  }, [hasValidResult, onExtractionComplete])

  useEffect(() => {
    if (!extractionResult) {
      hasNotifiedRef.current = false
    }
  }, [extractionResult])

  function handleFileSelect(file: File) {
    setSelectedFile(file)
  }

  function handleFileRemove() {
    setSelectedFile(null)
  }

  async function handleExtractionClick() {
    if (!selectedFile) return
    await handleExtraction(selectedFile)
  }

  function handleReset() {
    setSelectedFile(null)
    reset()
  }

  // Only show download button if we have a complete extraction result
  if (hasValidResult && extractionResult) {
    if (toolType === "calculation-rent") {
      return (
        <RentCalculationResultButton
          result={extractionResult as unknown as Record<string, unknown>}
          onReset={handleReset}
          label={label}
        />
      )
    }
    return (
      <DownloadResultButton
        extraction={extractionResult}
        onReset={handleReset}
        label={label}
      />
    )
  }

  // Show only loader during processing
  if (isProcessing) {
    return <ProcessingLoader status={processingStatus} progress={progress} />
  }

  // Show error if any
  if (error) {
    return (
      <ErrorDisplay
        error={error}
        selectedFile={selectedFile}
        onFileSelect={handleFileSelect}
        onFileRemove={handleFileRemove}
        onAction={selectedFile ? handleExtractionClick : undefined}
        label={label}
        toolType={toolType}
      />
    )
  }

  // Show upload component when not processing
  return (
    <UploadFile
      onFileSelect={handleFileSelect}
      onFileRemove={handleFileRemove}
      onAction={selectedFile ? handleExtractionClick : undefined}
      actionLabel={label}
      toolType={toolType}
    />
  )
}
