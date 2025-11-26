"use client"

import { toolType } from "@/app/static-data/agent"
import UploadFile from "../upload-file/upload-file"
import DownloadResultButton from "../download-result-button/download-result-button"
import ProcessingLoader from "../processing-loader/processing-loader"
import ErrorDisplay from "../error-display/error-display"
import { useState } from "react"
import { useExtraction } from "../hooks/use-extraction/use-extraction"

export default function UploadFileWrapper({
  label,
  toolType,
}: {
  label?: string
  toolType: toolType
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const {
    isProcessing,
    processingStatus,
    extractionResult,
    error,
    progress,
    handleExtraction,
    reset,
  } = useExtraction()

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
