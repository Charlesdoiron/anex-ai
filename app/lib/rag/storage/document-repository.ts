import { Document, Chunk } from "../types"

export interface DocumentRepository {
  saveDocument(document: Document): Promise<void>
  getDocument(id: string): Promise<Document | null>
  saveChunks(chunks: Chunk[]): Promise<void>
  getChunksByDocumentId(documentId: string): Promise<Chunk[]>
  getAllChunks(): Promise<Chunk[]>
  deleteDocument(id: string): Promise<void>
}
