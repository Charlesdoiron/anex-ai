#!/usr/bin/env tsx

import "dotenv/config"
import { validateEnv } from "../app/lib/env-check"

try {
  validateEnv()
  console.log("✅ All required environment variables are present")
  process.exit(0)
} catch (error) {
  console.error("❌ Environment validation failed:")
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
