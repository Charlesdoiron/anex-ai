"use client"

import ReactMarkdown from "react-markdown"
import remarkBreaks from "remark-breaks"
import { MessageWithSources } from "./types"

interface MessageItemProps {
  message: MessageWithSources
}

export function MessageItem({ message }: MessageItemProps) {
  return (
    <div
      className={`group ${
        message.role === "user"
          ? "bg-white dark:bg-[#343541]"
          : "bg-white dark:bg-[#343541]"
      }`}
    >
      <div className="flex gap-4 p-4">
        <div className="flex-shrink-0 w-8 h-8 rounded-sm flex items-center justify-center  dark:bg-[#19c37d] text-white text-xs font-semibold">
          {message.role === "user" ? (
            <svg className="w-5 h-5" fill="#033a17" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="#033a17" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0 pt-1">
          <div className="text-gray-800 dark:text-gray-100 break-words leading-relaxed">
            <ReactMarkdown
              remarkPlugins={[remarkBreaks]}
              components={{
                p: ({ children }) => (
                  <p className="mb-2 last:mb-0">{children}</p>
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold">{children}</strong>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
          {message.sources && message.sources.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {message.sources.map((source, idx) => {
                const sourceLabel = [
                  source.pageNumber !== undefined &&
                    `Page ${source.pageNumber}`,
                ]
                  .filter(Boolean)
                  .join(" - ")

                if (!sourceLabel) return null

                return (
                  <button
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md transition-colors"
                    title={
                      source.score !== null && source.score !== undefined
                        ? `Score: ${source.score.toFixed(2)}`
                        : undefined
                    }
                  >
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    {sourceLabel}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
