import { auth } from "@/app/lib/auth"
import { toNextJsHandler } from "better-auth/next-js"
import { NextRequest, NextResponse } from "next/server"

const handlers = toNextJsHandler(auth)

async function handleRequest(
  handler: (req: NextRequest) => Promise<Response>,
  req: NextRequest
) {
  try {
    return await handler(req)
  } catch (error) {
    console.error("Auth handler error:", error)
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error"
    const errorStack = error instanceof Error ? error.stack : undefined

    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          process.env.NODE_ENV === "development" ? errorMessage : undefined,
        stack: process.env.NODE_ENV === "development" ? errorStack : undefined,
      },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  return handleRequest(handlers.GET, req)
}

export async function POST(req: NextRequest) {
  return handleRequest(handlers.POST, req)
}
