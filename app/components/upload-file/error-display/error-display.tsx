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
        onFileSelect={onFileSelect}
        onFileRemove={onFileRemove}
        onAction={selectedFile ? onAction : undefined}
        actionLabel={label}
        toolType={toolType}
      />
    </div>
  )
}
