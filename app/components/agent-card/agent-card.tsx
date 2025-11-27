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
      className="group block bg-white rounded-lg p-5 sm:p-6 border border-gray-200 transition-all duration-300 hover:border-brand-green/30 hover:bg-brand-cream/20"
    >
      <div className="flex items-start gap-4">
        {icon && (
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-brand-green/[0.07] flex items-center justify-center text-brand-green transition-all duration-300 group-hover:bg-brand-green group-hover:text-white">
            {icon}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[15px] font-semibold text-gray-900 mb-1 group-hover:text-brand-green transition-colors duration-300">
                {title}
              </h2>
              <div
                className="text-sm text-gray-500 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: description }}
              />
            </div>

            <div className="hidden sm:flex flex-shrink-0 w-8 h-8 rounded-md bg-gray-50 items-center justify-center text-gray-400 transition-all duration-300 group-hover:bg-brand-green group-hover:text-white">
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 sm:hidden">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-brand-green">
          Lancer l&apos;agent
          <ArrowRight className="w-4 h-4" />
        </span>
      </div>
    </Link>
  )
}
