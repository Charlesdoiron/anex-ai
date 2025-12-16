"use client"

import { useCallback, useState } from "react"
import { Upload, X, FileText, AlertCircle } from "lucide-react"
import { toolType } from "@/app/static-data/agent"

interface UploadFileProps {
  onFileSelect?: (file: File) => void
  onFileRemove?: () => void
  onAction?: () => void
  actionLabel?: string
  className?: string
  toolType: toolType
  isSubmitting?: boolean
}

// Vercel serverless has 4.5MB body limit
const MAX_FILE_SIZE = 4.5 * 1024 * 1024
const MAX_FILE_SIZE_MB = 4.5
const ACCEPTED_FILE_TYPE = "application/pdf"

export default function UploadFile({
  toolType,
  onFileSelect,
  onFileRemove,
  onAction,
  actionLabel = "Valider",
  className = "",
  isSubmitting = false,
}: UploadFileProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validateFile = useCallback((file: File): string | null => {
    if (file.type !== ACCEPTED_FILE_TYPE) {
      return "Seul les fichiers PDF sont acceptés"
    }
    if (file.size > MAX_FILE_SIZE) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1)
      return `Fichier trop volumineux (${fileSizeMB} Mo). Max: ${MAX_FILE_SIZE_MB} Mo`
    }
    return null
  }, [])

  const handleFile = useCallback(
    (file: File) => {
      setError(null)
      const validationError = validateFile(file)

      if (validationError) {
        setError(validationError)
        return
      }

      setSelectedFile(file)
      onFileSelect?.(file)
    },
    [validateFile, onFileSelect]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(false)

      const files = e.dataTransfer.files
      if (files.length > 0) {
        handleFile(files[0])
      }
    },
    [handleFile]
  )

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (files && files.length > 0) {
        handleFile(files[0])
      }
    },
    [handleFile]
  )

  const handleRemove = useCallback(() => {
    setSelectedFile(null)
    setError(null)
    onFileRemove?.()
  }, [onFileRemove])

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className={className}>
      {!selectedFile ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`
            group relative rounded-lg border p-6 sm:p-10 transition-all duration-500 ease-out touch-manipulation
            ${
              isDragging
                ? "border-brand-green bg-brand-green/[0.03] shadow-[inset_0_0_0_1px_rgba(3,58,23,0.15)]"
                : "border-gray-200 bg-white hover:border-brand-green/30 hover:bg-brand-cream/20"
            }
            ${error ? "border-red-300 bg-red-50/50" : ""}
          `}
        >
          <input
            type="file"
            id="file-upload"
            className="sr-only"
            accept=".pdf,application/pdf"
            onChange={handleFileInput}
          />

          <label
            htmlFor="file-upload"
            className="relative flex flex-col items-center justify-center cursor-pointer"
          >
            <div
              className={`
              w-10 h-10 rounded-lg flex items-center justify-center mb-4 transition-all duration-500 ease-out
              ${
                isDragging
                  ? "bg-brand-green text-white"
                  : "bg-brand-green/10 text-brand-green group-hover:bg-brand-green group-hover:text-white"
              }
              ${error ? "bg-red-100 text-red-500" : ""}
            `}
            >
              {error ? (
                <AlertCircle className="w-5 h-5" />
              ) : (
                <Upload
                  className={`w-5 h-5 transition-transform duration-500 ease-out ${isDragging ? "translate-y-[-2px]" : ""}`}
                />
              )}
            </div>

            <div className="text-center space-y-2.5">
              <p
                className={`text-sm font-medium transition-colors duration-300 ${isDragging ? "text-brand-green" : "text-gray-700 group-hover:text-brand-green"}`}
              >
                {isDragging ? "Déposez le fichier" : "Glissez votre PDF ici"}
              </p>
              <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                <span className="w-6 h-px bg-gray-200" />
                <span>ou</span>
                <span className="w-6 h-px bg-gray-200" />
              </div>
              <span
                className={`
                inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-300
                ${isDragging ? "bg-brand-green text-white" : "bg-brand-green text-white hover:bg-brand-green/90"}
              `}
              >
                Parcourir
              </span>
            </div>

            <p className="text-[11px] text-gray-400 mt-4">
              PDF · {MAX_FILE_SIZE_MB} Mo max
            </p>
          </label>

          {error && (
            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-red-600">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="group rounded-lg border border-gray-200 bg-white p-4 transition-all duration-300 hover:border-brand-green/20 hover:bg-gray-50">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-9 h-9 bg-brand-green/10 rounded-md flex items-center justify-center text-brand-green">
                <FileText className="w-4 h-4" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>

              <button
                onClick={handleRemove}
                className="flex-shrink-0 w-7 h-7 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors duration-200 flex items-center justify-center"
                aria-label="Supprimer le fichier"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <button
            onClick={onAction}
            disabled={!onAction || isSubmitting}
            className={`
              w-full rounded-md px-4 py-2.5 text-sm font-medium transition-all duration-300
              flex items-center justify-center gap-2
              ${
                onAction && !isSubmitting
                  ? "bg-brand-green text-white hover:bg-brand-green/90 cursor-pointer"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }
            `}
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
                Envoi en cours...
              </>
            ) : (
              actionLabel
            )}
          </button>
        </div>
      )}
    </div>
  )
}
