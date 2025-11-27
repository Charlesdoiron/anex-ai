"use client"

import { FileText, X } from "lucide-react"

interface PdfUploadIndicatorProps {
  fileName: string
  onRemove: () => void
}

export function PdfUploadIndicator({
  fileName,
  onRemove,
}: PdfUploadIndicatorProps) {
  return (
    <div className="mb-3 flex items-center gap-3 px-3 py-2.5 bg-brand-green/[0.06] border border-brand-green/10 rounded-xl">
      <div className="w-8 h-8 bg-brand-green/10 rounded-lg flex items-center justify-center flex-shrink-0">
        <FileText className="w-4 h-4 text-brand-green" />
      </div>
      <span className="flex-1 text-sm text-gray-700 truncate font-medium">
        {fileName}
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors duration-200"
        aria-label="Remove PDF"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
