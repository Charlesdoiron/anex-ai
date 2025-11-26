import Link from "next/link"

interface AgentCardProps {
  title: string
  description: string
  href: string
  icon?: React.ReactNode
}

export default function AgentCard({
  title,
  description,
  href,
  icon,
}: AgentCardProps) {
  return (
    <div className="group relative bg-white rounded-2xl p-8 border border-brand-green/10 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
      {/* Gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-cream/80 to-brand-green/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="relative md:flex md:items-center md:justify-between">
        <div className="flex-1">
          <div className="flex items-start gap-4">
            {icon && (
              <div className="flex-shrink-0 w-14 h-14 bg-brand-green rounded-xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform duration-300">
                {icon}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-brand-green transition-colors">
                {title}
              </h2>
              <div
                className="text-base text-gray-600 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: description }}
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex md:mt-0 md:ml-8 md:flex-shrink-0">
          <Link
            href={href}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-green/80 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:shadow-xl hover:bg-brand-green hover:text-white transition-all duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green group-hover:scale-105"
          >
            <span>Lancer l&apos;agent</span>
            <svg
              className="w-5 h-5 group-hover:translate-x-1 transition-transform"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  )
}
