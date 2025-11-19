import { prisma } from "../prisma"

export interface ExtractionHistoryItem {
  id: string
  fileName: string
  fileSize: number | null
  pageCount: number | null
  pipelineId: string | null
  createdAt: Date
}

export interface ExportHistoryItem {
  id: string
  format: string
  messageCount: number
  createdAt: Date
}

export async function getUserExtractions(
  userId: string,
  limit = 50
): Promise<ExtractionHistoryItem[]> {
  return prisma.extraction.findMany({
    where: {
      userId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
    select: {
      id: true,
      fileName: true,
      fileSize: true,
      pageCount: true,
      pipelineId: true,
      createdAt: true,
    },
  })
}

export async function getUserExtractionStats(userId: string) {
  const totalExtractions = await prisma.extraction.count({
    where: { userId },
  })

  const totalPages = await prisma.extraction.aggregate({
    where: { userId },
    _sum: {
      pageCount: true,
    },
  })

  const lastExtraction = await prisma.extraction.findFirst({
    where: { userId },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      createdAt: true,
      fileName: true,
    },
  })

  return {
    totalExtractions,
    totalPages: totalPages._sum.pageCount || 0,
    lastExtraction,
  }
}

export async function getUserExports(
  userId: string,
  limit = 50
): Promise<ExportHistoryItem[]> {
  return prisma.export.findMany({
    where: {
      userId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
    select: {
      id: true,
      format: true,
      messageCount: true,
      createdAt: true,
    },
  })
}

export async function getUserExportStats(userId: string) {
  const totalExports = await prisma.export.count({
    where: { userId },
  })

  const exportsByFormat = await prisma.export.groupBy({
    by: ["format"],
    where: { userId },
    _count: {
      format: true,
    },
  })

  const totalMessages = await prisma.export.aggregate({
    where: { userId },
    _sum: {
      messageCount: true,
    },
  })

  const lastExport = await prisma.export.findFirst({
    where: { userId },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      createdAt: true,
      format: true,
    },
  })

  return {
    totalExports,
    exportsByFormat: exportsByFormat.reduce(
      (acc, item) => ({
        ...acc,
        [item.format]: item._count.format,
      }),
      {} as Record<string, number>
    ),
    totalMessages: totalMessages._sum.messageCount || 0,
    lastExport,
  }
}
