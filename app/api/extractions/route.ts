/**
 * API route for listing and searching extractions
 * GET /api/extractions
 * Supports:
 * - ?toolType=extraction-lease|calculation-rent (filter by tool type)
 * - ?limit=50 (default 50, max 200)
 * - ?offset=0 (for pagination)
 * - ?q=search (search in file names)
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/app/lib/auth"
import { prisma } from "@/app/lib/prisma"
import type { LeaseRegime } from "@/app/lib/extraction/types"
import { normalizePurpose } from "@/app/components/recent-activity/filter-utils"
import type { toolType } from "@/app/static-data/agent"

const VALID_TOOL_TYPES: toolType[] = ["extraction-lease", "calculation-rent"]
const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

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

export async function GET(request: NextRequest) {
  try {
    const skipAuth = process.env.SKIP_AUTH === "true"
    let currentUserId: string | null = null

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
      currentUserId = session.user.id
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q")?.trim()
    const toolTypeParam = searchParams.get("toolType")
    const limitParam = parseInt(searchParams.get("limit") || "", 10)
    const offsetParam = parseInt(searchParams.get("offset") || "", 10)

    const limit = Math.min(
      Math.max(1, isNaN(limitParam) ? DEFAULT_LIMIT : limitParam),
      MAX_LIMIT
    )
    const offset = Math.max(0, isNaN(offsetParam) ? 0 : offsetParam)

    const filterToolType =
      toolTypeParam && VALID_TOOL_TYPES.includes(toolTypeParam as toolType)
        ? (toolTypeParam as toolType)
        : undefined

    // Build where clause with user filter for confidentiality
    const where: {
      userId?: string
      toolType?: string
      fileName?: { contains: string; mode: "insensitive" }
    } = {}

    // Filter by current user to ensure extractions are confidential per user
    if (currentUserId) {
      where.userId = currentUserId
    }

    if (filterToolType) {
      where.toolType = filterToolType
    }

    if (query) {
      where.fileName = { contains: query, mode: "insensitive" }
    }

    // Always use database directly (no filesystem fallback)
    const [extractions, total] = await Promise.all([
      prisma.extraction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
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
      }),
      prisma.extraction.count({ where }),
    ])

    const summaries: FilterableExtractionSummary[] = extractions.map((ext) => {
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
        duration: extractNestedValue(data, "calendar", "duration", "value") as
          | number
          | null,
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
    })

    return NextResponse.json(
      {
        success: true,
        extractions: summaries,
        count: summaries.length,
        total,
        limit,
        offset,
        hasMore: offset + summaries.length < total,
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
