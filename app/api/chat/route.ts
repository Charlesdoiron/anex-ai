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
              limit: {
                type: "number",
                description:
                  "Nombre maximum de passages à retourner (défaut: 5)",
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
          await handleConversation(
            messages,
            instructions,
            tools,
            modelName,
            isGpt5,
            extractData,
            documentId,
            controller,
            encoder
          )
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

async function handleConversation(
  inputMessages: any[],
  instructions: string,
  tools: any[] | undefined,
  modelName: string,
  isGpt5: boolean,
  extractData: boolean,
  documentId: string | undefined,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  previousResponseId?: string
) {
  const requestConfig: any = {
    model: modelName,
    input: inputMessages,
    instructions,
    stream: true,
  }

  if (tools) {
    requestConfig.tools = tools
    requestConfig.tool_choice = "auto"
  }

  if (previousResponseId) {
    requestConfig.previous_response_id = previousResponseId
  }

  if (!isGpt5) {
    requestConfig.temperature = extractData ? 0.1 : 0.3
  }

  const stream = isGpt5
    ? await openai.responses.create(requestConfig)
    : await openai.chat.completions.create({
        model: modelName,
        messages: [{ role: "system", content: instructions }, ...inputMessages],
        temperature: extractData ? 0.1 : 0.3,
        stream: true,
      })

  let responseId: string | undefined
  let toolCalls: any[] = []
  let currentToolCall: any = null

  for await (const event of stream as any) {
    if (isGpt5) {
      if (event.type === "response.output_item.added") {
        if (event.item.type === "function_call") {
          currentToolCall = {
            call_id: event.item.call_id,
            name: event.item.name,
            arguments: "",
          }
        }
      } else if (event.type === "response.function_call_arguments.delta") {
        if (currentToolCall) {
          currentToolCall.arguments += event.delta
        }
      } else if (event.type === "response.function_call_arguments.done") {
        if (currentToolCall) {
          toolCalls.push(currentToolCall)
          currentToolCall = null
        }
      } else if (event.type === "response.output_text.delta") {
        controller.enqueue(encoder.encode(`0:${JSON.stringify(event.delta)}\n`))
      } else if (event.type === "response.done") {
        responseId = event.response.id
      }
    } else {
      if (event.choices[0]?.delta?.content) {
        controller.enqueue(
          encoder.encode(
            `0:${JSON.stringify(event.choices[0].delta.content)}\n`
          )
        )
      }
    }
  }

  if (toolCalls.length > 0 && documentId) {
    for (const toolCall of toolCalls) {
      if (toolCall.name === "retrieve_chunks") {
        const args = JSON.parse(toolCall.arguments)
        const results = await searchService.search(args.query, {
          documentId,
          limit: args.limit || 5,
          minScore: 0.3,
        })

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

        inputMessages.push({
          type: "function_call_output",
          call_id: toolCall.call_id,
          output: context || "Aucun passage pertinent trouvé.",
        })
      }
    }

    await handleConversation(
      inputMessages,
      instructions,
      tools,
      modelName,
      isGpt5,
      extractData,
      documentId,
      controller,
      encoder,
      responseId
    )
  }
}
