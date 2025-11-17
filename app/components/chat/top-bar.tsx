"use client"

import { UserMenu } from "../user-menu"
import { Menu } from "lucide-react"

interface TopBarProps {
  onToggleSidebar: () => void
  onClearChat: () => void
  onExtractData: () => void
  hasMessages: boolean
  isExtractingData: boolean
  isLoading: boolean
  isProcessingPdf: boolean
}

export function TopBar({ onToggleSidebar }: TopBarProps) {
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
      </div>
      <div className="flex items-center gap-3">
        <UserMenu />
      </div>
    </div>
  )
}
