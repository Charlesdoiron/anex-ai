/**
 * API route for retrieving extraction results
 * GET /api/extractions/[id]
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/app/lib/auth"
import { extractionStorage } from "@/app/lib/extraction/storage-service"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: "Missing ID", message: "Document ID is required" },
        { status: 400 }
      )
    }

    const result = await extractionStorage.getExtraction(id)

    if (!result) {
      return NextResponse.json(
        { error: "Not found", message: "Extraction result not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error("Failed to retrieve extraction:", error)
    return NextResponse.json(
      {
        error: "Retrieval failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: "Missing ID", message: "Document ID is required" },
        { status: 400 }
      )
    }

    await extractionStorage.deleteExtraction(id)

    return NextResponse.json({
      success: true,
      message: "Extraction deleted successfully",
    })
  } catch (error) {
    console.error("Failed to delete extraction:", error)
    return NextResponse.json(
      {
        error: "Deletion failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
