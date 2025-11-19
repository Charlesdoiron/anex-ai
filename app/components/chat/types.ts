import { SourceInfo } from "@/app/lib/rag/types"

export interface MessageWithSources {
  id: string
  role: "user" | "assistant"
  content: string
  sources?: SourceInfo[]
}
