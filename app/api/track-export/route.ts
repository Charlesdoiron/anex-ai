import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/app/lib/auth"
import { prisma } from "@/app/lib/prisma"

export async function POST(req: NextRequest) {
  try {
    // Get user session
    const session = await auth.api.getSession({
      headers: req.headers,
    })

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { format, messageCount } = await req.json()

    if (!format || !["pdf", "csv"].includes(format)) {
      return NextResponse.json(
        { error: "Invalid format. Must be 'pdf' or 'csv'" },
        { status: 400 }
      )
    }

    if (typeof messageCount !== "number" || messageCount < 0) {
      return NextResponse.json(
        { error: "Invalid messageCount" },
        { status: 400 }
      )
    }

    // Save export to database
    const exportRecord = await prisma.export.create({
      data: {
        userId: session.user.id,
        format,
        messageCount,
      },
    })

    console.log(
      `✅ Export tracked: ${format.toUpperCase()} with ${messageCount} messages for user ${session.user.id}`
    )

    return NextResponse.json(
      { success: true, id: exportRecord.id },
      { status: 200 }
    )
  } catch (error) {
    console.error("Export tracking error:", error)
    return NextResponse.json(
      {
        error: "Failed to track export",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
