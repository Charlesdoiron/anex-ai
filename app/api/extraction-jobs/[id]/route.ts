import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/app/lib/auth"
import { extractionJobService } from "@/app/lib/jobs/extraction-job-service"

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

    const { id: jobId } = await params
    const { searchParams } = new URL(request.url)
    const includeResult = searchParams.get("includeResult") === "true"

    const status = await extractionJobService.getJobStatus(jobId)

    if (!status) {
      return NextResponse.json(
        { error: "Not found", message: "Job non trouvé" },
        { status: 404 }
      )
    }

    let result = null
    if (includeResult && status.status === "completed") {
      result = await extractionJobService.getJobResult(jobId)
    }

    return NextResponse.json({
      success: true,
      ...status,
      result,
    })
  } catch (error) {
    console.error("Failed to get job status:", error)
    return NextResponse.json(
      {
        error: "Status fetch failed",
        message: error instanceof Error ? error.message : "Erreur inconnue",
      },
      { status: 500 }
    )
  }
}
