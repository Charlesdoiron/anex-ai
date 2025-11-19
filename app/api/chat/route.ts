import { NextRequest } from "next/server"
import OpenAI from "openai"
import { auth } from "@/app/lib/auth"
import { searchService } from "@/app/lib/rag/services/search-service"
import { RAG_CONFIG } from "@/app/lib/rag/config"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const GENERAL_SYSTEM_PROMPT =
  "Tu es Anex AI, assistant juridique spécialisé dans l'analyse de baux commerciaux. Tu aides les professionnels de l'immobilier en France à comprendre et analyser leurs contrats de bail. Tu réponds uniquement en français et tu cites toujours tes sources avec précision."

const EXTRACTION_SYSTEM_PROMPT =
  "Tu es Anex AI, assistant d'extraction. Transforme les derniers messages en synthèse structurée (sections numérotées, tableaux ou listes). Rappelle les points manquants et reste factuel."

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return new Response(
      JSON.stringify({ error: "OPENAI_API_KEY is not configured." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }

  await auth.api.getSession({ headers: req.headers }).catch(() => null)

  const body = await req.json()
  const { messages, extractData, data } = body
  const documentId: string | undefined = data?.documentId
  const documentName: string | undefined = data?.fileName

  if (!Array.isArray(messages)) {
    return new Response(
      JSON.stringify({ error: "messages must be an array." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    )
  }

  const normalizedMessages = messages.map((msg: any) => {
    // Vercel AI SDK shape: { role, parts: [{ text }] }
    if (Array.isArray(msg.parts)) {
      const partsText = msg.parts
        .map((part: any) => {
          if (typeof part === "string") {
            return part
          }
          if (part?.text) {
            return part.text
          }
          if (part?.content) {
            return part.content
          }
          return ""
        })
        .join(" ")
      return {
        role: msg.role,
        content: partsText,
      }
    }

    if (typeof msg.content === "string") {
      return msg
    }

    if (Array.isArray(msg.content)) {
      const textParts = msg.content
        .map((part: any) => {
          if (typeof part === "string") {
            return part
          }
          if (part?.text) {
            return part.text
          }
          if (part?.content) {
            return part.content
          }
          return ""
        })
        .join(" ")
      return { role: msg.role, content: textParts }
    }

    return { role: msg.role, content: String(msg.content ?? "") }
  })

  const lastUserMessage = [...normalizedMessages]
    .reverse()
    .find((msg) => msg.role === "user")
  const userQuestion =
    typeof lastUserMessage?.content === "string" ? lastUserMessage.content : ""

  const shouldUseRag = Boolean(documentId && userQuestion.trim())
  const modelName = shouldUseRag ? RAG_CONFIG.responsesModel : "gpt-4o-mini"
  const isGpt5 = modelName.startsWith("gpt-5")

  const instructions = shouldUseRag
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

  const tools = shouldUseRag
    ? [
        {
          type: "function" as const,
          name: "retrieve_chunks",
          description:
            "Recherche des passages pertinents dans le bail commercial téléversé par l'utilisateur. À utiliser OBLIGATOIREMENT avant de répondre à toute question sur le document.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description:
                  "Requête de recherche en français, décrivant précisément l'information recherchée dans le bail (ex: 'loyer mensuel', 'durée du bail', 'conditions de résiliation')",
              },
            },
            required: ["query"],
            additionalProperties: false,
          },
          strict: true,
        },
      ]
    : undefined

  try {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          await handleConversation({
            conversationItems: normalizedMessages.map((msg) => ({
              role: msg.role,
              content: msg.content,
            })),
            instructions,
            tools,
            modelName,
            isGpt5,
            extractData,
            documentId,
            controller,
            encoder,
          })
          controller.close()
        } catch (error) {
          console.error("Stream error:", error)
          controller.error(error)
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch (error) {
    console.error("Chat route error:", error)
    return new Response(
      JSON.stringify({
        error: "Failed to generate chat response",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}

type ConversationItem =
  | {
      role: "user" | "assistant" | "system"
      content: string
    }
  | {
      type: "function_call_output"
      call_id: string
      output: string
    }
  | {
      type: string
      [key: string]: any
    }

interface HandleConversationArgs {
  conversationItems: ConversationItem[]
  instructions: string
  tools: any[] | undefined
  modelName: string
  isGpt5: boolean
  extractData: boolean
  documentId: string | undefined
  controller: ReadableStreamDefaultController
  encoder: TextEncoder
}

async function handleConversation({
  conversationItems,
  instructions,
  tools,
  modelName,
  isGpt5,
  extractData,
  documentId,
  controller,
  encoder,
}: HandleConversationArgs) {
  if (isGpt5) {
    while (true) {
      const { toolCalls, outputItems } = await streamResponses({
        conversationItems,
        instructions,
        tools,
        modelName,
        controller,
        encoder,
      })

      if (outputItems.length > 0) {
        conversationItems.push(...outputItems)
      }

      if (!toolCalls.length) {
        break
      }

      if (!documentId) {
        controller.enqueue(
          encoder.encode(
            `0:${JSON.stringify(
              "Impossible d'accéder au document pour exécuter l'outil RAG."
            )}\n`
          )
        )
        break
      }

      for (const toolCall of toolCalls) {
        const toolOutput = await handleToolCall(toolCall, documentId)
        conversationItems.push(toolOutput)
      }
    }
  } else {
    const baseMessages = conversationItems
      .filter(
        (
          item
        ): item is { role: "user" | "assistant" | "system"; content: string } =>
          "role" in item && typeof item.content === "string"
      )
      .map((item) => ({ role: item.role, content: item.content }))

    const stream = await openai.chat.completions.create({
      model: modelName,
      messages: [{ role: "system", content: instructions }, ...baseMessages],
      temperature: extractData ? 0.1 : 0.3,
      stream: true,
    })

    for await (const event of stream) {
      if (event.choices[0]?.delta?.content) {
        controller.enqueue(
          encoder.encode(
            `0:${JSON.stringify(event.choices[0].delta.content)}\n`
          )
        )
      }
    }
  }
}

async function streamResponses({
  conversationItems,
  instructions,
  tools,
  modelName,
  controller,
  encoder,
}: {
  conversationItems: ConversationItem[]
  instructions: string
  tools?: any[]
  modelName: string
  controller: ReadableStreamDefaultController
  encoder: TextEncoder
}): Promise<{ toolCalls: any[]; outputItems: any[] }> {
  const requestConfig: any = {
    model: modelName,
    input: conversationItems,
    instructions,
    stream: true,
  }

  if (tools) {
    requestConfig.tools = tools
    requestConfig.tool_choice = "auto"
  }

  const stream = await openai.responses.create(requestConfig)

  const outputItems: any[] = []
  const toolCalls: any[] = []
  const partialItems = new Map<number, any>()

  for await (const event of stream as any) {
    switch (event.type) {
      case "response.output_item.added":
        partialItems.set(event.output_index, event.item)
        break
      case "response.function_call_arguments.delta": {
        const item = partialItems.get(event.output_index)
        if (item) {
          item.arguments = (item.arguments || "") + event.delta
        }
        break
      }
      case "response.output_text.delta":
        controller.enqueue(encoder.encode(`0:${JSON.stringify(event.delta)}\n`))
        break
      case "response.output_item.done": {
        const finalItem = event.item
        outputItems.push(finalItem)
        if (finalItem.type === "function_call") {
          toolCalls.push(finalItem)
        }
        partialItems.delete(event.output_index)
        break
      }
      default:
        break
    }
  }

  return { toolCalls, outputItems }
}

async function handleToolCall(
  toolCall: any,
  documentId: string
): Promise<ConversationItem> {
  if (toolCall.name !== "retrieve_chunks") {
    return {
      type: "function_call_output",
      call_id: toolCall.call_id,
      output: "Outil inconnu.",
    }
  }

  try {
    const args = JSON.parse(toolCall.arguments || "{}")
    const query = typeof args.query === "string" ? args.query.trim() : ""

    if (!query) {
      return {
        type: "function_call_output",
        call_id: toolCall.call_id,
        output:
          "La requête RAG est vide. Reformule la question de l'utilisateur pour lancer une recherche.",
      }
    }

    const results = await searchService.search(query, {
      documentId,
      limit: 5,
      minScore: 0.3,
    })

    if (!results.length) {
      return {
        type: "function_call_output",
        call_id: toolCall.call_id,
        output:
          "Aucun passage pertinent trouvé dans le bail pour cette requête.",
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

    return {
      type: "function_call_output",
      call_id: toolCall.call_id,
      output: formatted,
    }
  } catch (error) {
    console.error("RAG tool execution failed:", error)
    return {
      type: "function_call_output",
      call_id: toolCall.call_id,
      output: `Erreur lors de la recherche RAG: ${
        error instanceof Error ? error.message : "inconnue"
      }`,
    }
  }
}
