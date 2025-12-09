import { PageLoader } from "@/app/components/ui/page-loader"

export default function AgentPageLoading() {
  return (
    <div>
      <div className="relative overflow-hidden bg-gradient-to-br from-brand-cream via-white to-brand-cream/50">
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.03] pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
          <PageLoader message="Chargement de l'agent..." fullScreen={false} />
        </div>
      </div>
    </div>
  )
}
