#!/usr/bin/env tsx

import { PrismaClient } from "@prisma/client"

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is required")
  process.exit(1)
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL,
    },
  },
})

async function checkTables() {
  try {
    console.log("🔍 Checking auth tables in production database...\n")

    const tables = ["user", "session", "account", "verification"]
    const results: Record<string, boolean> = {}

    for (const table of tables) {
      try {
        if (table === "user") {
          await prisma.user.findFirst({ take: 1 })
          results[table] = true
        } else if (table === "session") {
          await prisma.session.findFirst({ take: 1 })
          results[table] = true
        } else if (table === "account") {
          await prisma.account.findFirst({ take: 1 })
          results[table] = true
        } else if (table === "verification") {
          await prisma.verification.findFirst({ take: 1 })
          results[table] = true
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        if (
          errorMsg.includes("does not exist") ||
          errorMsg.includes("Unknown model")
        ) {
          results[table] = false
        } else {
          results[table] = true
        }
      }
    }

    console.log("Table status:")
    for (const [table, exists] of Object.entries(results)) {
      console.log(`  ${exists ? "✅" : "❌"} ${table}`)
    }

    const missingTables = Object.entries(results)
      .filter(([, exists]) => !exists)
      .map(([table]) => table)

    if (missingTables.length > 0) {
      console.log(`\n⚠️  Missing tables: ${missingTables.join(", ")}`)
      console.log("\n📋 You need to apply the auth migrations:")
      console.log(
        "   Migration: 20251113152058_better_auth (creates account and verification tables)"
      )
      process.exit(1)
    } else {
      console.log("\n✅ All auth tables exist!")
    }
  } catch (error) {
    console.error("❌ Error checking tables:")
    console.error(error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

checkTables()
