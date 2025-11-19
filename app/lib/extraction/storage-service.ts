/**
 * Storage service for extraction results
 * Saves to filesystem for now, can be extended to database
 */

import fs from "fs/promises"
import path from "path"
import type { LeaseExtractionResult } from "./types"

export class ExtractionStorageService {
  private storageDir: string

  constructor(storageDir?: string) {
    this.storageDir =
      storageDir ||
      process.env.EXTRACTION_STORAGE_DIR ||
      path.join(process.cwd(), "storage", "extractions")
  }

  async ensureStorageDir(): Promise<void> {
    try {
      await fs.mkdir(this.storageDir, { recursive: true })
    } catch (error) {
      console.error("Failed to create storage directory:", error)
      throw error
    }
  }

  async saveExtraction(result: LeaseExtractionResult): Promise<void> {
    await this.ensureStorageDir()

    const filePath = path.join(this.storageDir, `${result.documentId}.json`)

    try {
      await fs.writeFile(filePath, JSON.stringify(result, null, 2), "utf-8")
      console.log(`✅ Saved extraction result: ${result.documentId}`)
    } catch (error) {
      console.error("Failed to save extraction result:", error)
      throw error
    }
  }

  async getExtraction(
    documentId: string
  ): Promise<LeaseExtractionResult | null> {
    const filePath = path.join(this.storageDir, `${documentId}.json`)

    try {
      const data = await fs.readFile(filePath, "utf-8")
      return JSON.parse(data) as LeaseExtractionResult
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null
      }
      console.error("Failed to read extraction result:", error)
      throw error
    }
  }

  async listExtractions(): Promise<string[]> {
    await this.ensureStorageDir()

    try {
      const files = await fs.readdir(this.storageDir)
      return files
        .filter((file) => file.endsWith(".json"))
        .map((file) => file.replace(".json", ""))
    } catch (error) {
      console.error("Failed to list extractions:", error)
      return []
    }
  }

  async deleteExtraction(documentId: string): Promise<void> {
    const filePath = path.join(this.storageDir, `${documentId}.json`)

    try {
      await fs.unlink(filePath)
      console.log(`🗑️ Deleted extraction result: ${documentId}`)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error("Failed to delete extraction result:", error)
        throw error
      }
    }
  }

  async searchExtractions(query: string): Promise<LeaseExtractionResult[]> {
    const documentIds = await this.listExtractions()
    const results: LeaseExtractionResult[] = []

    for (const id of documentIds) {
      const extraction = await this.getExtraction(id)
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

export const extractionStorage = new ExtractionStorageService()
