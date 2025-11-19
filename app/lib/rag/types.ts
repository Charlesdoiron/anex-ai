export interface Document {
  id: string
  fileName: string
  fileSize?: number
  pageCount: number
  createdAt: string // ISO string for JSON serialization
  updatedAt: string
  metadata?: Record<string, any>
}

export interface Chunk {
  id: string
  documentId: string
  text: string
  pageNumber: number
  metadata?: {
    summary?: string
    label?: string
    [key: string]: any
  }
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
