import fs from "fs/promises"
import path from "path"
import { Document, Chunk } from "../types"
import { DocumentRepository } from "./document-repository"
import { RAG_CONFIG } from "../config"
import { ensureStorageStructure } from "../../storage-utils"

export class FileSystemDocumentRepository implements DocumentRepository {
  private baseDir: string
  private docsDir: string
  private chunksDir: string

  constructor(baseDir: string = RAG_CONFIG.storageDir) {
    this.baseDir = baseDir
    this.docsDir = path.join(this.baseDir, "documents")
    this.chunksDir = path.join(this.baseDir, "chunks")
  }

  private async ensureDirs() {
    await ensureStorageStructure()
  }

  async saveDocument(document: Document): Promise<void> {
    await this.ensureDirs()
    const filePath = path.join(this.docsDir, `${document.id}.json`)
    await fs.writeFile(filePath, JSON.stringify(document, null, 2))
  }

  async getDocument(id: string): Promise<Document | null> {
    await this.ensureDirs()
    try {
      const filePath = path.join(this.docsDir, `${id}.json`)
      const data = await fs.readFile(filePath, "utf-8")
      return JSON.parse(data) as Document
    } catch (error) {
      return null
    }
  }

  async saveChunks(chunks: Chunk[]): Promise<void> {
    await this.ensureDirs()
    if (chunks.length === 0) return

    // Group by documentId to minimize file writes if mixed (usually they are same doc)
    const chunksByDoc = chunks.reduce(
      (acc, chunk) => {
        if (!acc[chunk.documentId]) acc[chunk.documentId] = []
        acc[chunk.documentId].push(chunk)
        return acc
      },
      {} as Record<string, Chunk[]>
    )

    for (const [docId, docChunks] of Object.entries(chunksByDoc)) {
      const filePath = path.join(this.chunksDir, `${docId}.json`)
      // Overwrite for now - simple replacement for the document's chunks
      await fs.writeFile(filePath, JSON.stringify(docChunks, null, 2))
    }
  }

  async getChunksByDocumentId(documentId: string): Promise<Chunk[]> {
    await this.ensureDirs()
    try {
      const filePath = path.join(this.chunksDir, `${documentId}.json`)
      const data = await fs.readFile(filePath, "utf-8")
      return JSON.parse(data) as Chunk[]
    } catch (error) {
      return []
    }
  }

  async getAllChunks(): Promise<Chunk[]> {
    await this.ensureDirs()
    try {
      const files = await fs.readdir(this.chunksDir)
      const allChunks: Chunk[] = []

      // Read all chunk files in parallel
      const chunksPromises = files
        .filter((f) => f.endsWith(".json"))
        .map(async (file) => {
          const filePath = path.join(this.chunksDir, file)
          const data = await fs.readFile(filePath, "utf-8")
          return JSON.parse(data) as Chunk[]
        })

      const chunksArrays = await Promise.all(chunksPromises)
      chunksArrays.forEach((chunks) => allChunks.push(...chunks))

      return allChunks
    } catch (error) {
      console.error("Error reading all chunks:", error)
      return []
    }
  }

  async deleteDocument(id: string): Promise<void> {
    const docPath = path.join(this.docsDir, `${id}.json`)
    const chunksPath = path.join(this.chunksDir, `${id}.json`)

    try {
      await fs.unlink(docPath)
    } catch (e) {
      /* ignore */
    }

    try {
      await fs.unlink(chunksPath)
    } catch (e) {
      /* ignore */
    }
  }
}

export const documentRepository = new FileSystemDocumentRepository()
