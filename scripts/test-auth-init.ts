#!/usr/bin/env tsx

/**
 * Test better-auth initialization with production database
 * Usage:
 *   DATABASE_URL="..." BETTER_AUTH_SECRET="..." BETTER_AUTH_URL="..." tsx scripts/test-auth-init.ts
 */

import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { PrismaClient } from "@prisma/client"

const DATABASE_URL = process.env.DATABASE_URL
const BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET
const BETTER_AUTH_URL =
  process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is required")
  process.exit(1)
}

if (!BETTER_AUTH_SECRET) {
  console.error("❌ BETTER_AUTH_SECRET is required")
  process.exit(1)
}

console.log("🔍 Testing better-auth initialization...\n")
console.log(`DATABASE_URL: ${DATABASE_URL.replace(/:[^:@]+@/, ":****@")}`)
console.log(`BETTER_AUTH_URL: ${BETTER_AUTH_URL || "not set"}`)
console.log(
  `BETTER_AUTH_SECRET: ${BETTER_AUTH_SECRET ? "***set***" : "not set"}\n`
)

try {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: DATABASE_URL,
      },
    },
  })

  console.log("1. Testing Prisma connection...")
  await prisma.$connect()
  console.log("   ✅ Prisma connected\n")

  console.log("2. Testing database tables...")
  const userCount = await prisma.user.count()
  const sessionCount = await prisma.session.count()
  const accountCount = await prisma.account.count()
  const verificationCount = await prisma.verification.count()
  console.log(`   ✅ Tables accessible:`)
  console.log(`      - user: ${userCount} records`)
  console.log(`      - session: ${sessionCount} records`)
  console.log(`      - account: ${accountCount} records`)
  console.log(`      - verification: ${verificationCount} records\n`)

  console.log("3. Initializing better-auth...")
  const auth = betterAuth({
    database: prismaAdapter(prisma, {
      provider: "postgresql",
    }),
    emailAndPassword: {
      enabled: true,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    baseURL: BETTER_AUTH_URL,
    secret: BETTER_AUTH_SECRET,
  })
  console.log("   ✅ Better-auth initialized\n")

  console.log("4. Testing auth API...")
  const testRequest = new Request("https://example.com/api/auth/session", {
    method: "GET",
  })

  try {
    const response = await auth.api.getSession({
      headers: testRequest.headers,
    })
    console.log(
      `   ✅ Auth API accessible (session: ${response ? "exists" : "none"})\n`
    )
  } catch (apiError) {
    console.log(
      `   ⚠️  Auth API test (expected for no session): ${apiError instanceof Error ? apiError.message : String(apiError)}\n`
    )
  }

  console.log("✅ All tests passed! Better-auth is configured correctly.\n")

  await prisma.$disconnect()
} catch (error) {
  console.error("❌ Error during initialization:")
  console.error(error)
  if (error instanceof Error) {
    console.error("\nStack trace:")
    console.error(error.stack)
  }
  process.exit(1)
}
