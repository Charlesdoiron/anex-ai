import Link from "next/link"
import { ArrowRight, FileSearch, Calculator, FileText } from "lucide-react"
import { toolType } from "@/app/static-data/agent"

interface AgentCardProps {
  title: string
  description: string
  href: string
  toolType?: toolType
  agentSlug?: string
}

const TOOL_ICONS: Record<toolType, React.ReactNode> = {
  "extraction-lease": (
    <FileSearch className="w-[18px] h-[18px]" strokeWidth={1.5} />
  ),
  "calculation-rent": (
    <Calculator className="w-[18px] h-[18px]" strokeWidth={1.5} />
  ),
}

const AGENT_ICONS: Record<string, React.ReactNode> = {
  bail: <FileText className="w-[18px] h-[18px]" strokeWidth={1.5} />,
}

export default function AgentCard({
  title,
  description,
  href,
  toolType,
  agentSlug,
}: AgentCardProps) {
  const icon = toolType
    ? TOOL_ICONS[toolType]
    : agentSlug
      ? AGENT_ICONS[agentSlug]
      : null

  return (
    <Link
      href={href}
      className="group block bg-white rounded-xl p-5 sm:p-6 border border-gray-200/80 shadow-sm hover:shadow-md transition-all duration-300 hover:border-brand-green/40 hover:bg-brand-cream/30 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/50 focus-visible:ring-offset-2 focus-visible:border-brand-green"
    >
      <div className="flex items-start gap-4">
        {icon && (
          <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-brand-green/[0.08] flex items-center justify-center text-brand-green transition-all duration-300 group-hover:bg-brand-green group-hover:text-white group-hover:scale-110 group-hover:rotate-3">
            {icon}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-gray-900 mb-1.5 group-hover:text-brand-green transition-colors duration-300">
                {title}
              </h2>
              <div
                className="text-sm text-gray-600 leading-relaxed line-clamp-2"
                dangerouslySetInnerHTML={{ __html: description }}
              />
            </div>

            <div className="hidden sm:flex flex-shrink-0 w-9 h-9 rounded-lg bg-brand-green/10 items-center justify-center text-brand-green transition-all duration-300 group-hover:bg-brand-green group-hover:text-white group-hover:translate-x-1">
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 sm:hidden pt-3 border-t border-gray-100">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-brand-green group-hover:gap-3 transition-all duration-300">
          Lancer l&apos;agent
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
        </span>
      </div>
    </Link>
  )
}
