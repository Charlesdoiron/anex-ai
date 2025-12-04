import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/app/lib/auth"
import { promptService } from "@/app/lib/extraction/prompt-service"

async function requireAdmin(request: NextRequest) {
  const skipAuth = process.env.SKIP_AUTH === "true"
  if (skipAuth) {
    return { userId: "dev-user" }
  }

  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user?.id) {
    return null
  }

  // TODO: Add proper admin role check when roles are implemented
  // For now, all authenticated users can access admin endpoints
  return { userId: session.user.id }
}

/**
 * GET /api/admin/prompts
 * Get all prompts with their current state
 */
export async function GET(request: NextRequest) {
  const adminUser = await requireAdmin(request)
  if (!adminUser) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Authentication required" },
      { status: 401 }
    )
  }

  try {
    const prompts = await promptService.getAllPrompts()
    const sectionGroups = promptService.getSectionGroups()
    const testDocuments = await promptService.getAvailableTestDocuments()

    return NextResponse.json({
      prompts,
      sectionGroups,
      testDocuments,
    })
  } catch (error) {
    console.error("Failed to get prompts:", error)
    return NextResponse.json(
      {
        error: "fetch_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
