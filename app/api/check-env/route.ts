import { NextResponse } from "next/server"
import { getEnvStatus } from "../../lib/env-check"

export async function GET() {
  const status = getEnvStatus()
  return NextResponse.json(status)
}
