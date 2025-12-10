import { prisma } from "@/app/lib/prisma"
import type { StorageAdapter } from "../storage-service"
import type { LeaseExtractionResult } from "../types"

export class DatabaseStorageAdapter implements StorageAdapter {
  private userId: string

  constructor(userId = "anonymous") {
    this.userId = userId
  }

  async saveExtraction(
    documentId: string,
    data: Omit<LeaseExtractionResult, "rawText">
  ): Promise<void> {
    const { extractionMetadata, ...structuredData } = data

    await prisma.extraction.upsert({
      where: { documentId },
      create: {
        documentId,
        userId: this.userId === "anonymous" ? null : this.userId,
        fileName: data.fileName,
        fileSize: null,
        pageCount: data.pageCount ?? null,
        extractionDate: new Date(data.extractionDate),
        structuredData: structuredData as object,
        totalFields: extractionMetadata.totalFields,
        extractedFields: extractionMetadata.extractedFields,
        missingFields: extractionMetadata.missingFields,
        lowConfidenceFields: extractionMetadata.lowConfidenceFields,
        averageConfidence: extractionMetadata.averageConfidence,
        processingTimeMs: extractionMetadata.processingTimeMs,
        retries: extractionMetadata.retries ?? 0,
      },
      update: {
        fileName: data.fileName,
        pageCount: data.pageCount ?? null,
        extractionDate: new Date(data.extractionDate),
        structuredData: structuredData as object,
        totalFields: extractionMetadata.totalFields,
        extractedFields: extractionMetadata.extractedFields,
        missingFields: extractionMetadata.missingFields,
        lowConfidenceFields: extractionMetadata.lowConfidenceFields,
        averageConfidence: extractionMetadata.averageConfidence,
        processingTimeMs: extractionMetadata.processingTimeMs,
      },
    })
  }

  async getExtraction(
    documentId: string
  ): Promise<Omit<LeaseExtractionResult, "rawText"> | null> {
    const extraction = await prisma.extraction.findUnique({
      where: { documentId },
    })

    if (!extraction) return null

    const { structuredData, ...meta } = extraction

    return {
      ...(structuredData as object),
      documentId: meta.documentId,
      fileName: meta.fileName,
      pageCount: meta.pageCount ?? undefined,
      extractionDate: meta.extractionDate.toISOString(),
      toolType: meta.toolType,
      extractionMetadata: {
        totalFields: meta.totalFields,
        extractedFields: meta.extractedFields,
        missingFields: meta.missingFields,
        lowConfidenceFields: meta.lowConfidenceFields,
        averageConfidence: meta.averageConfidence,
        processingTimeMs: meta.processingTimeMs,
        retries: meta.retries,
      },
    } as unknown as Omit<LeaseExtractionResult, "rawText">
  }

  async saveRawText(documentId: string, rawText: string): Promise<void> {
    await prisma.rawText.upsert({
      where: { documentId },
      create: {
        documentId,
        content: rawText,
      },
      update: {
        content: rawText,
      },
    })
  }

  async getRawText(documentId: string): Promise<string | null> {
    const rawText = await prisma.rawText.findUnique({
      where: { documentId },
    })

    return rawText?.content ?? null
  }

  async deleteExtraction(documentId: string): Promise<void> {
    await prisma.$transaction([
      prisma.rawText.deleteMany({ where: { documentId } }),
      prisma.extraction.deleteMany({ where: { documentId } }),
    ])
  }

  async listExtractions(): Promise<string[]> {
    const extractions = await prisma.extraction.findMany({
      where: this.userId !== "anonymous" ? { userId: this.userId } : undefined,
      select: { documentId: true },
      orderBy: { createdAt: "desc" },
    })

    return extractions.map((e) => e.documentId)
  }
}
