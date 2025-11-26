"use client"

import { toolType } from "@/app/static-data/agent"
import UploadFile from "./upload-file"
import DownloadResultButton from "./download-result-button"
import { useState } from "react"

export default function UploadFileWrapper({
  label,
  toolType,
}: {
  label?: string
  toolType: toolType
}) {
  const [isReady, setIsReady] = useState(false)

  if (isReady) {
    return (
      <DownloadResultButton
        onReset={() => {
          setIsReady(false)
        }}
      />
    )
  }
  return (
    <UploadFile
      onAction={() => {
        setIsReady(true)
      }}
      actionLabel={label}
      toolType={toolType}
    />
  )
}
