/**
 * API route for listing and searching extractions
 * GET /api/extractions
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/app/lib/auth"
import { extractionStorage } from "@/app/lib/extraction/storage-service"

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
      return NextResponse.json({
        success: true,
        data: results,
        count: results.length,
      })
    } else {
      const documentIds = await extractionStorage.listExtractions()
      return NextResponse.json({
        success: true,
        data: documentIds,
        count: documentIds.length,
      })
    }
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
