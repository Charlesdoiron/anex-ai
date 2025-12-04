export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonObject | JsonArray
export type JsonArray = JsonValue[]
export interface JsonObject {
  [key: string]: JsonValue | undefined
}

export interface Document {
  id: string
  fileName: string
  fileSize?: number
  pageCount: number
  createdAt: string
  updatedAt: string
  metadata?: JsonObject
}

export interface ChunkMetadata extends JsonObject {
  summary?: string
  label?: string
}

export interface Chunk {
  id: string
  documentId: string
  text: string
  pageNumber: number
  metadata?: ChunkMetadata
  embedding?: number[]
}

export interface SearchResult extends Omit<Chunk, "embedding"> {
  score: number
}

export interface SourceInfo {
  pageNumber?: number
  fileName?: string
  score?: number | null
  text?: string
  summary?: string
  metadata?: Record<string, unknown>
}
