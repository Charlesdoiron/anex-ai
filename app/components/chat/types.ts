import { SourceInfo } from "@/app/lib/rag/types"

export interface MessageWithSources {
  id: string
  role: "user" | "assistant"
  content: string
  sources?: SourceInfo[]
}

export interface StreamStatusEvent {
  type: "status"
  id: string
  status: string
  timestamp: string
  query?: string
  pages?: number[]
  scores?: string[]
  found?: number
  error?: string
}

export function isStreamStatusEvent(
  value: unknown
): value is StreamStatusEvent {
  if (!value || typeof value !== "object") {
    return false
  }

  const candidate = value as Record<string, unknown>
  return (
    candidate.type === "status" &&
    typeof candidate.id === "string" &&
    typeof candidate.status === "string" &&
    typeof candidate.timestamp === "string"
  )
}
