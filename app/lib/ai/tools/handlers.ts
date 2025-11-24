import { searchService } from "@/app/lib/rag/services/search-service"
import { SourceInfo } from "@/app/lib/rag/types"

export interface ToolCallOutput {
  type: "function_call_output"
  call_id: string
  output: string
}

export interface ToolCallResult {
  outputItem: ToolCallOutput
  sources?: SourceInfo[]
}

export interface ToolHandlerContext {
  documentId?: string
  emitStatus?: (status: string, data?: Record<string, unknown>) => void
}

type ToolHandler = (
  toolCall: any,
  context: ToolHandlerContext
) => Promise<ToolCallResult>

const handlers: Record<string, ToolHandler> = {
  retrieve_chunks: handleRetrieveChunks,
}

export async function handleToolCallWithRegistry(
  toolCall: any,
  context: ToolHandlerContext
): Promise<ToolCallResult> {
  const handler = handlers[toolCall.name]

  if (!handler) {
    return {
      outputItem: {
        type: "function_call_output",
        call_id: toolCall.call_id,
        output: "Outil inconnu.",
      },
    }
  }

  return handler(toolCall, context)
}

async function handleRetrieveChunks(
  toolCall: any,
  context: ToolHandlerContext
): Promise<ToolCallResult> {
  const { documentId, emitStatus } = context

  if (!documentId) {
    emitStatus?.("error", {
      message: "Impossible d'accéder au document pour exécuter l'outil RAG.",
    })
    return {
      outputItem: {
        type: "function_call_output",
        call_id: toolCall.call_id,
        output:
          "Impossible d'accéder au document pour exécuter la recherche RAG.",
      },
    }
  }

  try {
    const args = JSON.parse(toolCall.arguments || "{}")
    const query = typeof args.query === "string" ? args.query.trim() : ""

    if (!query) {
      return {
        outputItem: {
          type: "function_call_output",
          call_id: toolCall.call_id,
          output:
            "La requête RAG est vide. Reformule la question de l'utilisateur pour lancer une recherche.",
        },
      }
    }

    emitStatus?.("rag_searching", { query })

    const results = await searchService.search(query, {
      documentId,
      limit: 5,
      minScore: 0.3,
    })

    emitStatus?.("rag_results", {
      found: results.length,
      pages: results.map((r) => r.pageNumber).filter(Boolean),
      scores: results.map((r) => r.score?.toFixed(2)).filter(Boolean),
    })

    if (!results.length) {
      return {
        outputItem: {
          type: "function_call_output",
          call_id: toolCall.call_id,
          output:
            "Aucun passage pertinent trouvé dans le bail pour cette requête.",
        },
      }
    }

    const formatted = results
      .map((result, idx) => {
        const pageTag =
          typeof result.pageNumber === "number"
            ? `Page ${result.pageNumber}`
            : "Page inconnue"
        const score = result.score?.toFixed(2) ?? "?"
        return `Passage ${idx + 1} (${pageTag}, pertinence ${score}):\n${
          result.text
        }`
      })
      .join("\n\n---\n\n")

    const sources: SourceInfo[] = results.map((r) => ({
      pageNumber: r.pageNumber,
      score: r.score,
      text: r.text,
      summary: r.metadata?.summary,
      metadata: r.metadata,
    }))

    return {
      outputItem: {
        type: "function_call_output",
        call_id: toolCall.call_id,
        output: formatted,
      },
      sources,
    }
  } catch (error) {
    console.error("RAG tool execution failed:", error)
    emitStatus?.("rag_results", {
      error: error instanceof Error ? error.message : "inconnue",
    })
    return {
      outputItem: {
        type: "function_call_output",
        call_id: toolCall.call_id,
        output: `Erreur lors de la recherche RAG: ${
          error instanceof Error ? error.message : "inconnue"
        }`,
      },
    }
  }
}
