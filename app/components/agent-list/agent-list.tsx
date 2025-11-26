import AgentCard from "../agent-card/agent-card"

export default function AgentList() {
  return (
    <div className="min-h-screen w-full">
      {/* Header with Logo */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-green rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">A</span>
              </div>
              <span className="text-2xl font-bold text-brand-green">Axena</span>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-brand-cream via-white to-brand-cream/50">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-brand-green/10 text-brand-green px-4 py-2 rounded-full text-sm font-medium mb-6">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
              </svg>
              Agents IA spécialisés
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-brand-green mb-6 tracking-tight">
              Vos assistants intelligents
            </h1>
            <p className="text-lg sm:text-xl text-gray-700 leading-relaxed">
              Automatisez vos tâches complexes avec nos agents IA spécialisés.
              Extraction de données, calculs avancés, et bien plus encore.
            </p>
          </div>
        </div>
      </div>

      {/* Agents Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="space-y-6">
          <AgentCard
            title="Agent Bail"
            description="Agent spécialisé dans l'extraction de données des baux commerciaux.<br/>Il possède deux modes de fonctionnement : <strong>l'extraction de données</strong> et <strong>le calcul de loyer via l'indice INSEE</strong>."
            href="/agents/bail"
            icon={
              <svg
                className="w-7 h-7"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            }
          />

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
                Plus d&apos;agents à venir...
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
