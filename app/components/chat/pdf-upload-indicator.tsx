"use client";

interface PdfUploadIndicatorProps {
  fileName: string;
  onRemove: () => void;
}

export function PdfUploadIndicator({
  fileName,
  onRemove,
}: PdfUploadIndicatorProps) {
  return (
    <div className="mb-2 flex items-center gap-2 px-3 py-2 bg-[#033a17] dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
      <svg
        className="w-4 h-4 text-white dark:text-blue-400 flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
        />
      </svg>
      <span className="flex-1 text-sm text-white dark:text-blue-300 truncate">
        {fileName}
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="p-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 rounded transition-colors"
        aria-label="Remove PDF"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}

