/**
 * API route for retrieving extraction results
 * GET /api/extractions/[id]
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/app/lib/auth"
import { prisma } from "@/app/lib/prisma"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const skipAuth = process.env.SKIP_AUTH === "true"
    let currentUserId: string | null = null

    if (!skipAuth) {
      try {
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
      } catch (authError) {
        console.error("Auth error:", authError)
        return NextResponse.json(
          { error: "Unauthorized", message: "Authentication failed" },
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

    // Use database directly for production reliability
    // Filter by userId to ensure extractions are confidential per user
    const extraction = await prisma.extraction.findFirst({
      where: {
        documentId: id,
        ...(currentUserId ? { userId: currentUserId } : {}),
      },
    })

    if (!extraction) {
      return NextResponse.json(
        { error: "Not found", message: "Extraction result not found" },
        { status: 404 }
      )
    }

    const { structuredData, ...meta } = extraction

    const result = {
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
    let currentUserId: string | null = null

    if (!skipAuth) {
      try {
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
      } catch (authError) {
        console.error("Auth error:", authError)
        return NextResponse.json(
          { error: "Unauthorized", message: "Authentication failed" },
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

    // Verify ownership before deletion
    if (currentUserId) {
      const extraction = await prisma.extraction.findFirst({
        where: { documentId: id, userId: currentUserId },
        select: { id: true },
      })
      if (!extraction) {
        return NextResponse.json(
          { error: "Not found", message: "Extraction result not found" },
          { status: 404 }
        )
      }
    }

    // Use database directly for production reliability
    // Only delete if user owns the extraction
    await prisma.$transaction([
      prisma.rawText.deleteMany({ where: { documentId: id } }),
      prisma.extraction.deleteMany({
        where: {
          documentId: id,
          ...(currentUserId ? { userId: currentUserId } : {}),
        },
      }),
    ])

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
