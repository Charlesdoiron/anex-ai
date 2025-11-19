import { randomUUID } from "crypto"
import { splitText } from "./chunking"
import { documentRepository } from "../storage/fs-document-repository"
import { embeddingService } from "../services/openai-embedding-service"
import type { Chunk } from "../types"

const DEFAULT_CHUNK_SIZE = 1200
const DEFAULT_CHUNK_OVERLAP = 200

export interface IngestionPayload {
  documentId: string
  fileName: string
  pageCount: number
  pages: string[]
  rawText: string
  metadata?: Record<string, unknown>
}

export class DocumentIngestionService {
  constructor(
    private readonly repo = documentRepository,
    private readonly embeddings = embeddingService
  ) {}

  async ingest(payload: IngestionPayload): Promise<void> {
    const now = new Date().toISOString()

    await this.repo.saveDocument({
      id: payload.documentId,
      fileName: payload.fileName,
      pageCount: payload.pageCount,
      createdAt: now,
      updatedAt: now,
      metadata: payload.metadata,
    })

    const chunks = this.buildChunks(payload)
    if (chunks.length === 0) {
      return
    }

    await this.embedChunks(chunks)
    await this.repo.saveChunks(chunks)
  }

  private buildChunks(payload: IngestionPayload): Chunk[] {
    const chunks: Chunk[] = []
    const pages = [...payload.pages]
    const { rawText } = payload

    if (pages.length === 0 && rawText) {
      pages.push(rawText)
    }

    pages.forEach((pageText, pageIndex) => {
      const normalized = pageText?.trim()
      if (!normalized) {
        return
      }

      const pageChunks = splitText(
        normalized,
        DEFAULT_CHUNK_SIZE,
        DEFAULT_CHUNK_OVERLAP
      )

      pageChunks.forEach((chunkText) => {
        if (!chunkText) {
          return
        }
        chunks.push({
          id: randomUUID(),
          documentId: payload.documentId,
          text: chunkText,
          pageNumber: pageIndex + 1,
          metadata: {
            fileName: payload.fileName,
          },
        })
      })
    })

    return chunks
  }

  private async embedChunks(chunks: Chunk[]): Promise<void> {
    const embeddings = await this.embeddings.generateEmbeddings(
      chunks.map((chunk) => chunk.text)
    )

    embeddings.forEach((vector, index) => {
      chunks[index].embedding = vector
    })
  }
}

export const documentIngestionService = new DocumentIngestionService()
