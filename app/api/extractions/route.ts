/**
 * API route for listing and searching extractions
 * GET /api/extractions
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/app/lib/auth"
import { extractionStorage } from "@/app/lib/extraction/storage-service"
import type { LeaseExtractionResult } from "@/app/lib/extraction/types"

function summarizeExtraction(result: LeaseExtractionResult) {
  return {
    id: result.documentId,
    documentId: result.documentId,
    fileName: result.fileName || "Document",
    fileSize: undefined,
    pageCount: result.pageCount || null,
    pipelineId: null,
    createdAt: result.extractionDate,
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

    if (query) {
      const results = await extractionStorage.searchExtractions(query)
      const summaries = results.map(summarizeExtraction)
      return NextResponse.json({
        success: true,
        extractions: summaries,
        count: summaries.length,
      })
    }

    const documentIds = await extractionStorage.listExtractions()
    const summaries = []
    for (const id of documentIds) {
      const extraction = await extractionStorage.getExtraction(id)
      if (extraction) {
        summaries.push(summarizeExtraction(extraction))
      }
    }

    summaries.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime()
      const dateB = new Date(b.createdAt || 0).getTime()
      return dateB - dateA
    })

    return NextResponse.json({
      success: true,
      extractions: summaries,
      count: summaries.length,
    })
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
