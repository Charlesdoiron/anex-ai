import type {
  ResponseFunctionToolCall,
  ResponseInput,
  ResponseInputItem,
  ResponseOutputItem,
  ResponseOutputMessage,
  Tool,
} from "openai/resources/responses/responses"

import { retrieveChunksTool } from "@/app/lib/ai/tools/definitions"
import {
  handleToolCallWithRegistry,
  type ToolCall,
  type ToolCallOutput,
} from "@/app/lib/ai/tools/handlers"
import { getOpenAIClient } from "@/app/lib/openai/client"
import { RAG_CONFIG } from "../config"
import { SourceInfo } from "../types"

const openai = getOpenAIClient()
const TOOLS: Tool[] = [retrieveChunksTool]

type ConversationItem = ResponseInputItem

export async function generateAnswerWithRAG(
  question: string,
  documentId: string,
  instructions = "You are a precise data extraction assistant. Use the retrieve_chunks tool to find information in the document to answer the question. Answer ONLY based on the retrieved context."
): Promise<{ answer: string; sources: SourceInfo[] }> {
  const messages: ConversationItem[] = [
    {
      type: "message",
      role: "user",
      content: question,
    },
  ]

  return runConversation(messages, documentId, instructions, undefined, [])
}

async function runConversation(
  inputMessages: ConversationItem[],
  documentId: string,
  instructions: string,
  previousResponseId?: string,
  accumulatedSources: SourceInfo[] = []
): Promise<{ answer: string; sources: SourceInfo[] }> {
  try {
    const response = await openai.responses.create({
      model: RAG_CONFIG.responsesModel,
      input: inputMessages as ResponseInput,
      tools: TOOLS,
      instructions,
      previous_response_id: previousResponseId,
      tool_choice: "auto",
      text: {},
    })

    let toolCallItem: ToolCall | null = null
    let assistantMessage: ResponseOutputMessage | null = null

    for (const item of response.output) {
      if (isAssistantMessage(item)) {
        assistantMessage = item
      }
      if (isFunctionToolCall(item)) {
        toolCallItem = item
        break
      }
    }

    if (!toolCallItem) {
      const answer = extractAssistantText(assistantMessage)
      return { answer, sources: accumulatedSources }
    }

    const { outputItem, sources: newSources } =
      await handleToolCallWithRegistry(toolCallItem, {
        documentId,
      })

    return runConversation(
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

function isAssistantMessage(
  item: ResponseOutputItem
): item is ResponseOutputMessage {
  return item.type === "message" && item.role === "assistant"
}

function isFunctionToolCall(
  item: ResponseOutputItem
): item is ResponseFunctionToolCall {
  return item.type === "function_call"
}

function extractAssistantText(message: ResponseOutputMessage | null): string {
  if (!message) {
    return ""
  }
  const output = message.content.find(
    (content) => content.type === "output_text"
  )
  if (output && output.type === "output_text") {
    return output.text
  }
  return ""
}
