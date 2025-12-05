import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/app/lib/auth"
import { extractionJobService } from "@/app/lib/jobs/extraction-job-service"
import { rateLimiter, EXTRACTION_JOB_LIMITS } from "@/app/lib/rate-limit"
import type { toolType } from "@/app/static-data/agent"

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const VALID_TOOL_TYPES: toolType[] = ["extraction-lease", "calculation-rent"]

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

    const forwardedFor = request.headers
      .get("x-forwarded-for")
      ?.split(",")[0]
      ?.trim()
    const rateLimitKey = userId ?? forwardedFor ?? "anonymous"
    const rateLimitResult = rateLimiter.check(
      rateLimitKey,
      EXTRACTION_JOB_LIMITS
    )

    if (!rateLimitResult.allowed) {
      const retryAfter = String(rateLimitResult.resetInSeconds ?? 60)
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: rateLimitResult.reason,
          resetInSeconds: rateLimitResult.resetInSeconds,
        },
        { status: 429, headers: { "Retry-After": retryAfter } }
      )
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const toolTypeParam = formData.get("toolType") as string | null

    if (!file) {
      return NextResponse.json(
        { error: "No file", message: "Aucun fichier fourni" },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: "File too large",
          message: "Fichier trop volumineux (max 50MB)",
        },
        { status: 400 }
      )
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        {
          error: "Invalid file type",
          message: "Seuls les fichiers PDF sont acceptés",
        },
        { status: 400 }
      )
    }

    const toolType: toolType =
      toolTypeParam && VALID_TOOL_TYPES.includes(toolTypeParam as toolType)
        ? (toolTypeParam as toolType)
        : "extraction-lease"

    const duplicateCheck = await extractionJobService.checkForDuplicate(
      file.name,
      file.size,
      userId,
      toolType
    )

    if (duplicateCheck.isDuplicate) {
      return NextResponse.json(
        {
          error: "Duplicate job",
          message:
            duplicateCheck.message ||
            "Un job identique est déjà en cours de traitement",
          existingJobId: duplicateCheck.existingJobId,
        },
        { status: 409 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    const jobId = await extractionJobService.createJob({
      fileName: file.name,
      fileData: buffer,
      userId,
      toolType,
    })

    return NextResponse.json({
      success: true,
      jobId,
      toolType,
      message: "Job créé avec succès",
    })
  } catch (error) {
    console.error("Failed to create extraction job:", error)
    return NextResponse.json(
      {
        error: "Job creation failed",
        message: error instanceof Error ? error.message : "Erreur inconnue",
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
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

    if (!userId) {
      return NextResponse.json({
        success: true,
        jobs: [],
        count: 0,
      })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get("limit") || "20", 10)
    const toolTypeParam = searchParams.get("toolType")
    const filterToolType =
      toolTypeParam && VALID_TOOL_TYPES.includes(toolTypeParam as toolType)
        ? (toolTypeParam as toolType)
        : undefined

    const jobs = await extractionJobService.listUserJobs(
      userId,
      limit,
      filterToolType
    )

    return NextResponse.json({
      success: true,
      jobs,
      count: jobs.length,
    })
  } catch (error) {
    console.error("Failed to list extraction jobs:", error)
    return NextResponse.json(
      {
        error: "Listing failed",
        message: error instanceof Error ? error.message : "Erreur inconnue",
      },
      { status: 500 }
    )
  }
}
