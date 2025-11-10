"use client";

interface TopBarProps {
  onToggleSidebar: () => void;
  onClearChat: () => void;
  onExtractData: () => void;
  hasMessages: boolean;
  isExtractingData: boolean;
  isLoading: boolean;
  isProcessingPdf: boolean;
}

export function TopBar({
  onToggleSidebar,
  onClearChat,
  onExtractData,
  hasMessages,
  isExtractingData,
  isLoading,
  isProcessingPdf,
}: TopBarProps) {
  return (
    <div className="border-b border-gray-300 dark:border-gray-700 bg-[#fef9f4] dark:bg-[#343541] px-4 py-3 flex items-center justify-between">
      <button
        onClick={onToggleSidebar}
        className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>
    </div>
  );
}
