/**
 * Test script for rent calculation Excel export with mock data
 * Verifies the export structure matches client template
 */
import * as fs from "fs"
import * as path from "path"
import * as XLSX from "xlsx"
import type { RentCalculationResult } from "../app/lib/extraction/rent-calculation-service"
import type {
  ComputeLeaseRentScheduleResult,
  ComputeLeaseRentScheduleInput,
} from "../app/lib/lease/types"
import { computeLeaseRentSchedule } from "../app/lib/lease/rent-schedule-calculator"

const DATA_DIR = path.join(process.cwd(), "data")

// Mock extracted data matching client template example
function createMockResult(): RentCalculationResult {
  const startDate = "2024-03-06"
  const endDate = "2033-03-05"
  const baseIndexValue = 130.64

  // Known index points (from INSEE)
  const knownIndexPoints = [
    { effectiveDate: "2024-01-01", indexValue: 130.64 },
    { effectiveDate: "2024-04-01", indexValue: 131.2 },
    { effectiveDate: "2024-07-01", indexValue: 132.5 },
    { effectiveDate: "2024-10-01", indexValue: 133.8 },
    { effectiveDate: "2025-01-01", indexValue: 136.45 },
    { effectiveDate: "2025-04-01", indexValue: 136.8 },
    { effectiveDate: "2025-07-01", indexValue: 137.0 },
    { effectiveDate: "2025-10-01", indexValue: 137.15 },
    { effectiveDate: "2026-01-01", indexValue: 137.5 },
  ]

  const scheduleInput: ComputeLeaseRentScheduleInput = {
    startDate,
    endDate,
    paymentFrequency: "quarterly",
    baseIndexValue,
    knownIndexPoints,
    officeRentHT: 3000, // Quarterly office rent
    parkingRentHT: 500, // Quarterly parking rent
    chargesHT: 300, // Quarterly charges
    taxesHT: 200, // Quarterly taxes
    depositMonths: 3,
    franchiseMonths: 6,
    incentiveAmount: 4000,
    chargesGrowthRate: 0.02,
    horizonYears: 3,
  }

  const rentSchedule = computeLeaseRentSchedule(scheduleInput)

  return {
    documentId: "test_mock_001",
    fileName: "test-mock-bail.pdf",
    extractionDate: new Date().toISOString(),
    pageCount: 10,
    toolType: "calculation-rent",
    extractedData: {
      calendar: {
        effectiveDate: { value: startDate, confidence: "high" },
        signatureDate: { value: "2024-02-15", confidence: "high" },
        duration: { value: 9, confidence: "high" },
      },
      rent: {
        annualRentExclTaxExclCharges: { value: 12000, confidence: "high" },
        quarterlyRentExclTaxExclCharges: { value: 3000, confidence: "high" },
        annualParkingRentExclCharges: { value: 2000, confidence: "high" },
        paymentFrequency: { value: "quarterly", confidence: "high" },
      },
    },
    rentSchedule,
    scheduleInput,
    metadata: {
      processingTimeMs: 1000,
      retries: 0,
      extractionSuccess: true,
      scheduleSuccess: true,
    },
  }
}

async function main() {
  console.log("\n🧪 Testing rent calculation export with mock data\n")

  const result = createMockResult()

  console.log("=== MOCK DATA ===")
  console.log(`Start Date: ${result.scheduleInput?.startDate}`)
  console.log(`End Date: ${result.scheduleInput?.endDate}`)
  console.log(`Base Index: ${result.scheduleInput?.baseIndexValue}`)
  console.log(`Office Rent/Quarter: ${result.scheduleInput?.officeRentHT}`)
  console.log(`Parking Rent/Quarter: ${result.scheduleInput?.parkingRentHT}`)
  console.log(`Franchise Months: ${result.scheduleInput?.franchiseMonths}`)
  console.log(`Incentive Amount: ${result.scheduleInput?.incentiveAmount}`)

  console.log("\n=== SCHEDULE SUMMARY ===")
  if (result.rentSchedule) {
    console.log(
      `TCAM: ${(result.rentSchedule.summary.tcam! * 100).toFixed(4)}%`
    )
    console.log(
      `Deposit: ${result.rentSchedule.summary.depositHT.toFixed(2)} €`
    )
    console.log(`Total Periods: ${result.rentSchedule.schedule.length}`)

    console.log("\n=== YEARLY TOTALS ===")
    for (const year of result.rentSchedule.summary.yearlyTotals) {
      console.log(
        `  ${year.year}: ` +
          `Base ${year.baseRentHT.toFixed(2)} | ` +
          `Franchise ${year.franchiseHT.toFixed(2)} | ` +
          `Incentive ${year.incentivesHT.toFixed(2)} | ` +
          `Net ${year.netRentHT.toFixed(2)}`
      )
    }

    console.log("\n=== SCHEDULE DETAIL ===")
    for (const period of result.rentSchedule.schedule.slice(0, 8)) {
      console.log(
        `  ${period.periodStart} -> ${period.periodEnd}: ` +
          `Index ${period.indexValue.toFixed(2)} | ` +
          `Office ${period.officeRentHT.toFixed(2)} | ` +
          `Parking ${period.parkingRentHT.toFixed(2)} | ` +
          `Franchise ${period.franchiseHT.toFixed(2)} | ` +
          `Net ${period.netRentHT.toFixed(2)}`
      )
    }
    if (result.rentSchedule.schedule.length > 8) {
      console.log(
        `  ... and ${result.rentSchedule.schedule.length - 8} more periods`
      )
    }
  }

  // Export using our function
  console.log("\n=== EXPORTING TO EXCEL ===")

  // Create output directory
  const outputDir = path.join(DATA_DIR, "test-results")
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  // Import and call the export function (modifying it to write to a specific path)
  const { exportRentCalculationToExcel } = await import(
    "../app/components/extraction/utils/rent-calculation-excel-export"
  )

  // Since exportRentCalculationToExcel uses XLSX.writeFile directly,
  // we need to temporarily change process.cwd() or modify the function
  // For now, let's just call it and it will write to current directory
  const origCwd = process.cwd()
  process.chdir(outputDir)

  try {
    exportRentCalculationToExcel(result)
    console.log(
      `\n✅ Excel export saved to: ${outputDir}/test-mock-bail-echeancier.xlsx`
    )
  } finally {
    process.chdir(origCwd)
  }

  // Verify the output
  const outputPath = path.join(outputDir, "test-mock-bail-echeancier.xlsx")
  if (fs.existsSync(outputPath)) {
    const workbook = XLSX.readFile(outputPath)
    console.log(`\n=== EXCEL STRUCTURE ===`)
    console.log(`Sheets: ${workbook.SheetNames.join(", ")}`)

    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const range = XLSX.utils.decode_range(sheet["!ref"] || "A1")
    console.log(`Range: ${sheet["!ref"]}`)
    console.log(`Rows: ${range.e.r + 1}, Columns: ${range.e.c + 1}`)

    // Print first 20 rows
    console.log("\n=== CONTENT PREVIEW ===")
    for (let R = 0; R <= Math.min(range.e.r, 35); R++) {
      const rowData: string[] = []
      for (let C = 0; C <= Math.min(range.e.c, 10); C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C })
        const cell = sheet[addr]
        let val = cell ? String(cell.v ?? "") : ""
        if (val.length > 15) val = val.slice(0, 12) + "..."
        rowData.push(val.padEnd(15))
      }
      if (rowData.some((v) => v.trim() !== "")) {
        console.log(`R${String(R + 1).padStart(2)}: ${rowData.join(" | ")}`)
      }
    }
  }
}

main().catch(console.error)
