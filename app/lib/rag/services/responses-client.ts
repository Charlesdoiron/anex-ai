import OpenAI from "openai"
import { retrieveChunksTool } from "@/app/lib/ai/tools/definitions"
import { handleToolCallWithRegistry } from "@/app/lib/ai/tools/handlers"
import { RAG_CONFIG } from "../config"
import { SourceInfo } from "../types"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const TOOLS = [retrieveChunksTool]

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
    const tools = TOOLS.map((tool) => ({
      ...tool,
      strict: tool.strict ?? null,
    }))
    const response = await openai.responses.create({
      model: RAG_CONFIG.responsesModel,
      input: inputMessages,
      tools: tools as any,
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

    // 3. Handle tool call via registry
    const { outputItem, sources: newSources } =
      await handleToolCallWithRegistry(toolCallItem, {
        documentId,
      })

    return await runConversation(
      [outputItem],
      documentId,
      instructions,
      response.id,
      [...accumulatedSources, ...(newSources ?? [])]
    )
  } catch (error) {
    console.error("Error in generateAnswerWithRAG:", error)
    return { answer: "Error generating answer.", sources: accumulatedSources }
  }
}
