import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import type { LeaseExtractionResult } from "@/app/lib/extraction/types"
import { extractionStorage } from "@/app/lib/extraction/storage-service"
import { ExtractionPanel } from "@/app/components/extraction/extraction-panel"

interface ExtractionDetailPageProps {
  params: Promise<{
    id: string
  }>
}

async function loadExtraction(id: string): Promise<LeaseExtractionResult> {
  const extraction = await extractionStorage.getExtraction(id)
  if (!extraction) {
    notFound()
  }

  return extraction
}

export default async function ExtractionDetailPage({
  params,
}: ExtractionDetailPageProps) {
  if (process.env.NEXT_PUBLIC_APP_MODE !== "test") {
    redirect("/")
  }

  const { id } = await params
  const extraction = await loadExtraction(id)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Extraction Details
              </h1>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {extraction.fileName || "Document"}
              </p>
            </div>
            <Link
              href="/extractions"
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
              Back to Extractions
            </Link>
          </div>
        </div>
        <ExtractionPanel extraction={extraction} />
      </div>
    </div>
  )
}
