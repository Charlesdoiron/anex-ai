import { prisma } from "../app/lib/prisma"
import { scrapeInseeRentalIndex } from "../app/lib/insee/scrape-rental-index"

async function seedInsee() {
  try {
    // Check if data already exists
    const existingCount = await prisma.insee_rental_reference_index.count()
    if (existingCount > 0) {
      console.log(
        `INSEE data already exists (${existingCount} records). Skipping seed.`
      )
      return
    }

    const isLocalDev =
      process.env.NEXT_PUBLIC_APP_MODE === "test" ||
      process.env.SKIP_AUTH === "true" ||
      !process.env.VERCEL

    if (!process.env.INSEE_RENTAL_REFERENCE_INDEX_URL) {
      if (isLocalDev) {
        console.warn(
          "⚠️  INSEE_RENTAL_REFERENCE_INDEX_URL not set. Skipping INSEE seed for local development."
        )
        return
      }
      throw new Error("INSEE_RENTAL_REFERENCE_INDEX_URL is required")
    }

    console.log("Seeding INSEE rental reference index...")

    const payload = await scrapeInseeRentalIndex()

    await prisma.insee_rental_reference_index.createMany({
      data: payload.map((item) => ({
        year: item.year,
        quarter: item.quarter,
        value: item.value,
        createdAt: item.createdAt ? new Date(item.createdAt) : undefined,
      })),
    })

    console.log(`Successfully seeded ${payload.length} INSEE records`)
  } catch (error) {
    console.error("Failed to seed INSEE data:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

seedInsee()
