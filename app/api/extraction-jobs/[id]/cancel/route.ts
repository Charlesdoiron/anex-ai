import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/app/lib/auth"
import { extractionJobService } from "@/app/lib/jobs/extraction-job-service"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: jobId } = await params

    await extractionJobService.requestCancellation(jobId, userId)

    return NextResponse.json({
      success: true,
      status: "cancelled",
      message: "Extraction annulée",
      jobId,
    })
  } catch (error) {
    console.error("Failed to cancel extraction job:", error)
    return NextResponse.json(
      {
        error: "Cancellation failed",
        message: error instanceof Error ? error.message : "Erreur inconnue",
      },
      { status: 400 }
    )
  }
}
