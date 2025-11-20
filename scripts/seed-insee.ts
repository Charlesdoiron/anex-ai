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
