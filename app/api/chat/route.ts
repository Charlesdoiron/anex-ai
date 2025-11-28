import { randomUUID } from "crypto"
import type OpenAI from "openai"
import type {
  ResponseCreateParamsStreaming,
  ResponseStreamEvent,
} from "openai/resources/responses/responses"
import { NextRequest } from "next/server"
import { z } from "zod"

import { auth } from "@/app/lib/auth"
import { getTools, type ToolName } from "@/app/lib/ai/tools/definitions"
import {
  handleToolCallWithRegistry,
  type ToolCall,
  type ToolCallOutput,
} from "@/app/lib/ai/tools/handlers"
import { RAG_CONFIG } from "@/app/lib/rag/config"
import {
  getOpenAIClient,
  MissingOpenAIKeyError,
} from "@/app/lib/openai/client"

const GENERAL_SYSTEM_PROMPT =
  "Tu es Anex AI, assistant juridique spécialisé dans l'analyse de baux commerciaux. Tu aides les professionnels de l'immobilier en France à comprendre et analyser leurs contrats de bail. Tu réponds uniquement en français et tu cites toujours tes sources avec précision."

const EXTRACTION_SYSTEM_PROMPT =
  "Tu es Anex AI, assistant d'extraction. Transforme les derniers messages en synthèse structurée (sections numérotées, tableaux ou listes). Rappelle les points manquants et reste factuel."

const MessagePartSchema = z.union([
  z.string(),
  z
    .object({
      text: z.string().optional(),
      content: z.string().optional(),
    })
    .passthrough(),
])

const RawMessageSchema = z
  .object({
    role: z.enum(["user", "assistant", "system"]),
    content: z
      .union([
        z.string(),
        z.array(MessagePartSchema),
        z.record(z.unknown()),
      ])
      .optional(),
    parts: z.array(MessagePartSchema).optional(),
  })
  .passthrough()

const optionalTrimmedString = () =>
  z
    .string()
    .trim()
    .transform((value) => (value.length ? value : undefined))
    .optional()

const ChatRequestSchema = z.object({
  messages: z.array(RawMessageSchema).min(1, "messages must include entries"),
  extractData: z.boolean().optional().default(false),
  data: z
    .object({
      documentId: optionalTrimmedString(),
      fileName: optionalTrimmedString(),
    })
    .optional(),
})

type RawMessage = z.infer<typeof RawMessageSchema>
type MessagePart = z.infer<typeof MessagePartSchema>
type AssistantRole = "user" | "assistant" | "system"

interface NormalizedMessage {
  role: AssistantRole
  content: string
}

type ConversationItem =
  | NormalizedMessage
  | ToolCallOutput
  | Record<string, unknown>

interface HandleConversationArgs {
  openai: OpenAI
  conversationItems: ConversationItem[]
  instructions: string
  tools?: ReturnType<typeof getTools>
  modelName: string
  extractData: boolean
  documentId?: string
  controller: ReadableStreamDefaultController
  encoder: TextEncoder
}

type OutputItem = {
  type?: string
  [key: string]: unknown
}

export async function POST(req: NextRequest) {
  let openai: OpenAI
  try {
    openai = getOpenAIClient()
  } catch (error) {
    if (error instanceof MissingOpenAIKeyError) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY is not configured." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }
    throw error
  }

  await auth.api.getSession({ headers: req.headers }).catch(() => null)

  const parsedBody = ChatRequestSchema.safeParse(await req.json())
  if (!parsedBody.success) {
    return new Response(
      JSON.stringify({
        error: "Invalid request body",
        message: parsedBody.error.errors
          .map((issue) => issue.message)
          .join("; "),
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    )
  }

  const { messages: rawMessages, extractData, data } = parsedBody.data
  const documentId = data?.documentId
  const documentName = data?.fileName

  const normalizedMessages = normalizeMessages(rawMessages)

  const lastUserMessage = [...normalizedMessages]
    .reverse()
    .find((msg) => msg.role === "user")
  const userQuestion = lastUserMessage?.content ?? ""

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
            openai,
            conversationItems: [...normalizedMessages],
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

function normalizeMessages(messages: RawMessage[]): NormalizedMessage[] {
  return messages.map((message) => {
    if (Array.isArray(message.parts) && message.parts.length) {
      return {
        role: message.role,
        content: joinMessageParts(message.parts),
      }
    }

    if (typeof message.content === "string") {
      return { role: message.role, content: message.content }
    }

    if (Array.isArray(message.content)) {
      return {
        role: message.role,
        content: joinMessageParts(message.content),
      }
    }

    return {
      role: message.role,
      content: stringifyUnknownContent(message.content),
    }
  })
}

function joinMessageParts(parts: MessagePart[]): string {
  return parts
    .map((part) => {
      if (typeof part === "string") {
        return part
      }
      if (typeof part === "object" && part) {
        if (typeof part.text === "string") {
          return part.text
        }
        if (typeof part.content === "string") {
          return part.content
        }
      }
      return ""
    })
    .filter((segment) => segment.length > 0)
    .join(" ")
    .trim()
}

function stringifyUnknownContent(content: unknown): string {
  if (content == null) {
    return ""
  }
  if (typeof content === "string") {
    return content
  }
  if (typeof content === "number" || typeof content === "boolean") {
    return String(content)
  }
  try {
    return JSON.stringify(content)
  } catch {
    return ""
  }
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
  openai,
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
      openai,
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
  openai,
  conversationItems,
  instructions,
  tools,
  modelName,
  controller,
  encoder,
  extractData,
}: {
  openai: OpenAI
  conversationItems: ConversationItem[]
  instructions: string
  tools?: ReturnType<typeof getTools>
  modelName: string
  controller: ReadableStreamDefaultController
  encoder: TextEncoder
  extractData: boolean
}): Promise<{ toolCalls: ToolCall[]; outputItems: OutputItem[] }> {
  const supportsTemperature =
    !modelName.startsWith("gpt-5") &&
    !modelName.startsWith("o1") &&
    !modelName.startsWith("o3") &&
    !modelName.startsWith("o4")

  const requestConfig: ResponseCreateParamsStreaming = {
    model: modelName,
    input: conversationItems,
    instructions,
    stream: true,
  }

  if (supportsTemperature) {
    requestConfig.temperature = extractData ? 0.1 : 0.3
  }

  if (tools?.length) {
    requestConfig.tools = tools
    requestConfig.tool_choice = "auto"
  }

  const responseStream = (await openai.responses.create(
    requestConfig
  )) as AsyncIterable<ResponseStreamEvent>

  const outputItems: OutputItem[] = []
  const toolCalls: ToolCall[] = []
  const partialItems = new Map<number, OutputItem>()

  for await (const event of responseStream) {
    switch (event.type) {
      case "response.output_item.added":
        if (isOutputItemAddedEvent(event)) {
          partialItems.set(event.output_index, event.item)
        }
        break
      case "response.function_call_arguments.delta":
        if (
          typeof event.output_index === "number" &&
          typeof event.delta === "string"
        ) {
          const item = partialItems.get(event.output_index)
          if (item) {
            const existingArgs =
              typeof item.arguments === "string" ? item.arguments : ""
            item.arguments = existingArgs + event.delta
          }
        }
        break
      case "response.output_text.delta":
        if (typeof event.delta === "string") {
          controller.enqueue(encoder.encode(`0:${JSON.stringify(event.delta)}\n`))
        }
        break
      case "response.output_item.done":
        if (isOutputItemDoneEvent(event)) {
          const finalItem = event.item
          outputItems.push(finalItem)
          if (isToolCallItem(finalItem)) {
            toolCalls.push(finalItem)
          }
          partialItems.delete(event.output_index)
        }
        break
      default:
        break
    }
  }

  return { toolCalls, outputItems }
}

function isOutputItem(value: unknown): value is OutputItem {
  return typeof value === "object" && value !== null
}

function isOutputItemAddedEvent(
  event: ResponseStreamEvent
): event is ResponseStreamEvent & {
  type: "response.output_item.added"
  output_index: number
  item: OutputItem
} {
  return (
    event.type === "response.output_item.added" &&
    typeof (event as { output_index?: unknown }).output_index === "number" &&
    isOutputItem((event as { item?: unknown }).item)
  )
}

function isOutputItemDoneEvent(
  event: ResponseStreamEvent
): event is ResponseStreamEvent & {
  type: "response.output_item.done"
  output_index: number
  item: OutputItem
} {
  return (
    event.type === "response.output_item.done" &&
    typeof (event as { output_index?: unknown }).output_index === "number" &&
    isOutputItem((event as { item?: unknown }).item)
  )
}

function isToolCallItem(item: OutputItem): item is ToolCall {
  return (
    item.type === "function_call" &&
    typeof item.call_id === "string" &&
    typeof item.name === "string"
  )
}
