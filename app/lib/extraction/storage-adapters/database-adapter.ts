// Adapter pour stocker dans une base de données (à implémenter plus tard)

import type { StorageAdapter } from "../storage-service"
import type { LeaseExtractionResult } from "../types"

export class DatabaseStorageAdapter implements StorageAdapter {
  async saveExtraction(
    documentId: string,
    data: Omit<LeaseExtractionResult, "rawText">
  ): Promise<void> {
    throw new Error("DatabaseStorageAdapter not yet implemented")
  }

  async getExtraction(
    documentId: string
  ): Promise<Omit<LeaseExtractionResult, "rawText"> | null> {
    throw new Error("DatabaseStorageAdapter not yet implemented")
  }

  async saveRawText(documentId: string, rawText: string): Promise<void> {
    throw new Error("DatabaseStorageAdapter not yet implemented")
  }

  async getRawText(documentId: string): Promise<string | null> {
    throw new Error("DatabaseStorageAdapter not yet implemented")
  }

  async deleteExtraction(documentId: string): Promise<void> {
    throw new Error("DatabaseStorageAdapter not yet implemented")
  }

  async listExtractions(): Promise<string[]> {
    throw new Error("DatabaseStorageAdapter not yet implemented")
  }
}
