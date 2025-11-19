import { DocumentRepository } from "../storage/document-repository"
import { EmbeddingService } from "./embedding-service"
import { Chunk, SearchResult } from "../types"
import { documentRepository } from "../storage/fs-document-repository"
import { embeddingService } from "./openai-embedding-service"

export class SearchService {
  constructor(
    private repo: DocumentRepository,
    private embeddingService: EmbeddingService
  ) {}

  async search(
    query: string,
    options: { documentId?: string; limit?: number; minScore?: number } = {}
  ): Promise<SearchResult[]> {
    const { documentId, limit = 5, minScore = 0.3 } = options

    // 1. Generate query embedding
    const queryEmbedding = await this.embeddingService.generateEmbedding(query)

    // 2. Get chunks (filtered by doc or all)
    let chunks: Chunk[]
    if (documentId) {
      chunks = await this.repo.getChunksByDocumentId(documentId)
    } else {
      chunks = await this.repo.getAllChunks()
    }

    // 3. Calculate scores
    const results: SearchResult[] = chunks
      .filter((c) => c.embedding) // Ensure embedding exists
      .map((chunk) => {
        const score = this.cosineSimilarity(queryEmbedding, chunk.embedding!)
        // Remove embedding from result to save bandwidth/memory
        const { embedding: _embedding, ...rest } = chunk
        return { ...rest, score }
      })
      .filter((r) => r.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)

    return results
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0
    let normA = 0
    let normB = 0
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB))
  }
}

export const searchService = new SearchService(
  documentRepository,
  embeddingService
)
