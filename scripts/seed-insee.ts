import { config } from "dotenv"
// Load .env.local first (overrides), then .env as fallback
config({ path: ".env.local" })
config({ path: ".env" })

import { prisma } from "../app/lib/prisma"
import {
  scrapeAllInseeRentalIndices,
  getConfiguredIndexTypes,
  type RentIndexPayload,
} from "../app/lib/insee/scrape-rental-index"
import type { LeaseIndexType } from "../app/lib/lease/types"

async function seedInsee() {
  try {
    // Check if data already exists
    const existingCount = await prisma.insee_rental_reference_index.count()
    if (existingCount > 0) {
      console.log(
        `INSEE data already exists (${existingCount} records). Skipping seed.`
      )
      console.log("To re-seed, delete existing records first.")
      return
    }

    const isLocalDev =
      process.env.NEXT_PUBLIC_APP_MODE === "test" ||
      process.env.SKIP_AUTH === "true" ||
      !process.env.VERCEL

    const configuredTypes = getConfiguredIndexTypes()

    if (configuredTypes.length === 0) {
      if (isLocalDev) {
        console.warn(
          "⚠️  No INSEE index URLs configured. Skipping INSEE seed for local development."
        )
        console.log(
          "   Set INSEE_ILAT_URL, INSEE_ILC_URL, or INSEE_ICC_URL to enable."
        )
        return
      }
      throw new Error(
        "No INSEE index URLs configured. Set INSEE_ILAT_URL, INSEE_ILC_URL, or INSEE_ICC_URL."
      )
    }

    console.log("Seeding INSEE rental reference indices...")
    console.log(`Configured index types: ${configuredTypes.join(", ")}`)
    console.log("")

    const { results, errors } = await scrapeAllInseeRentalIndices()

    let totalSeeded = 0

    for (const [indexType, payload] of Object.entries(results) as [
      LeaseIndexType,
      RentIndexPayload[],
    ][]) {
      if (payload.length > 0) {
        await prisma.insee_rental_reference_index.createMany({
          data: payload.map((item) => ({
            indexType: item.indexType,
            year: item.year,
            quarter: item.quarter,
            value: item.value,
            createdAt: item.createdAt ? new Date(item.createdAt) : undefined,
          })),
          skipDuplicates: true,
        })
        console.log(`  ✓ ${indexType}: ${payload.length} records`)
        totalSeeded += payload.length
      } else if (!errors[indexType]) {
        console.log(`  ○ ${indexType}: No data found`)
      }
    }

    // Report errors
    for (const [indexType, errorMsg] of Object.entries(errors)) {
      console.error(`  ✗ ${indexType}: ${errorMsg}`)
    }

    console.log("")
    console.log(`✅ Successfully seeded ${totalSeeded} INSEE records`)

    if (Object.keys(errors).length > 0) {
      console.warn(
        `⚠️  ${Object.keys(errors).length} index type(s) failed to scrape`
      )
    }
  } catch (error) {
    console.error("Failed to seed INSEE data:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

seedInsee()
