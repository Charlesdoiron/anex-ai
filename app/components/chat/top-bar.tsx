"use client";

import { UserMenu } from "../user-menu";

interface TopBarProps {
  onToggleSidebar: () => void;
  onClearChat: () => void;
  onExtractData: () => void;
  hasMessages: boolean;
  isExtractingData: boolean;
  isLoading: boolean;
  isProcessingPdf: boolean;
}

export function TopBar({}: TopBarProps) {
  return (
    <div className="border-b border-gray-300 dark:border-gray-700 bg-[#fef9f4] dark:bg-[#343541] px-4 py-3 flex items-center justify-between">
      <span>Anex AI</span>
      <UserMenu />
    </div>
  );
}
