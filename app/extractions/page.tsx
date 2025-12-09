import { redirect } from "next/navigation"
import Link from "next/link"
import { extractionStorage } from "@/app/lib/extraction/storage-service"

interface ExtractionSummary {
  id: string
  documentId: string
  fileName: string
  pageCount: number | null
  createdAt: string
}

async function loadExtractions(): Promise<ExtractionSummary[]> {
  const ids = await extractionStorage.listExtractions()

  const extractions: ExtractionSummary[] = []

  for (const id of ids) {
    const extraction = await extractionStorage.getExtraction(id)
    if (!extraction) continue

    extractions.push({
      id: extraction.documentId,
      documentId: extraction.documentId,
      fileName: extraction.fileName || "Document",
      pageCount: extraction.pageCount ?? null,
      createdAt: extraction.extractionDate,
    })
  }

  return extractions.sort((a, b) => {
    const aTime = new Date(a.createdAt).getTime()
    const bTime = new Date(b.createdAt).getTime()
    return bTime - aTime
  })
}

export default async function ExtractionsPage() {
  if (process.env.NEXT_PUBLIC_APP_MODE !== "test") {
    redirect("/")
  }

  const extractions = await loadExtractions()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Document Extractions
              </h1>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                View and analyze extracted lease data
              </p>
            </div>
            <Link
              href="/"
              prefetch={true}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
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
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Back to Chat
            </Link>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-blue-600 dark:text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Test Mode - This page is only visible when{" "}
                <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900/40 rounded">
                  NEXT_PUBLIC_APP_MODE=test
                </code>
              </p>
            </div>
          </div>
        </div>

        {extractions.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
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
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
              No extractions found
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Upload a document to see extraction results here
            </p>
            <Link
              href="/"
              prefetch={true}
              className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Upload Document
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {extractions.map((extraction) => (
              <Link
                key={extraction.id}
                href={`/extractions/${extraction.documentId}`}
                prefetch={true}
                className="block group"
              >
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <svg
                        className="w-6 h-6 text-blue-600 dark:text-blue-400"
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
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {extraction.fileName}
                      </h3>
                      <div className="mt-2 space-y-1">
                        {extraction.pageCount && (
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {extraction.pageCount} page
                            {extraction.pageCount !== 1 ? "s" : ""}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          {new Date(extraction.createdAt).toLocaleString(
                            "fr-FR",
                            {
                              dateStyle: "medium",
                              timeStyle: "short",
                            }
                          )}
                        </p>
                      </div>
                    </div>
                    <svg
                      className="w-5 h-5 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
