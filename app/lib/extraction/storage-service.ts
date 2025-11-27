// Service de stockage des résultats d'extraction
//
// Supporte deux backends :
// - FileSystem (dev local) : USE_DB_STORAGE=false ou non défini
// - Database (production) : USE_DB_STORAGE=true

import fs from "fs/promises"
import path from "path"
import type { LeaseExtractionResult } from "./types"
import { ensureStorageStructure } from "../storage-utils"
import { DatabaseStorageAdapter } from "./storage-adapters/database-adapter"

export interface StorageAdapter {
  saveExtraction(
    documentId: string,
    data: Omit<LeaseExtractionResult, "rawText">
  ): Promise<void>
  getExtraction(
    documentId: string
  ): Promise<Omit<LeaseExtractionResult, "rawText"> | null>
  saveRawText(documentId: string, rawText: string): Promise<void>
  getRawText(documentId: string): Promise<string | null>
  deleteExtraction(documentId: string): Promise<void>
  listExtractions(): Promise<string[]>
}

export class FileSystemStorageAdapter implements StorageAdapter {
  private storageDir: string
  private rawTextDir: string

  constructor(storageDir?: string) {
    this.storageDir =
      storageDir ||
      process.env.EXTRACTION_STORAGE_DIR ||
      path.join(process.cwd(), "storage", "extractions")
    this.rawTextDir = path.join(this.storageDir, "raw-text")
  }

  private async ensureDirectories(): Promise<void> {
    await ensureStorageStructure()
  }

  async saveExtraction(
    documentId: string,
    data: Omit<LeaseExtractionResult, "rawText">
  ): Promise<void> {
    await this.ensureDirectories()
    const filePath = path.join(this.storageDir, `${documentId}.json`)
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8")
  }

  async getExtraction(
    documentId: string
  ): Promise<Omit<LeaseExtractionResult, "rawText"> | null> {
    await this.ensureDirectories()
    const filePath = path.join(this.storageDir, `${documentId}.json`)
    try {
      const data = await fs.readFile(filePath, "utf-8")
      return JSON.parse(data)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null
      }
      throw error
    }
  }

  async saveRawText(documentId: string, rawText: string): Promise<void> {
    await this.ensureDirectories()
    const filePath = path.join(this.rawTextDir, `${documentId}.txt`)
    await fs.writeFile(filePath, rawText, "utf-8")
  }

  async getRawText(documentId: string): Promise<string | null> {
    await this.ensureDirectories()
    const filePath = path.join(this.rawTextDir, `${documentId}.txt`)
    try {
      return await fs.readFile(filePath, "utf-8")
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null
      }
      throw error
    }
  }

  async deleteExtraction(documentId: string): Promise<void> {
    const jsonPath = path.join(this.storageDir, `${documentId}.json`)
    const txtPath = path.join(this.rawTextDir, `${documentId}.txt`)

    await Promise.allSettled([
      fs.unlink(jsonPath).catch(() => {}),
      fs.unlink(txtPath).catch(() => {}),
    ])
  }

  async listExtractions(): Promise<string[]> {
    await this.ensureDirectories()
    const files = await fs.readdir(this.storageDir)
    return files
      .filter((file) => file.endsWith(".json"))
      .map((file) => file.replace(".json", ""))
  }
}

export class ExtractionStorageService {
  constructor(private adapter: StorageAdapter) {}

  async saveExtraction(result: LeaseExtractionResult): Promise<void> {
    const { rawText, ...structuredData } = result

    await Promise.all([
      this.adapter.saveExtraction(result.documentId, structuredData),
      this.adapter.saveRawText(result.documentId, rawText),
    ])

    console.log(`✅ Saved extraction: ${result.documentId}`)
  }

  async getExtraction(
    documentId: string,
    includeRawText = false
  ): Promise<LeaseExtractionResult | null> {
    const structured = await this.adapter.getExtraction(documentId)
    if (!structured) return null

    if (!includeRawText) {
      return { ...structured, rawText: "" } as LeaseExtractionResult
    }

    const rawText = (await this.adapter.getRawText(documentId)) || ""
    return { ...structured, rawText } as LeaseExtractionResult
  }

  async getRawText(documentId: string): Promise<string | null> {
    return this.adapter.getRawText(documentId)
  }

  async deleteExtraction(documentId: string): Promise<void> {
    await this.adapter.deleteExtraction(documentId)
    console.log(`🗑️ Deleted extraction: ${documentId}`)
  }

  async listExtractions(): Promise<string[]> {
    return this.adapter.listExtractions()
  }

  async searchExtractions(
    query: string,
    includeRawText = false
  ): Promise<LeaseExtractionResult[]> {
    const documentIds = await this.listExtractions()
    const results: LeaseExtractionResult[] = []

    for (const id of documentIds) {
      const extraction = await this.getExtraction(id, includeRawText)
      if (extraction) {
        const searchableText = JSON.stringify(extraction).toLowerCase()
        if (searchableText.includes(query.toLowerCase())) {
          results.push(extraction)
        }
      }
    }

    return results
  }
}

function createStorageAdapter(): StorageAdapter {
  const useDatabase = process.env.USE_DB_STORAGE === "true"

  if (useDatabase) {
    return new DatabaseStorageAdapter()
  }

  return new FileSystemStorageAdapter()
}

export const extractionStorage = new ExtractionStorageService(
  createStorageAdapter()
)
