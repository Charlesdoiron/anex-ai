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
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-brand-green/10 text-brand-green px-4 py-2 rounded-full text-sm font-medium mb-6">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
              </svg>
              Agent AI spécialisé
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-brand-green mb-6 tracking-tight">
              Agent {agentSlug}
            </h1>
            <p className="text-lg sm:text-xl text-gray-700 leading-relaxed">
              Selectionner l&apos;outil de votre agent {agentSlug}:
              <ul className="list-disc list-inside mt-4">
                <li>Extraction de données des baux commerciaux</li>
                <li>Calcul de loyer via le barème de l&apos;indice INSEE</li>
              </ul>
            </p>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="space-y-6">
          {currentAgent?.tools.map((tool) => (
            <AgentCard
              key={tool.slug}
              title={tool.name}
              description={tool.description}
              href={tool.path ?? ""}
            />
          ))}

          {/* Placeholder for future agents */}
          <div className="bg-brand-cream/30 backdrop-blur rounded-2xl p-8 border-2 border-dashed border-brand-green/20 text-center">
            <div className="flex flex-col items-center gap-3 text-brand-green/50">
              <svg
                className="w-12 h-12"
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
              <p className="text-sm font-medium">
                Plus d&apos;outils à venir...
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
