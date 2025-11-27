import { AGENTS } from "@/app/static-data/agent"
import AgentCard from "../agent-card/agent-card"

export default function AgentList() {
  return (
    <div className="min-h-screen w-full">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-brand-cream via-white to-brand-cream/50">
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.03] z-0" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-28">
          <div className="text-center max-w-3xl mx-auto animate-in fade-in slide-in-from-top-2">
            <div className="inline-flex items-center gap-2 bg-brand-green/10 backdrop-blur-sm text-brand-green px-4 py-2 rounded-full text-xs font-medium mb-6 border border-brand-green/20">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
              </svg>
              Agents IA spécialisés
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-brand-green mb-4 sm:mb-6 tracking-tight px-2 text-balance">
              Vos assistants intelligents
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-gray-700 leading-relaxed px-2 text-balance">
              Automatisez vos tâches complexes avec nos agents IA spécialisés.
              Extraction de données, calculs avancés, et bien plus encore.
            </p>
          </div>
        </div>
      </div>

      {/* Agents Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 md:py-16 lg:py-20">
        <div className="space-y-3 sm:space-y-4">
          {AGENTS.map((agent, index) => (
            <div
              key={agent.slug}
              className="animate-in fade-in slide-in-from-top-2"
              style={{
                animationDelay: `${index * 50}ms`,
                animationFillMode: "both",
              }}
            >
              <AgentCard
                title={agent.name}
                description={agent.description}
                href={agent.path ?? ""}
                agentSlug={agent.slug}
              />
            </div>
          ))}

          {/* Placeholder for future agents */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-xl p-8 border border-dashed border-gray-300 text-center animate-in fade-in slide-in-from-top-2 opacity-60">
            <div className="flex flex-col items-center gap-3 text-gray-400">
              <div className="w-10 h-10 rounded-lg bg-gray-200/50 flex items-center justify-center">
                <svg
                  className="w-5 h-5"
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
              </div>
              <p className="text-sm font-medium text-gray-600">
                Plus d&apos;agents à venir...
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
