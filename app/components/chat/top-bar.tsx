"use client"

import { UserMenu } from "../user-menu"
import { Menu, FileText, Database } from "lucide-react"
import Link from "next/link"

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
  onToggleExtractionPanel?: () => void
  showExtractionPanel?: boolean
}

export function TopBar({
  onToggleSidebar,
  activeDocument,
  onToggleExtractionPanel,
  showExtractionPanel,
}: TopBarProps) {
  const isTestMode = process.env.NEXT_PUBLIC_APP_MODE === "test"

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
        <Link href="/" className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
            <span className="text-white font-bold text-sm">A</span>
          </div>
          <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm sm:text-base">
            Anex AI
          </span>
        </Link>
        {activeDocument && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-lg max-w-[200px] md:max-w-xs">
            <FileText
              size={14}
              className="text-blue-600 dark:text-blue-400 flex-shrink-0"
            />
            <span className="text-xs font-medium text-blue-700 dark:text-blue-300 truncate">
              {activeDocument.fileName}
            </span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        {isTestMode && activeDocument && onToggleExtractionPanel && (
          <button
            type="button"
            onClick={onToggleExtractionPanel}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg border transition-colors ${
              showExtractionPanel
                ? "border-blue-500 bg-blue-600 text-white hover:bg-blue-700"
                : "text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border-gray-300 dark:border-gray-600"
            }`}
            title="Afficher les données structurées"
          >
            <Database size={16} />
            <span className="hidden sm:inline">
              {showExtractionPanel
                ? "Masquer les données"
                : "Données extraites"}
            </span>
          </button>
        )}
        <UserMenu />
      </div>
    </div>
  )
}
