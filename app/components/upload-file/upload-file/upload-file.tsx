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
}

const MAX_FILE_SIZE = 30 * 1024 * 1024 // 30MB in bytes
const ACCEPTED_FILE_TYPE = "application/pdf"

export default function UploadFile({
  toolType,
  onFileSelect,
  onFileRemove,
  onAction,
  actionLabel = "Valider",
  className = "",
}: UploadFileProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validateFile = useCallback((file: File): string | null => {
    if (file.type !== ACCEPTED_FILE_TYPE) {
      return "Seul les fichiers PDF sont acceptés"
    }
    if (file.size > MAX_FILE_SIZE) {
      return "Le fichier ne doit pas dépasser 30 Mo"
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
            group relative bg-white rounded-2xl border-2 border-dashed p-8 sm:p-12 transition-all duration-300
            shadow-sm hover:shadow-xl hover:-translate-y-1
            ${
              isDragging
                ? "border-brand-green bg-brand-green/5 scale-[1.01] shadow-xl"
                : "border-brand-green/10 hover:border-brand-green/30"
            }
            ${error ? "border-red-400/50 bg-red-50/30" : ""}
          `}
        >
          {/* Gradient overlay on hover */}
          <div
            className={`
            absolute inset-0 bg-gradient-to-br from-brand-cream/80 to-brand-green/5 rounded-2xl transition-opacity duration-300
            ${isDragging ? "opacity-100" : "opacity-0 group-hover:opacity-100"}
          `}
          />

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
              w-16 h-16 sm:w-20 sm:h-20 rounded-xl flex items-center justify-center mb-6 transition-all duration-300 shadow-lg
              ${
                isDragging
                  ? "bg-brand-green text-white scale-110"
                  : "bg-brand-green/10 text-brand-green group-hover:scale-110 group-hover:bg-brand-green group-hover:text-white"
              }
              ${error ? "bg-red-100 text-red-600" : ""}
            `}
            >
              {error ? (
                <AlertCircle className="w-8 h-8 sm:w-10 sm:h-10" />
              ) : (
                <Upload className="w-8 h-8 sm:w-10 sm:h-10" />
              )}
            </div>

            <div className="text-center">
              <p className="text-lg sm:text-xl font-bold text-gray-900 mb-2 group-hover:text-brand-green transition-colors">
                {isDragging
                  ? "Déposez votre fichier ici"
                  : "Glissez-déposez votre fichier PDF"}
              </p>
              <p className="text-sm sm:text-base text-gray-600 mb-4">ou</p>
              <span className="inline-flex items-center gap-2 rounded-xl bg-brand-green/80 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:shadow-xl hover:bg-brand-green transition-all duration-300 group-hover:scale-105">
                Parcourir les fichiers
              </span>
            </div>

            <p className="text-xs sm:text-sm text-gray-500 mt-6">
              PDF uniquement • Max 30 Mo
            </p>
          </label>

          {error && (
            <div className="relative mt-6 flex items-center gap-3 text-sm text-red-700 bg-red-50/80 backdrop-blur rounded-xl px-5 py-4 border border-red-200/50 shadow-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col">
          <div className="group relative bg-white rounded-2xl border border-brand-green/10 p-6 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            {/* Gradient overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-brand-cream/80 to-brand-green/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            <div className="relative flex items-center gap-4">
              <div className="flex-shrink-0 w-14 h-14 bg-brand-green rounded-xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform duration-300">
                <FileText className="w-7 h-7" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-base font-bold text-gray-900 truncate group-hover:text-brand-green transition-colors">
                  {selectedFile.name}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>

              <button
                onClick={handleRemove}
                className="relative flex-shrink-0 w-10 h-10 rounded-xl hover:bg-red-50 text-gray-500 hover:text-red-600 transition-all duration-300 flex items-center justify-center hover:scale-110"
                aria-label="Supprimer le fichier"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <button
            onClick={onAction}
            disabled={!onAction}
            className={`
              relative w-fit min-w-[200px] ml-auto rounded-xl px-6 py-3 text-sm font-semibold shadow-lg transition-all duration-300 mt-4
              ${
                onAction
                  ? "bg-brand-green text-white hover:shadow-xl hover:bg-brand-green/90 hover:scale-[1.02] cursor-pointer"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed opacity-60"
              }
            `}
          >
            {actionLabel}
          </button>
        </div>
      )}
    </div>
  )
}
