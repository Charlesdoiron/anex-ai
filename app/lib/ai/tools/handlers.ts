import { computeLeaseRentSchedule } from "@/app/lib/lease/rent-schedule-calculator"
import { ComputeLeaseRentScheduleInput } from "@/app/lib/lease/types"
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
  compute_lease_rent_schedule: handleComputeLeaseRentSchedule,
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

async function handleComputeLeaseRentSchedule(
  toolCall: any
): Promise<ToolCallResult> {
  try {
    const args = JSON.parse(toolCall.arguments || "{}")
    const input = mapComputeLeaseArgs(args)
    const result = computeLeaseRentSchedule(input)

    return {
      outputItem: {
        type: "function_call_output",
        call_id: toolCall.call_id,
        output: JSON.stringify(result),
      },
    }
  } catch (error) {
    return {
      outputItem: {
        type: "function_call_output",
        call_id: toolCall.call_id,
        output: `Erreur calcul loyers: ${
          error instanceof Error ? error.message : "inconnue"
        }`,
      },
    }
  }
}

function mapComputeLeaseArgs(raw: unknown): ComputeLeaseRentScheduleInput {
  if (!raw || typeof raw !== "object") {
    throw new Error("Paramètres manquants pour le calcul des loyers.")
  }

  const args = raw as Record<string, unknown>

  const start_date = args.start_date
  const end_date = args.end_date
  const payment_frequency = args.payment_frequency
  const base_index_value = args.base_index_value
  const known_index_points = args.known_index_points
  const charges_growth_rate = args.charges_growth_rate
  const office_rent_ht = args.office_rent_ht
  const parking_rent_ht = args.parking_rent_ht
  const charges_ht = args.charges_ht
  const taxes_ht = args.taxes_ht
  const other_costs_ht = args.other_costs_ht
  const deposit_months = args.deposit_months
  const franchise_months = args.franchise_months
  const incentive_amount = args.incentive_amount
  const horizon_years = args.horizon_years

  if (typeof start_date !== "string" || typeof end_date !== "string") {
    throw new Error("start_date et end_date doivent être des chaînes ISO.")
  }

  if (payment_frequency !== "monthly" && payment_frequency !== "quarterly") {
    throw new Error("payment_frequency doit valoir 'monthly' ou 'quarterly'.")
  }

  if (typeof base_index_value !== "number") {
    throw new Error("base_index_value est requis et doit être numérique.")
  }

  if (typeof office_rent_ht !== "number") {
    throw new Error("office_rent_ht est requis et doit être numérique.")
  }

  const mappedKnownPoints = Array.isArray(known_index_points)
    ? known_index_points
        .filter(
          (point: unknown) =>
            point !== null &&
            typeof point === "object" &&
            typeof (point as Record<string, unknown>).effective_date ===
              "string" &&
            typeof (point as Record<string, unknown>).index_value === "number"
        )
        .map((point: unknown) => {
          const p = point as Record<string, unknown>
          return {
            effectiveDate: p.effective_date as string,
            indexValue: p.index_value as number,
          }
        })
    : undefined

  const toNumberOrUndefined = (val: unknown): number | undefined =>
    typeof val === "number" ? val : undefined

  return {
    startDate: start_date,
    endDate: end_date,
    paymentFrequency: payment_frequency,
    baseIndexValue: base_index_value,
    knownIndexPoints: mappedKnownPoints,
    chargesGrowthRate: toNumberOrUndefined(charges_growth_rate),
    officeRentHT: office_rent_ht,
    parkingRentHT: toNumberOrUndefined(parking_rent_ht),
    chargesHT: toNumberOrUndefined(charges_ht),
    taxesHT: toNumberOrUndefined(taxes_ht),
    otherCostsHT: toNumberOrUndefined(other_costs_ht),
    depositMonths: toNumberOrUndefined(deposit_months),
    franchiseMonths: toNumberOrUndefined(franchise_months),
    incentiveAmount: toNumberOrUndefined(incentive_amount),
    horizonYears: toNumberOrUndefined(horizon_years),
  }
}
