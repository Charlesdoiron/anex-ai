/**
 * API route for listing and searching extractions
 * GET /api/extractions
 * Supports filtering by toolType via ?toolType=extraction-lease|calculation-rent
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/app/lib/auth"
import { prisma } from "@/app/lib/prisma"
import { extractionStorage } from "@/app/lib/extraction/storage-service"
import type {
  LeaseExtractionResult,
  LeaseRegime,
} from "@/app/lib/extraction/types"
import { normalizePurpose } from "@/app/components/recent-activity/filter-utils"
import type { toolType } from "@/app/static-data/agent"

const VALID_TOOL_TYPES: toolType[] = ["extraction-lease", "calculation-rent"]

interface FilterableExtractionSummary {
  id: string
  documentId: string
  fileName: string
  fileSize: number | null
  pageCount: number | null
  pipelineId: string | null
  toolType: toolType
  createdAt: string
  regime: LeaseRegime | null
  duration: number | null
  surfaceArea: number | null
  annualRent: number | null
  purpose: string | null
  averageConfidence: number | null
}

function summarizeExtraction(
  result: LeaseExtractionResult,
  extractionToolType: toolType = "extraction-lease"
): FilterableExtractionSummary {
  // Handle both possible regime structures (nested LeaseRegimeData or flat ExtractedValue)
  const regimeData = result.regime as unknown as
    | { regime?: { value?: LeaseRegime }; value?: LeaseRegime }
    | undefined
  const regime = regimeData?.regime?.value ?? regimeData?.value ?? null

  const duration = result.calendar?.duration?.value ?? null
  const surfaceArea = result.premises?.surfaceArea?.value ?? null
  const annualRent = result.rent?.annualRentExclTaxExclCharges?.value ?? null
  const rawPurpose = result.premises?.purpose?.value ?? null
  const purpose = normalizePurpose(rawPurpose)
  const averageConfidence = result.extractionMetadata?.averageConfidence ?? null

  return {
    id: result.documentId,
    documentId: result.documentId,
    fileName: result.fileName || "Document",
    fileSize: null,
    pageCount: result.pageCount || null,
    pipelineId: null,
    toolType: extractionToolType,
    createdAt: result.extractionDate,
    regime,
    duration,
    surfaceArea,
    annualRent,
    purpose,
    averageConfidence,
  }
}

export async function GET(request: NextRequest) {
  try {
    const skipAuth = process.env.SKIP_AUTH === "true"

    if (!skipAuth) {
      const session = await auth.api.getSession({
        headers: request.headers,
      })

      if (!session?.user?.id) {
        return NextResponse.json(
          { error: "Unauthorized", message: "Authentication required" },
          { status: 401 }
        )
      }
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q")
    const toolTypeParam = searchParams.get("toolType")
    const filterToolType =
      toolTypeParam && VALID_TOOL_TYPES.includes(toolTypeParam as toolType)
        ? (toolTypeParam as toolType)
        : undefined

    // Use database directly when filtering by toolType for efficiency
    if (filterToolType) {
      const extractions = await prisma.extraction.findMany({
        where: { toolType: filterToolType },
        orderBy: { createdAt: "desc" },
        select: {
          documentId: true,
          fileName: true,
          fileSize: true,
          pageCount: true,
          pipelineId: true,
          toolType: true,
          createdAt: true,
          structuredData: true,
          averageConfidence: true,
        },
      })

      const summaries: FilterableExtractionSummary[] = extractions.map(
        (ext) => {
          const data = ext.structuredData as Record<string, unknown>
          return {
            id: ext.documentId,
            documentId: ext.documentId,
            fileName: ext.fileName || "Document",
            fileSize: ext.fileSize,
            pageCount: ext.pageCount,
            pipelineId: ext.pipelineId,
            toolType: ext.toolType as toolType,
            createdAt: ext.createdAt.toISOString(),
            regime: extractNestedValue(
              data,
              "regime",
              "regime",
              "value"
            ) as LeaseRegime | null,
            duration: extractNestedValue(
              data,
              "calendar",
              "duration",
              "value"
            ) as number | null,
            surfaceArea: extractNestedValue(
              data,
              "premises",
              "surfaceArea",
              "value"
            ) as number | null,
            annualRent: extractNestedValue(
              data,
              "rent",
              "annualRentExclTaxExclCharges",
              "value"
            ) as number | null,
            purpose: normalizePurpose(
              extractNestedValue(data, "premises", "purpose", "value") as
                | string
                | null
            ),
            averageConfidence: ext.averageConfidence,
          }
        }
      )

      return NextResponse.json(
        { success: true, extractions: summaries, count: summaries.length },
        {
          headers: {
            "Cache-Control": "private, max-age=0, stale-while-revalidate=30",
          },
        }
      )
    }

    if (query) {
      const results = await extractionStorage.searchExtractions(query)
      const summaries = results.map((e) => summarizeExtraction(e))
      return NextResponse.json({
        success: true,
        extractions: summaries,
        count: summaries.length,
      })
    }

    const documentIds = await extractionStorage.listExtractions()
    const extractionPromises = documentIds.map((id) =>
      extractionStorage.getExtraction(id).catch(() => null)
    )
    const results = await Promise.all(extractionPromises)
    const summaries = results
      .filter(Boolean)
      .map((extraction) => summarizeExtraction(extraction!))

    summaries.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime()
      const dateB = new Date(b.createdAt || 0).getTime()
      return dateB - dateA
    })

    return NextResponse.json(
      {
        success: true,
        extractions: summaries,
        count: summaries.length,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=0, stale-while-revalidate=30",
        },
      }
    )
  } catch (error) {
    console.error("Failed to list extractions:", error)
    return NextResponse.json(
      {
        error: "Listing failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

function extractNestedValue(
  data: Record<string, unknown>,
  ...keys: string[]
): unknown {
  let current: unknown = data
  for (const key of keys) {
    if (current && typeof current === "object" && key in current) {
      current = (current as Record<string, unknown>)[key]
    } else {
      return null
    }
  }
  return current
}
