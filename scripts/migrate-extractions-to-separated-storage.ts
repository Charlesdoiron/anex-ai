// Script de migration : sépare le rawText des données structurées
// Usage: npm run migrate:extractions

import fs from "fs/promises"
import path from "path"
import type { LeaseExtractionResult } from "../app/lib/extraction/types"

const STORAGE_DIR = path.join(process.cwd(), "storage", "extractions")
const RAW_TEXT_DIR = path.join(STORAGE_DIR, "raw-text")
const BACKUP_DIR = path.join(STORAGE_DIR, "backup")

async function migrateExtractions() {
  console.log("🚀 Starting migration...")

  await fs.mkdir(RAW_TEXT_DIR, { recursive: true })
  await fs.mkdir(BACKUP_DIR, { recursive: true })

  const files = await fs.readdir(STORAGE_DIR)
  const jsonFiles = files.filter((f) => f.endsWith(".json"))

  console.log(`📁 Found ${jsonFiles.length} extraction files`)

  let migrated = 0
  let skipped = 0
  let errors = 0

  for (const file of jsonFiles) {
    const filePath = path.join(STORAGE_DIR, file)
    const documentId = file.replace(".json", "")

    try {
      const content = await fs.readFile(filePath, "utf-8")
      const extraction = JSON.parse(content) as LeaseExtractionResult

      if (!extraction.rawText) {
        console.log(`⏭️  Skipping ${documentId} (no rawText)`)
        skipped++
        continue
      }

      await fs.copyFile(filePath, path.join(BACKUP_DIR, file))

      const rawTextPath = path.join(RAW_TEXT_DIR, `${documentId}.txt`)
      await fs.writeFile(rawTextPath, extraction.rawText, "utf-8")

      const { rawText, ...structuredData } = extraction
      await fs.writeFile(
        filePath,
        JSON.stringify(structuredData, null, 2),
        "utf-8"
      )

      console.log(`✅ Migrated ${documentId}`)
      migrated++
    } catch (error) {
      console.error(`❌ Error migrating ${documentId}:`, error)
      errors++
    }
  }

  console.log("\n📊 Migration complete:")
  console.log(`  ✅ Migrated: ${migrated}`)
  console.log(`  ⏭️  Skipped: ${skipped}`)
  console.log(`  ❌ Errors: ${errors}`)
  console.log(`\n💾 Backups saved to: ${BACKUP_DIR}`)
}

migrateExtractions().catch(console.error)
