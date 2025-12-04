import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/app/lib/auth"
import { promptService } from "@/app/lib/extraction/prompt-service"
import type { ExtractionSection } from "@/app/lib/extraction/types"

async function requireAdmin(request: NextRequest) {
  const skipAuth = process.env.SKIP_AUTH === "true"
  if (skipAuth) {
    return { userId: "dev-user" }
  }

  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user?.id) {
    return null
  }

  return { userId: session.user.id }
}

type RouteParams = { params: Promise<{ section: string }> }

/**
 * GET /api/admin/prompts/[section]
 * Get a specific prompt by section
 */
export async function GET(request: NextRequest, context: RouteParams) {
  const adminUser = await requireAdmin(request)
  if (!adminUser) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Authentication required" },
      { status: 401 }
    )
  }

  const { section } = await context.params

  try {
    const prompt = await promptService.getPrompt(
      section as ExtractionSection | "system"
    )

    if (!prompt) {
      return NextResponse.json(
        { error: "not_found", message: `Section '${section}' not found` },
        { status: 404 }
      )
    }

    return NextResponse.json(prompt)
  } catch (error) {
    console.error(`Failed to get prompt for section ${section}:`, error)
    return NextResponse.json(
      {
        error: "fetch_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/prompts/[section]
 * Update a prompt for a specific section
 */
export async function PUT(request: NextRequest, context: RouteParams) {
  const adminUser = await requireAdmin(request)
  if (!adminUser) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Authentication required" },
      { status: 401 }
    )
  }

  const { section } = await context.params

  try {
    const body = await request.json()
    const { prompt } = body

    if (typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: "invalid_input", message: "Prompt content is required" },
        { status: 400 }
      )
    }

    const updated = await promptService.updatePrompt(
      section as ExtractionSection | "system",
      prompt.trim(),
      adminUser.userId
    )

    return NextResponse.json({
      success: true,
      prompt: updated,
    })
  } catch (error) {
    console.error(`Failed to update prompt for section ${section}:`, error)
    return NextResponse.json(
      {
        error: "update_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/prompts/[section]
 * Reset a prompt to its default value
 */
export async function DELETE(request: NextRequest, context: RouteParams) {
  const adminUser = await requireAdmin(request)
  if (!adminUser) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Authentication required" },
      { status: 401 }
    )
  }

  const { section } = await context.params

  try {
    const reset = await promptService.resetPrompt(
      section as ExtractionSection | "system"
    )

    return NextResponse.json({
      success: true,
      prompt: reset,
    })
  } catch (error) {
    console.error(`Failed to reset prompt for section ${section}:`, error)
    return NextResponse.json(
      {
        error: "reset_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
