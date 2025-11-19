import { NextRequest, NextResponse } from "next/server"
import { createOpenAI } from "@ai-sdk/openai"
import { streamText, tool } from "ai"
import type { CoreMessage } from "ai"
import { z } from "zod"
import { auth } from "@/app/lib/auth"
import { searchService } from "@/app/lib/rag/services/search-service"
import { RAG_CONFIG } from "@/app/lib/rag/config"

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const GENERAL_SYSTEM_PROMPT =
  "Tu es Anex AI, assistant juridique spécialisé dans l'analyse de baux commerciaux. Tu aides les professionnels de l'immobilier en France à comprendre et analyser leurs contrats de bail. Tu réponds uniquement en français et tu cites toujours tes sources avec précision."

const EXTRACTION_SYSTEM_PROMPT =
  "Tu es Anex AI, assistant d'extraction. Transforme les derniers messages en synthèse structurée (sections numérotées, tableaux ou listes). Rappelle les points manquants et reste factuel."

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured." },
      { status: 500 }
    )
  }

  await auth.api.getSession({ headers: req.headers }).catch(() => null)

  const body = await req.json()
  const { messages, extractData, data } = body
  const documentId: string | undefined = data?.documentId
  const documentName: string | undefined = data?.fileName

  if (!Array.isArray(messages)) {
    return NextResponse.json(
      { error: "messages must be an array." },
      { status: 400 }
    )
  }

  const lastUserMessage = [...messages]
    .reverse()
    .find((msg) => msg.role === "user")
  const userQuestion =
    typeof lastUserMessage?.content === "string"
      ? lastUserMessage.content
      : Array.isArray(lastUserMessage?.content)
        ? lastUserMessage?.content
            .map((part: any) => part?.text ?? "")
            .join(" ")
        : ""

  const shouldUseRag = Boolean(documentId && userQuestion.trim())

  const systemPrompt = shouldUseRag
    ? [
        GENERAL_SYSTEM_PROMPT,
        `\n\n## Document actif`,
        `L'utilisateur a téléversé un bail commercial${
          documentName ? ` (fichier: "${documentName}")` : ""
        } dans Anex AI.`,
        `Ce document a été indexé avec l'ID: ${documentId}.`,
        `\n\n## Instructions importantes`,
        `1. Base-toi UNIQUEMENT sur le contenu du document récupéré via l'outil "retrieve_chunks".`,
        `2. Cite TOUJOURS les numéros de page des passages utilisés (ex: "D'après la page 3...").`,
        `3. Si l'information n'est pas dans les passages récupérés, dis clairement "Cette information n'est pas présente dans le bail téléversé."`,
        `4. Ne réponds JAMAIS avec des informations génériques ou de tes connaissances générales.`,
        `5. Analyse les passages récupérés et formule une réponse précise et documentée.`,
      ].join("\n")
    : extractData
      ? EXTRACTION_SYSTEM_PROMPT
      : GENERAL_SYSTEM_PROMPT

  const retrieveChunksTool =
    shouldUseRag &&
    tool({
      description:
        "Recherche des passages pertinents dans le bail commercial téléversé par l'utilisateur. À utiliser OBLIGATOIREMENT avant de répondre à toute question sur le document.",
      parameters: z.object({
        query: z
          .string()
          .describe(
            "Requête de recherche en français, décrivant précisément l'information recherchée dans le bail (ex: 'loyer mensuel', 'durée du bail', 'conditions de résiliation')"
          ),
        limit: z
          .number()
          .min(1)
          .max(8)
          .optional()
          .describe("Nombre maximum de passages à retourner (défaut: 5)"),
      }),
      execute: async ({ query, limit = 5 }) => {
        console.log(
          `🔍 RAG search: query="${query}", documentId="${documentId}", limit=${limit}`
        )

        const results = await searchService.search(query, {
          documentId,
          limit,
          minScore: 0.3,
        })

        console.log(`📚 Found ${results.length} relevant chunks`)

        if (results.length === 0) {
          return "Aucun passage pertinent trouvé dans le bail pour cette requête. Le document ne semble pas contenir d'information sur ce sujet."
        }

        const context = results
          .map((result, idx) => {
            const pageTag =
              typeof result.pageNumber === "number"
                ? `[Page ${result.pageNumber}]`
                : "[Page inconnue]"
            const score = result.score?.toFixed(2) || "?"
            return `Passage ${idx + 1} ${pageTag} (pertinence: ${score}):\n${result.text}`
          })
          .join("\n\n---\n\n")

        return `Voici les passages pertinents trouvés dans le bail:\n\n${context}`
      },
    })

  const chatMessages: CoreMessage[] = [
    {
      role: "system",
      content: systemPrompt,
    },
    ...messages,
  ]

  try {
    const response = await streamText({
      model: openai(shouldUseRag ? RAG_CONFIG.responsesModel : "gpt-4o-mini"),
      messages: chatMessages,
      temperature: extractData ? 0.1 : 0.3,
      tools:
        shouldUseRag && retrieveChunksTool
          ? { retrieve_chunks: retrieveChunksTool }
          : undefined,
      toolChoice: shouldUseRag ? "required" : undefined,
      maxSteps: shouldUseRag ? 4 : 1,
    })

    return response.toDataStreamResponse()
  } catch (error) {
    console.error("Chat route error:", error)
    return NextResponse.json(
      {
        error: "Failed to generate chat response",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
