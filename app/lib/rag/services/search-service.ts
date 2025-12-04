import { DocumentRepository } from "../storage/document-repository"
import { EmbeddingService } from "./embedding-service"
import { Chunk, SearchResult } from "../types"
import { documentRepository } from "../storage/fs-document-repository"
import { embeddingService } from "./openai-embedding-service"

const DEFAULT_LIMIT = 5
const DEFAULT_MIN_SCORE = 0.3

export class SearchService {
  constructor(
    private repo: DocumentRepository,
    private embeddingService: EmbeddingService
  ) {}

  async search(
    query: string,
    options: { documentId?: string; limit?: number; minScore?: number } = {}
  ): Promise<SearchResult[]> {
    const {
      documentId,
      limit = DEFAULT_LIMIT,
      minScore = DEFAULT_MIN_SCORE,
    } = options
    const safeLimit = Math.max(1, Math.floor(limit))
    const safeMinScore = Math.min(1, Math.max(0, minScore))

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
      .filter((r) => r.score >= safeMinScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, safeLimit)

    return results
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (!a.length || !b.length) {
      return 0
    }

    let dot = 0
    let normA = 0
    let normB = 0
    const length = Math.min(a.length, b.length)
    for (let i = 0; i < length; i++) {
      const aValue = a[i] ?? 0
      const bValue = b[i] ?? 0
      dot += aValue * bValue
      normA += aValue * aValue
      normB += bValue * bValue
    }
    const denominator = Math.sqrt(normA) * Math.sqrt(normB)
    if (!denominator) {
      return 0
    }
    return dot / denominator
  }
}

export const searchService = new SearchService(
  documentRepository,
  embeddingService
)
