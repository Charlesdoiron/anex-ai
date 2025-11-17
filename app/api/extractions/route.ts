import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/app/lib/auth"
import { getUserExtractions } from "@/app/lib/queries"

export async function GET(req: NextRequest) {
  try {
    // Get user session
    const session = await auth.api.getSession({
      headers: req.headers,
    })

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const extractions = await getUserExtractions(session.user.id, 50)

    return NextResponse.json({ extractions })
  } catch (error) {
    console.error("Error fetching extractions:", error)
    return NextResponse.json(
      { error: "Failed to fetch extractions" },
      { status: 500 }
    )
  }
}
