import { getStatusLabel } from "@/app/lib/status-labels"
import { StreamStatusEvent } from "./types"

interface RagStatusFeedProps {
  events: StreamStatusEvent[]
  isStreaming: boolean
}

export function RagStatusFeed({ events, isStreaming }: RagStatusFeedProps) {
  if (!events.length) {
    return null
  }

  const visibleEvents = events.slice(-4)

  return (
    <div className="border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-[#2f303b]/80 backdrop-blur py-3">
      <div className="max-w-7xl mx-auto px-4 flex flex-col gap-3">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 font-medium text-gray-900 dark:text-gray-100">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isStreaming
                  ? "bg-emerald-500 animate-pulse"
                  : "bg-gray-400 dark:bg-gray-600"
              }`}
              aria-hidden="true"
            />
            Recherche dans le bail
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {isStreaming ? "Analyse en cours" : "Analyse terminée"}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {visibleEvents.map((event) => (
            <StatusChip key={event.id} event={event} />
          ))}
        </div>
      </div>
    </div>
  )
}

function StatusChip({ event }: { event: StreamStatusEvent }) {
  const { label, description } = getEventCopy(event)
  return (
    <div className="flex items-start gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1f2028] px-3 py-2 shadow-sm max-w-sm">
      <span className="text-[10px] uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400">
        {label}
      </span>
      <p className="text-sm text-gray-900 dark:text-gray-100 leading-snug">
        {description}
      </p>
    </div>
  )
}

function formatPages(pages?: number[]) {
  if (!pages || !pages.length) {
    return null
  }
  return pages
    .slice(0, 5)
    .map((page) => `p.${page}`)
    .join(", ")
}

function getEventCopy(event: StreamStatusEvent): {
  label: string
  description: string
} {
  switch (event.status) {
    case "rag_searching": {
      const baseLabel = getStatusLabel("rag_searching")
      return {
        label: baseLabel.label,
        description: event.query
          ? `« ${event.query.slice(0, 60)}${event.query.length > 60 ? "..." : ""} »`
          : baseLabel.description,
      }
    }
    case "rag_results": {
      const pages = formatPages(event.pages)
      const stats: string[] = []
      if (typeof event.found === "number") {
        stats.push(
          `${event.found} passage${event.found > 1 ? "s" : ""} trouvé${event.found > 1 ? "s" : ""}`
        )
      }
      if (pages) {
        stats.push(pages)
      }
      return {
        label: getStatusLabel("rag_results").label,
        description: stats.length ? stats.join(" • ") : "Résultats reçus",
      }
    }
    case "error":
      return {
        label: getStatusLabel("error").label,
        description: event.error || getStatusLabel("error").description,
      }
    default: {
      const fallback = getStatusLabel(event.status)
      return {
        label: fallback.label,
        description: fallback.description,
      }
    }
  }
}
