import { PageLoader } from "@/app/components/ui/page-loader"

export default function RootLoading() {
  return (
    <div className="min-h-screen w-full">
      <div className="relative overflow-hidden bg-gradient-to-br from-brand-cream via-white to-brand-cream/50">
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.03] z-0" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-28">
          <PageLoader message="Chargement..." fullScreen={false} />
        </div>
      </div>
    </div>
  )
}
