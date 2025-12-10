/**
 * Test complet de l'extraction et export Excel pour calcul de loyer
 * Utilise la nouvelle fonction d'export ExcelJS
 */
import { config } from "dotenv"
config({ path: ".env.local" })
config({ path: ".env" })

import * as fs from "fs"
import * as path from "path"
import { RentCalculationExtractionService } from "../app/lib/extraction/rent-calculation-service"
import { generateRentCalculationExcel } from "../app/components/extraction/utils/rent-calculation-excel-export"

const DATA_DIR = path.join(process.cwd(), "data")

async function main() {
  const fileName = process.argv[2] || "Bail sans difficulté particulière.pdf"
  const filePath = path.join(DATA_DIR, fileName)

  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`)
    console.log(`\nAvailable PDF files in ${DATA_DIR}:`)
    const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".pdf"))
    files.forEach((f) => console.log(`  - ${f}`))
    process.exit(1)
  }

  console.log(`\n📄 Processing: ${fileName}\n`)

  const buffer = fs.readFileSync(filePath)
  const service = new RentCalculationExtractionService((p) => {
    console.log(`[${Math.round(p.progress)}%] ${p.message}`)
  })

  const result = await service.extractAndCompute(buffer, fileName)

  console.log("\n=== EXTRACTED DATA ===")
  console.log("Calendar:")
  console.log(
    `  - Effective Date: ${result.extractedData.calendar.effectiveDate.value}`
  )
  console.log(
    `  - Signature Date: ${result.extractedData.calendar.signatureDate.value}`
  )
  console.log(`  - Duration: ${result.extractedData.calendar.duration.value}`)

  console.log("\nRent:")
  console.log(
    `  - Annual Rent: ${result.extractedData.rent.annualRentExclTaxExclCharges.value}`
  )
  console.log(
    `  - Quarterly Rent: ${result.extractedData.rent.quarterlyRentExclTaxExclCharges.value}`
  )
  console.log(
    `  - Payment Frequency: ${result.extractedData.rent.paymentFrequency.value}`
  )
  console.log(
    `  - Indexation Type: ${
      result.extractedData.indexation?.indexationType?.value ?? "—"
    }`
  )

  if (result.scheduleInput) {
    console.log("\n=== SCHEDULE INPUT ===")
    console.log(`  - Start Date: ${result.scheduleInput.startDate}`)
    console.log(`  - End Date: ${result.scheduleInput.endDate}`)
    console.log(`  - Base Index: ${result.scheduleInput.baseIndexValue}`)
    console.log(`  - Index Type: ${result.scheduleInput.indexType || "—"}`)
    console.log(`  - Office Rent/Period: ${result.scheduleInput.officeRentHT}`)
    console.log(
      `  - Parking Rent/Period: ${result.scheduleInput.parkingRentHT || 0}`
    )
    console.log(`  - Charges/Period: ${result.scheduleInput.chargesHT || 0}`)
    console.log(`  - Taxes/Period: ${result.scheduleInput.taxesHT || 0}`)
    console.log(
      `  - Franchise Months: ${result.scheduleInput.franchiseMonths || 0}`
    )
    console.log(
      `  - Deposit Months: ${result.scheduleInput.depositMonths || 0}`
    )
    console.log(
      `  - Charges Growth Rate: ${(result.scheduleInput.chargesGrowthRate || 0) * 100}%`
    )
  }

  if (result.rentSchedule) {
    console.log("\n=== SCHEDULE SUMMARY ===")
    console.log(`  - TCAM: ${result.rentSchedule.summary.tcam}`)
    console.log(`  - Deposit: ${result.rentSchedule.summary.depositHT}`)
    console.log(`  - Periods: ${result.rentSchedule.schedule.length}`)

    console.log("\n=== YEARLY TOTALS ===")
    for (const year of result.rentSchedule.summary.yearlyTotals) {
      console.log(
        `  ${year.year}: Base ${year.baseRentHT.toFixed(2)}€ | Charges ${year.chargesHT.toFixed(2)}€ | Taxes ${year.taxesHT.toFixed(2)}€ | Net ${year.netRentHT.toFixed(2)}€`
      )
    }

    // Vérifier quelques périodes
    console.log("\n=== FIRST 5 PERIODS ===")
    for (const period of result.rentSchedule.schedule.slice(0, 5)) {
      console.log(
        `  ${period.periodStart} → ${period.periodEnd}: Loyer ${period.officeRentHT.toFixed(2)}€ | Charges ${period.chargesHT.toFixed(2)}€ | Net ${period.netRentHT.toFixed(2)}€`
      )
    }
  }

  // Export to Excel
  console.log("\n=== EXPORTING TO EXCEL ===")

  const outputDir = path.join(DATA_DIR, "test-results")
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const outputPath = path.join(
    outputDir,
    `${fileName.replace(".pdf", "")}-calcul-loyer.xlsx`
  )

  try {
    const excelBuffer = await generateRentCalculationExcel(result)
    fs.writeFileSync(outputPath, excelBuffer)
    console.log(`✅ Excel export saved to: ${outputPath}`)
    console.log(`   - File size: ${(excelBuffer.length / 1024).toFixed(2)} KB`)
    console.log(`   - Success: ${result.metadata.extractionSuccess}`)
    console.log(`   - Schedule computed: ${result.metadata.scheduleSuccess}`)
    if (result.metadata.errorMessage) {
      console.log(`   - Error: ${result.metadata.errorMessage}`)
    }
  } catch (error) {
    console.error("❌ Error exporting to Excel:", error)
    if (error instanceof Error) {
      console.error("   Stack:", error.stack)
    }
  }
}

main().catch(console.error)
