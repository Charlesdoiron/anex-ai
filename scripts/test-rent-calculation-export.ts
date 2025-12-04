/**
 * Test script for rent calculation Excel export
 * Tests the export format against client template requirements
 */
import { config } from "dotenv"
config({ path: ".env.local" })
config({ path: ".env" })

import * as fs from "fs"
import * as path from "path"
import * as XLSX from "xlsx"
import { RentCalculationExtractionService } from "../app/lib/extraction/rent-calculation-service"

const DATA_DIR = path.join(process.cwd(), "data")

async function main() {
  const fileName = process.argv[2] || "Bail simple et court.pdf"
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
  }

  if (result.rentSchedule) {
    console.log("\n=== SCHEDULE SUMMARY ===")
    console.log(`  - TCAM: ${result.rentSchedule.summary.tcam}`)
    console.log(`  - Deposit: ${result.rentSchedule.summary.depositHT}`)
    console.log(`  - Periods: ${result.rentSchedule.schedule.length}`)

    console.log("\n=== YEARLY TOTALS ===")
    for (const year of result.rentSchedule.summary.yearlyTotals) {
      console.log(
        `  ${year.year}: Base ${year.baseRentHT.toFixed(2)} | Net ${year.netRentHT.toFixed(2)}`
      )
    }
  }

  // Export to Excel
  console.log("\n=== EXPORTING TO EXCEL ===")

  // We need to write manually since exportRentCalculationToExcel uses browser download
  const workbook = XLSX.utils.book_new()

  // Create output directory
  const outputDir = path.join(DATA_DIR, "test-results")
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const outputPath = path.join(
    outputDir,
    `${fileName.replace(".pdf", "")}-calcul-loyer.xlsx`
  )

  // Since buildClientTemplateExport is not exported, we'll create a simple workbook
  const sheet = createTestSheet(result)
  XLSX.utils.book_append_sheet(workbook, sheet, "Calcul loyer")
  XLSX.writeFile(workbook, outputPath)

  console.log(`✅ Excel export saved to: ${outputPath}`)
  console.log(`   - Success: ${result.metadata.extractionSuccess}`)
  console.log(`   - Schedule computed: ${result.metadata.scheduleSuccess}`)
  if (result.metadata.errorMessage) {
    console.log(`   - Error: ${result.metadata.errorMessage}`)
  }
}

function createTestSheet(
  result: Awaited<
    ReturnType<RentCalculationExtractionService["extractAndCompute"]>
  >
) {
  const data: (string | number | null)[][] = []

  data.push(["=== RÉSULTAT CALCUL LOYER ==="])
  data.push([])
  data.push(["Document", result.fileName])
  data.push(["Date extraction", result.extractionDate])
  data.push([])

  // Extracted data
  data.push(["=== DONNÉES EXTRAITES ==="])
  data.push([
    "Date d'effet",
    result.extractedData.calendar.effectiveDate.value || "—",
  ])
  data.push([
    "Durée (ans)",
    result.extractedData.calendar.duration.value || "—",
  ])
  data.push([
    "Loyer annuel",
    result.extractedData.rent.annualRentExclTaxExclCharges.value || "—",
  ])
  data.push([
    "Fréquence",
    result.extractedData.rent.paymentFrequency.value || "—",
  ])
  data.push([
    "Indice d'indexation",
    result.extractedData.indexation?.indexationType?.value || "—",
  ])
  data.push([])

  // Schedule
  if (result.rentSchedule) {
    data.push(["=== ÉCHÉANCIER ==="])
    data.push([
      "Période",
      "Début",
      "Fin",
      "Indice",
      "Loyer Bureaux",
      "Loyer Parking",
      "Charges",
      "Taxes",
      "Franchise",
      "Net HT",
    ])

    for (const period of result.rentSchedule.schedule) {
      data.push([
        period.quarter
          ? `T${period.quarter} ${period.year}`
          : `${period.month}/${period.year}`,
        period.periodStart,
        period.periodEnd,
        period.indexValue,
        period.officeRentHT,
        period.parkingRentHT,
        period.chargesHT,
        period.taxesHT,
        period.franchiseHT,
        period.netRentHT,
      ])
    }
  }

  return XLSX.utils.aoa_to_sheet(data)
}

main().catch(console.error)
