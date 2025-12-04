#!/usr/bin/env tsx

/**
 * Script to check migration status and optionally apply pending migrations
 * Usage:
 *   DATABASE_URL="postgresql://..." tsx scripts/check-migrations.ts
 *   DATABASE_URL="postgresql://..." tsx scripts/check-migrations.ts --apply
 */

import { execSync } from "child_process"

const DATABASE_URL = process.env.DATABASE_URL
const shouldApply = process.argv.includes("--apply")

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is required")
  console.error("\nUsage:")
  console.error(
    '  DATABASE_URL="postgresql://user:pass@host:port/db" tsx scripts/check-migrations.ts'
  )
  console.error(
    '  DATABASE_URL="postgresql://user:pass@host:port/db" tsx scripts/check-migrations.ts --apply'
  )
  process.exit(1)
}

const maskedUrl = DATABASE_URL.replace(/:[^:@]+@/, ":****@")
console.log(`🔍 Checking migration status for: ${maskedUrl}\n`)

try {
  const statusOutput = execSync("npx prisma migrate status", {
    encoding: "utf-8",
    env: { ...process.env, DATABASE_URL },
    stdio: "pipe",
  })

  console.log(statusOutput)

  if (statusOutput.includes("Database schema is up to date")) {
    console.log("\n✅ All migrations are applied!")
    process.exit(0)
  }

  if (statusOutput.includes("migrations have not yet been applied")) {
    console.log("\n⚠️  Pending migrations detected!")

    if (shouldApply) {
      console.log("\n🚀 Applying migrations...\n")
      try {
        const deployOutput = execSync("npx prisma migrate deploy", {
          encoding: "utf-8",
          env: { ...process.env, DATABASE_URL },
          stdio: "inherit",
        })
        console.log("\n✅ Migrations applied successfully!")
        process.exit(0)
      } catch (deployError) {
        console.error("\n❌ Failed to apply migrations:")
        console.error(deployError)
        process.exit(1)
      }
    } else {
      console.log("\n📋 To apply migrations, run:")
      console.log(
        `   DATABASE_URL="${maskedUrl}" tsx scripts/check-migrations.ts --apply`
      )
      console.log("\nOr directly:")
      console.log(`   DATABASE_URL="${maskedUrl}" npx prisma migrate deploy`)
      process.exit(1)
    }
  }
} catch (error) {
  const errorOutput = error instanceof Error ? error.message : String(error)

  if (
    errorOutput.includes("ECONNREFUSED") ||
    errorOutput.includes("connection")
  ) {
    console.error("❌ Cannot connect to database. Check your DATABASE_URL:")
    console.error(`   ${maskedUrl}`)
    process.exit(1)
  }

  console.error("❌ Error checking migrations:")
  console.error(errorOutput)
  process.exit(1)
}
