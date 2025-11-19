import OpenAI from "openai"
import { searchService } from "./search-service"
import { RAG_CONFIG } from "../config"
import { SourceInfo } from "../types"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const TOOLS = [
  {
    type: "function" as const,
    name: "retrieve_chunks",
    description:
      "Retrieve relevant text chunks from the document based on a search query.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query to find relevant information.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
    strict: true,
  },
]

export async function generateAnswerWithRAG(
  question: string,
  documentId: string,
  instructions: string = "You are a precise data extraction assistant. Use the retrieve_chunks tool to find information in the document to answer the question. Answer ONLY based on the retrieved context."
): Promise<{ answer: string; sources: SourceInfo[] }> {
  const messages: any[] = [
    {
      role: "user",
      content: question,
    },
  ]

  return await runConversation(
    messages,
    documentId,
    instructions,
    undefined,
    []
  )
}

async function runConversation(
  inputMessages: any[],
  documentId: string,
  instructions: string,
  previousResponseId?: string,
  accumulatedSources: SourceInfo[] = []
): Promise<{ answer: string; sources: SourceInfo[] }> {
  try {
    // 1. Call Responses API
    const response = await openai.responses.create({
      model: RAG_CONFIG.responsesModel,
      input: inputMessages,
      tools: TOOLS,
      instructions,
      previous_response_id: previousResponseId,
      tool_choice: "auto",
      text: {
        // verbosity: "medium" // Uncomment when SDK types support it
      },
    })

    // 2. Check for tool calls
    let toolCallItem: any = null
    let assistantMessage: any = null

    for (const item of response.output) {
      if (item.type === "message" && item.role === "assistant") {
        assistantMessage = item
      }
      if (item.type === "function_call") {
        toolCallItem = item
        break
      }
    }

    // If no tool call, return the text content
    if (!toolCallItem) {
      let answer = ""
      if (assistantMessage && assistantMessage.content) {
        const textContent = assistantMessage.content.find(
          (c: any) => c.type === "output_text"
        )
        answer = textContent?.text || ""
      }
      return { answer, sources: accumulatedSources }
    }

    // 3. Handle tool call
    if (toolCallItem.name === "retrieve_chunks") {
      console.log(`🛠️ Tool call: ${toolCallItem.name}`)
      const args = JSON.parse(toolCallItem.arguments)

      // Execute search
      const results = await searchService.search(args.query, {
        documentId,
        limit: 5,
      })

      const context = results
        .map((r) => `[Page ${r.pageNumber}] ${r.text}`)
        .join("\n\n")
      console.log(`🔍 Found ${results.length} chunks`)

      // Collect sources
      const newSources: SourceInfo[] = results.map((r) => ({
        pageNumber: r.pageNumber,
        score: r.score,
        text: r.text,
        summary: r.metadata?.summary,
        metadata: r.metadata,
        // fileName is missing here, can be added if passed or fetched
      }))

      // Add tool result to conversation
      const toolOutputItem = {
        type: "function_call_output",
        call_id: toolCallItem.call_id,
        output: JSON.stringify({ results: context || "No results found." }),
      }

      // Recurse
      return await runConversation(
        [toolOutputItem],
        documentId,
        instructions,
        response.id,
        [...accumulatedSources, ...newSources]
      )
    }

    return { answer: "Error: Unknown tool call", sources: accumulatedSources }
  } catch (error) {
    console.error("Error in generateAnswerWithRAG:", error)
    return { answer: "Error generating answer.", sources: accumulatedSources }
  }
}
