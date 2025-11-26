/**
 * Test script to run extraction on local PDF files
 * Usage: npx tsx scripts/test-extraction.ts [filename]
 *
 * Examples:
 *   npx tsx scripts/test-extraction.ts "Bail simple et court.pdf"
 *   npx tsx scripts/test-extraction.ts  # runs on first PDF in data/
 */

import * as fs from "fs"
import * as path from "path"
import { ExtractionService } from "../app/lib/extraction/extraction-service"
import type { LeaseExtractionResult } from "../app/lib/extraction/types"

const DATA_DIR = path.join(process.cwd(), "data")
const OUTPUT_DIR = path.join(process.cwd(), "data", "test-results")

async function main() {
  // Get filename from args or use first PDF in data/
  let fileName = process.argv[2]

  if (!fileName) {
    const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".pdf"))
    if (files.length === 0) {
      console.error("❌ No PDF files found in data/ folder")
      process.exit(1)
    }
    fileName = files[0]
    console.log(`📄 No file specified, using: ${fileName}`)
  }

  const filePath = path.join(DATA_DIR, fileName)

  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`)
    process.exit(1)
  }

  console.log(`\n🚀 Starting extraction for: ${fileName}`)
  console.log("─".repeat(60))

  const buffer = fs.readFileSync(filePath)

  const extractionService = new ExtractionService((progress) => {
    const bar = "█".repeat(Math.floor(progress.progress / 5))
    const empty = "░".repeat(20 - Math.floor(progress.progress / 5))
    console.log(`[${bar}${empty}] ${progress.progress}% - ${progress.message}`)
  })

  const startTime = Date.now()
  const result = await extractionService.extractFromPdf(buffer, fileName)
  const duration = ((Date.now() - startTime) / 1000).toFixed(1)

  console.log("\n" + "─".repeat(60))
  console.log("✅ EXTRACTION COMPLETE")
  console.log("─".repeat(60))

  printResults(result)

  // Save results
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  const outputPath = path.join(
    OUTPUT_DIR,
    fileName.replace(".pdf", "-extraction.json")
  )
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2))
  console.log(`\n📁 Full results saved to: ${outputPath}`)

  console.log(`\n⏱️  Total time: ${duration}s`)
}

function printResults(result: LeaseExtractionResult) {
  const { extractionMetadata: meta } = result

  console.log("\n📊 STATISTICS:")
  console.log(
    `   Extracted fields: ${meta.extractedFields}/${meta.totalFields}`
  )
  console.log(`   Missing fields: ${meta.missingFields}`)
  console.log(`   Low confidence: ${meta.lowConfidenceFields}`)
  console.log(
    `   Average confidence: ${(meta.averageConfidence * 100).toFixed(1)}%`
  )

  console.log("\n📋 KEY DATA EXTRACTED:")

  // Regime
  const regime = result.regime?.regime
  printField("Régime du bail", regime?.value, regime?.confidence)

  // Parties
  const landlord = result.parties?.landlord
  const tenant = result.parties?.tenant
  printField("Bailleur", landlord?.name?.value, landlord?.name?.confidence)
  printField("  - Email", landlord?.email?.value, landlord?.email?.confidence)
  printField(
    "  - Téléphone",
    landlord?.phone?.value,
    landlord?.phone?.confidence
  )
  printField("Preneur", tenant?.name?.value, tenant?.name?.confidence)
  printField("  - Email", tenant?.email?.value, tenant?.email?.confidence)
  printField("  - Téléphone", tenant?.phone?.value, tenant?.phone?.confidence)

  // Premises
  const premises = result.premises
  printField("Adresse", premises?.address?.value, premises?.address?.confidence)
  printField(
    "Surface (m²)",
    premises?.surfaceArea?.value,
    premises?.surfaceArea?.confidence
  )
  printField(
    "Destination",
    premises?.purpose?.value,
    premises?.purpose?.confidence
  )
  printField(
    "Parkings",
    premises?.parkingSpaces?.value,
    premises?.parkingSpaces?.confidence
  )

  // Calendar
  const calendar = result.calendar
  printField(
    "Date d'effet",
    calendar?.effectiveDate?.value,
    calendar?.effectiveDate?.confidence
  )
  printField(
    "Date de fin",
    calendar?.endDate?.value,
    calendar?.endDate?.confidence
  )
  printField(
    "Durée (ans)",
    calendar?.duration?.value,
    calendar?.duration?.confidence
  )

  // Rent
  const rent = result.rent
  printField(
    "Loyer annuel HT",
    formatCurrency(rent?.annualRentExclTaxExclCharges?.value),
    rent?.annualRentExclTaxExclCharges?.confidence
  )
  printField(
    "Loyer trimestriel HT",
    formatCurrency(rent?.quarterlyRentExclTaxExclCharges?.value),
    rent?.quarterlyRentExclTaxExclCharges?.confidence
  )
  printField(
    "Loyer/m²",
    formatCurrency(rent?.annualRentPerSqmExclTaxExclCharges?.value),
    rent?.annualRentPerSqmExclTaxExclCharges?.confidence
  )
  printField(
    "Fréquence paiement",
    rent?.paymentFrequency?.value,
    rent?.paymentFrequency?.confidence
  )

  // Indexation
  const indexation = result.indexation
  printField(
    "Type d'indice",
    indexation?.indexationType?.value,
    indexation?.indexationType?.confidence
  )
  printField(
    "Trimestre réf.",
    indexation?.referenceQuarter?.value,
    indexation?.referenceQuarter?.confidence
  )

  // Securities
  const securities = result.securities
  printField(
    "Dépôt de garantie",
    formatCurrency(securities?.securityDepositAmount?.value),
    securities?.securityDepositAmount?.confidence
  )

  // Charges
  const charges = result.charges
  printField(
    "Charges annuelles",
    formatCurrency(charges?.annualChargesProvisionExclTax?.value),
    charges?.annualChargesProvisionExclTax?.confidence
  )
}

function printField(label: string, value: unknown, confidence?: string): void {
  const confIcon =
    confidence === "high"
      ? "🟢"
      : confidence === "medium"
        ? "🟡"
        : confidence === "low"
          ? "🟠"
          : "⚪"

  const displayValue =
    value === null || value === undefined
      ? "–"
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value)

  console.log(`   ${confIcon} ${label}: ${displayValue}`)
}

function formatCurrency(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === "number") {
    return `${value.toLocaleString("fr-FR")} €`
  }
  return String(value)
}

main().catch((err) => {
  console.error("❌ Extraction failed:", err)
  process.exit(1)
})
