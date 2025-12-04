import { NextResponse } from "next/server"
import { prisma } from "@/app/lib/prisma"

export async function GET() {
  const checks = {
    database: {
      connected: false,
      tables: {
        user: false,
        session: false,
        account: false,
        verification: false,
      },
    },
    environment: {
      BETTER_AUTH_SECRET: !!process.env.BETTER_AUTH_SECRET,
      BETTER_AUTH_URL: !!process.env.BETTER_AUTH_URL,
      NEXT_PUBLIC_APP_URL: !!process.env.NEXT_PUBLIC_APP_URL,
      DATABASE_URL: !!process.env.DATABASE_URL,
    },
  }

  try {
    await prisma.$connect()
    checks.database.connected = true

    try {
      await prisma.user.findFirst({ take: 1 })
      checks.database.tables.user = true
    } catch {
      checks.database.tables.user = false
    }

    try {
      await prisma.session.findFirst({ take: 1 })
      checks.database.tables.session = true
    } catch {
      checks.database.tables.session = false
    }

    try {
      await prisma.account.findFirst({ take: 1 })
      checks.database.tables.account = true
    } catch {
      checks.database.tables.account = false
    }

    try {
      await prisma.verification.findFirst({ take: 1 })
      checks.database.tables.verification = true
    } catch {
      checks.database.tables.verification = false
    }

    await prisma.$disconnect()
  } catch (error) {
    checks.database.connected = false
  }

  const allGood =
    checks.database.connected &&
    Object.values(checks.database.tables).every((v) => v) &&
    checks.environment.BETTER_AUTH_SECRET &&
    (checks.environment.BETTER_AUTH_URL ||
      checks.environment.NEXT_PUBLIC_APP_URL)

  return NextResponse.json(
    {
      status: allGood ? "ok" : "issues",
      checks,
      message: allGood
        ? "All checks passed"
        : "Some checks failed. See details below.",
    },
    { status: allGood ? 200 : 500 }
  )
}
