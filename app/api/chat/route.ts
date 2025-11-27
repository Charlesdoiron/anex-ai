import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import OpenAI from "openai"
import { auth } from "@/app/lib/auth"
import { getTools, ToolName } from "@/app/lib/ai/tools/definitions"
import { handleToolCallWithRegistry } from "@/app/lib/ai/tools/handlers"
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
  const modelName = shouldUseRag ? RAG_CONFIG.responsesModel : "gpt-5-mini"

  const toolNames: ToolName[] = ["compute_lease_rent_schedule"]
  if (shouldUseRag) {
    toolNames.push("retrieve_chunks")
  }
  const tools = getTools(toolNames)

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
  extractData: boolean
  documentId: string | undefined
  controller: ReadableStreamDefaultController
  encoder: TextEncoder
}

function enqueueDataEvent(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  payload: Record<string, unknown>
) {
  controller.enqueue(encoder.encode(`2:${JSON.stringify([payload])}\n`))
}

function sendStatusEvent(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  status: string,
  data?: Record<string, unknown>
) {
  enqueueDataEvent(controller, encoder, {
    type: "status",
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    status,
    ...(data ?? {}),
  })
}

async function handleConversation({
  conversationItems,
  instructions,
  tools,
  modelName,
  extractData,
  documentId,
  controller,
  encoder,
}: HandleConversationArgs) {
  while (true) {
    const { toolCalls, outputItems } = await streamResponses({
      conversationItems,
      instructions,
      tools,
      modelName,
      controller,
      encoder,
      extractData,
    })

    if (outputItems.length > 0) {
      conversationItems.push(...outputItems)
    }

    if (!toolCalls.length) {
      break
    }

    for (const toolCall of toolCalls) {
      const { outputItem } = await handleToolCallWithRegistry(toolCall, {
        documentId,
        emitStatus: (status, data) =>
          sendStatusEvent(controller, encoder, status, data),
      })
      conversationItems.push(outputItem)
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
  extractData,
}: {
  conversationItems: ConversationItem[]
  instructions: string
  tools?: any[]
  modelName: string
  controller: ReadableStreamDefaultController
  encoder: TextEncoder
  extractData: boolean
}): Promise<{ toolCalls: any[]; outputItems: any[] }> {
  // les models comme gpt-5-mini nesupportent pas le parm temperature
  const supportsTemperature =
    !modelName.startsWith("gpt-5") &&
    !modelName.startsWith("o1") &&
    !modelName.startsWith("o3") &&
    !modelName.startsWith("o4")

  const requestConfig: any = {
    model: modelName,
    input: conversationItems,
    instructions,
    stream: true,
    ...(supportsTemperature && { temperature: extractData ? 0.1 : 0.3 }),
  }

  if (tools?.length) {
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
