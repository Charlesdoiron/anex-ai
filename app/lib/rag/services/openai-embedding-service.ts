import type OpenAI from "openai"
import { EmbeddingService } from "./embedding-service"
import { RAG_CONFIG } from "../config"
import { getOpenAIClient } from "@/app/lib/openai/client"

export class OpenAIEmbeddingService implements EmbeddingService {
  private openai: OpenAI
  private model: string

  constructor() {
    this.openai = getOpenAIClient()
    this.model = RAG_CONFIG.embeddingModel
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: this.model,
      input: text,
      encoding_format: "float",
    })
    return response.data[0].embedding
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const response = await this.openai.embeddings.create({
      model: this.model,
      input: texts,
      encoding_format: "float",
    })
    return response.data.map((d) => d.embedding)
  }
}

export const embeddingService = new OpenAIEmbeddingService()
