"use client";

import { useRef, useEffect } from "react";
import { PdfUploadIndicator } from "./pdf-upload-indicator";

interface InputAreaProps {
  input: string;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onStop: () => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploadedPdf: File | null;
  onRemovePdf: () => void;
  isLoading: boolean;
  isProcessingPdf: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export function InputArea({
  input,
  onInputChange,
  onSubmit,
  onStop,
  onFileSelect,
  uploadedPdf,
  onRemovePdf,
  isLoading,
  isProcessingPdf,
  fileInputRef,
}: InputAreaProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(
        inputRef.current.scrollHeight,
        200
      )}px`;
    }
  }, [input]);

  return (
    <div className="border-t border-gray-300 dark:border-gray-700 bg-[#fef9f4] dark:bg-[#343541]">
      <div className="max-w-3xl mx-auto px-4 py-4">
        {uploadedPdf && (
          <PdfUploadIndicator
            fileName={uploadedPdf.name}
            onRemove={onRemovePdf}
          />
        )}
        <form
          onSubmit={onSubmit}
          className="relative flex items-end gap-2 bg-white dark:bg-[#40414f] rounded-2xl border border-gray-300 dark:border-gray-700 shadow-lg dark:shadow-xl"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={onFileSelect}
            className="hidden"
            id="pdf-upload"
            disabled={isLoading || isProcessingPdf}
          />

          <div className="mb-2 ml-2 flex gap-1 items-center">
            <label
              htmlFor="pdf-upload"
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Upload PDF"
              title="Upload PDF"
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
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </label>
          </div>
          <textarea
            ref={inputRef}
            value={input}
            onChange={onInputChange}
            placeholder="Uploader votre bail en PDF..."
            disabled={isLoading || isProcessingPdf}
            rows={1}
            className="flex-1 px-4 py-3 bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 resize-none focus:outline-none disabled:opacity-50 overflow-hidden max-h-[200px]"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (input.trim() && !isLoading && !isProcessingPdf) {
                  onSubmit(e as any);
                }
              }
            }}
          />
          {isLoading || isProcessingPdf ? (
            <button
              type="button"
              onClick={onStop}
              className="mb-2 mr-2 p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Stop generation"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="mb-2 mr-2 p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Send message"
              title="Send message (or press Enter)"
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
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            </button>
          )}
        </form>
        <div className="mt-3 text-xs text-gray-500 dark:text-gray-400 text-center">
          Anexa AI can make mistakes. Check important info.
        </div>
      </div>
    </div>
  );
}
