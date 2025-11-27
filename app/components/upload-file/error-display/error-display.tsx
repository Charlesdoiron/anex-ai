"use client"

import { AlertCircle } from "lucide-react"
import UploadFile from "../upload-file/upload-file"
import { toolType } from "@/app/static-data/agent"

interface ErrorDisplayProps {
  error: string
  selectedFile: File | null
  onFileSelect: (file: File) => void
  onFileRemove: () => void
  onAction?: () => void
  label?: string
  toolType: toolType
}

export default function ErrorDisplay({
  error,
  selectedFile,
  onFileSelect,
  onFileRemove,
  onAction,
  label,
  toolType,
}: ErrorDisplayProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-red-200 bg-red-50/50 px-4 py-3.5">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-800">
              Erreur lors du traitement
            </p>
            <p className="text-sm text-red-600 mt-1">{error}</p>
          </div>
        </div>
      </div>
      <UploadFile
        onFileSelect={onFileSelect}
        onFileRemove={onFileRemove}
        onAction={selectedFile ? onAction : undefined}
        actionLabel={label}
        toolType={toolType}
      />
    </div>
  )
}
