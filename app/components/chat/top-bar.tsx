"use client"

import { UserMenu } from "../user-menu"
import { Menu, FileText } from "lucide-react"

interface TopBarProps {
  onToggleSidebar: () => void
  onClearChat: () => void
  onExtractData: () => void
  hasMessages: boolean
  isExtractingData: boolean
  isLoading: boolean
  isProcessingPdf: boolean
  activeDocument?: {
    id: string
    fileName: string
  } | null
}

export function TopBar({ onToggleSidebar, activeDocument }: TopBarProps) {
  return (
    <div className="border-b border-gray-300 dark:border-gray-700 bg-[#fef9f4] dark:bg-[#343541] px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          aria-label="Toggle sidebar"
        >
          <Menu size={20} className="text-gray-700 dark:text-gray-300" />
        </button>
        <span className="font-semibold text-gray-900 dark:text-gray-100">
          Anex AI
        </span>
        {activeDocument && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-lg">
            <FileText size={14} className="text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
              Document actif: {activeDocument.fileName}
            </span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <UserMenu />
      </div>
    </div>
  )
}
