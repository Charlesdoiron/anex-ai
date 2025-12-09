import { PageLoader } from "@/app/components/ui/page-loader"

export default function ExtractionsLoading() {
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
          </div>
        </div>
        <PageLoader
          message="Chargement des extractions..."
          fullScreen={false}
        />
      </div>
    </div>
  )
}
