import AgentCard from "@/app/components/agent-card/agent-card"
import { AGENTS } from "@/app/static-data/agent"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/app/components/ui/breadcrumb"
import Link from "next/link"
import RecentActivity from "@/app/components/recent-activity/recent-activity"

export default async function AgentPage({
  params,
}: {
  params: Promise<{ agentSlug: string }>
}) {
  const { agentSlug } = await params

  const currentAgent = AGENTS.find((agent) => agent.slug === agentSlug)

  return (
    <div>
      <div className="relative overflow-hidden bg-gradient-to-br from-brand-cream via-white to-brand-cream/50">
        <div className="absolute inset-0 bg-grid-pattern opacity-5 pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 z-10">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link
                    href="/"
                    className="transition-colors hover:text-gray-900"
                  >
                    Accueil
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>
                  {currentAgent?.name ?? agentSlug}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-brand-green/10 text-brand-green px-3 py-1.5 rounded-md text-xs font-medium mb-6">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
              </svg>
              Agent AI spécialisé
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-brand-green mb-4 sm:mb-6 tracking-tight px-2">
              {currentAgent?.name ?? `Agent ${agentSlug}`}
            </h1>
            <p className="text-lg text-gray-600 leading-relaxed max-w-xl mx-auto">
              Sélectionnez un outil pour commencer l&apos;analyse de vos
              documents
            </p>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Tools section */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Outils disponibles
            </h2>
            {currentAgent?.tools.map((tool) => (
              <AgentCard
                key={tool.slug}
                title={tool.name}
                description={tool.description}
                href={tool.path ?? ""}
                toolType={tool.type}
              />
            ))}

            {/* Placeholder for future agents */}
            <div className="bg-gray-50 rounded-lg p-6 border border-dashed border-gray-300 text-center">
              <div className="flex flex-col items-center gap-2 text-gray-400">
                <svg
                  className="w-8 h-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <p className="text-sm">Plus d&apos;outils à venir...</p>
              </div>
            </div>
          </div>

          {/* Recent activity sidebar */}
          <div className="lg:col-span-1">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Historique
            </h2>
            <RecentActivity agentSlug={agentSlug} maxItems={5} />
          </div>
        </div>
      </div>
    </div>
  )
}
