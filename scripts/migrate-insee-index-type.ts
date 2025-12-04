/**
 * Migration script to add indexType to existing INSEE rental index records
 * Sets all existing records to ILAT (default)
 */

import { config } from "dotenv"
config({ path: ".env.local" })
config({ path: ".env" })

import { prisma } from "../app/lib/prisma"

async function migrateInseeIndexType() {
  try {
    console.log("Checking existing data...")
    const existingCount = await prisma.insee_rental_reference_index.count()
    console.log(`Found ${existingCount} existing records`)

    if (existingCount === 0) {
      console.log("No existing data to migrate. Skipping.")
      return
    }

    // Check if indexType column exists (if migration hasn't been applied yet)
    // We'll use raw SQL to check and update
    console.log("\nMigrating existing records to indexType='ILAT'...")

    // First, check if column exists
    const result = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'insee_rental_reference_index' 
      AND column_name = 'indexType'
    `

    if (result.length === 0) {
      console.log("⚠️  indexType column doesn't exist yet.")
      console.log(
        "   Please run: npx prisma migrate dev --name add_index_type_to_insee"
      )
      console.log("   Then run this script again to migrate existing data.")
      return
    }

    // Update all existing records to ILAT
    const updated = await prisma.$executeRaw`
      UPDATE insee_rental_reference_index 
      SET "indexType" = 'ILAT' 
      WHERE "indexType" IS NULL OR "indexType" = ''
    `

    console.log(`✅ Updated ${updated} records to indexType='ILAT'`)

    // Verify
    const ilatCount = await prisma.insee_rental_reference_index.count({
      where: { indexType: "ILAT" },
    })
    console.log(`✅ Verified: ${ilatCount} records now have indexType='ILAT'`)
  } catch (error) {
    console.error("Migration failed:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

migrateInseeIndexType()
