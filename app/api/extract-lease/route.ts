/**
 * API route for lease document extraction with streaming progress
 * POST /api/extract-lease
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/app/lib/auth"
import { ExtractionService } from "@/app/lib/extraction/extraction-service"
import { extractionStorage } from "@/app/lib/extraction/storage-service"
import type {
  ExtractionProgress,
  LeaseExtractionResult,
} from "@/app/lib/extraction/types"

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const ALLOWED_MIME_TYPES = ["application/pdf"]

export async function POST(request: NextRequest) {
  try {
    const skipAuth = process.env.SKIP_AUTH === "true"
    let userId: string | undefined

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
      userId = session.user.id
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json(
        { error: "No file provided", message: "Please upload a PDF file" },
        { status: 400 }
      )
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: "Invalid file type",
          message: "Only PDF files are supported",
        },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: "File too large",
          message: `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        },
        { status: 400 }
      )
    }

    console.log(`🚀 Starting extraction for file: ${file.name}`)

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const stream = formData.get("stream") === "true"

    if (stream) {
      return handleStreamingExtraction(buffer, file.name, userId)
    } else {
      return handleSyncExtraction(buffer, file.name, userId)
    }
  } catch (error) {
    console.error("Extraction API error:", error)
    return NextResponse.json(
      {
        error: "Extraction failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

async function handleSyncExtraction(
  buffer: Buffer,
  fileName: string,
  userId?: string
) {
  const extractionService = new ExtractionService()
  const result = await extractionService.extractFromPdf(buffer, fileName)

  await extractionStorage.saveExtraction(result)

  return NextResponse.json({
    success: true,
    data: result,
  })
}

async function handleStreamingExtraction(
  buffer: Buffer,
  fileName: string,
  userId?: string
) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const progressCallback = (progress: ExtractionProgress) => {
        const data = `data: ${JSON.stringify(progress)}\n\n`
        controller.enqueue(encoder.encode(data))
      }

      const partialResultCallback = (
        partialResult: Partial<LeaseExtractionResult>
      ) => {
        const data = `data: ${JSON.stringify({
          type: "partial_result",
          result: partialResult,
        })}\n\n`
        controller.enqueue(encoder.encode(data))
      }

      try {
        const extractionService = new ExtractionService(
          progressCallback,
          partialResultCallback
        )
        const result = await extractionService.extractFromPdf(buffer, fileName)

        await extractionStorage.saveExtraction(result)

        const finalData = `data: ${JSON.stringify({
          type: "final_result",
          status: "completed",
          message: "Extraction terminée",
          progress: 100,
          result,
        })}\n\n`
        controller.enqueue(encoder.encode(finalData))
      } catch (error) {
        const errorData = `data: ${JSON.stringify({
          status: "failed",
          message: "Échec de l'extraction",
          progress: 0,
          error: error instanceof Error ? error.message : "Unknown error",
        })}\n\n`
        controller.enqueue(encoder.encode(errorData))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
