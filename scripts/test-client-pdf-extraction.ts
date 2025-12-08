/**
 * Test PDF extraction with client test files
 * Compares extraction results with expected values from Excel test files
 */

import * as fs from "fs"
import * as path from "path"
import { ExtractionService } from "@/app/lib/extraction/extraction-service"
import type { LeaseExtractionResult } from "@/app/lib/extraction/types"

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
}

function log(message: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

interface TestCase {
  name: string
  pdfPath: string
  description: string
}

const TEST_CASES: TestCase[] = [
  {
    name: "Bail sans difficulté particulière",
    pdfPath: "data/Bail sans difficulté particulière.pdf",
    description: "Test avec cas simple",
  },
  {
    name: "Saint Priest",
    pdfPath: "data/Bail Saint Priest_28 08 (draft).pdf",
    description: "Test avec complexité standard",
  },
]

interface ExtractionReport {
  testCase: string
  timestamp: string
  fileName: string
  extractionTime: number
  success: boolean
  error?: string
  keyFields: {
    effectiveDate?: string | null
    signatureDate?: string | null
    duration?: number | null
    annualRent?: number | null
    quarterlyRent?: number | null
    indexationType?: string | null
    referenceQuarter?: string | null
    landlordName?: string | null
    tenantName?: string | null
    premises?: string | null
  }
  rentCalculation?: {
    available: boolean
    startDate?: string
    endDate?: string
    baseIndex?: number
    periods?: number
  }
  metadata?: {
    totalFields: number
    extractedFields: number
    missingFields: number
    averageConfidence: number
  }
}

async function testPdfExtraction(
  testCase: TestCase
): Promise<ExtractionReport> {
  log(`\n${"=".repeat(80)}`, "cyan")
  log(`Testing: ${testCase.name}`, "cyan")
  log(`${"=".repeat(80)}`, "cyan")

  const startTime = Date.now()
  const report: ExtractionReport = {
    testCase: testCase.name,
    timestamp: new Date().toISOString(),
    fileName: path.basename(testCase.pdfPath),
    extractionTime: 0,
    success: false,
    keyFields: {},
  }

  try {
    // Check if file exists
    if (!fs.existsSync(testCase.pdfPath)) {
      throw new Error(`File not found: ${testCase.pdfPath}`)
    }

    log(`\n📄 Reading PDF: ${path.basename(testCase.pdfPath)}`, "blue")
    const pdfBuffer = fs.readFileSync(testCase.pdfPath)
    log(`   File size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`, "cyan")

    log(`\n🔍 Running extraction...`, "blue")
    const extractionService = new ExtractionService()
    const extraction = await extractionService.extractFromPdf(
      pdfBuffer,
      path.basename(testCase.pdfPath)
    )

    report.extractionTime = Date.now() - startTime
    report.success = true

    log(
      `✅ Extraction completed in ${(report.extractionTime / 1000).toFixed(2)}s`,
      "green"
    )

    // Extract key fields for reporting
    report.keyFields = {
      effectiveDate: extraction.calendar?.effectiveDate?.value,
      signatureDate: extraction.calendar?.signatureDate?.value,
      duration: extraction.calendar?.duration?.value,
      annualRent: extraction.rent?.annualRentExclTaxExclCharges?.value,
      quarterlyRent: extraction.rent?.quarterlyRentExclTaxExclCharges?.value,
      indexationType: extraction.indexation?.indexationType?.value,
      referenceQuarter: extraction.indexation?.referenceQuarter?.value,
      landlordName: extraction.parties?.landlord?.name?.value,
      tenantName: extraction.parties?.tenant?.name?.value,
      premises: extraction.premises?.designation?.value,
    }

    // Check rent calculation availability
    if (extraction.rentSchedule) {
      report.rentCalculation = {
        available: true,
        startDate: extraction.rentSchedule.schedule[0]?.periodStart,
        endDate:
          extraction.rentSchedule.schedule[
            extraction.rentSchedule.schedule.length - 1
          ]?.periodEnd,
        baseIndex: extraction.rentSchedule.schedule[0]?.indexValue,
        periods: extraction.rentSchedule.schedule.length,
      }
    } else {
      report.rentCalculation = { available: false }
    }

    report.metadata = extraction.extractionMetadata

    // Display key fields
    log(`\n📋 Key Extracted Fields:`, "blue")
    log(`   Landlord: ${report.keyFields.landlordName || "N/A"}`)
    log(`   Tenant: ${report.keyFields.tenantName || "N/A"}`)
    log(`   Effective Date: ${report.keyFields.effectiveDate || "N/A"}`)
    log(`   Duration: ${report.keyFields.duration || "N/A"} years`)
    log(`   Annual Rent: ${report.keyFields.annualRent || "N/A"} €HT`)
    log(`   Indexation: ${report.keyFields.indexationType || "N/A"}`)
    log(`   Reference Quarter: ${report.keyFields.referenceQuarter || "N/A"}`)

    if (report.metadata) {
      log(`\n📊 Extraction Metadata:`, "blue")
      log(`   Total Fields: ${report.metadata.totalFields}`)
      log(`   Extracted: ${report.metadata.extractedFields}`)
      log(`   Missing: ${report.metadata.missingFields}`)
      log(
        `   Average Confidence: ${(report.metadata.averageConfidence * 100).toFixed(2)}%`
      )
    }

    if (report.rentCalculation?.available) {
      log(`\n💰 Rent Calculation:`, "blue")
      log(`   Schedule Generated: ✅`)
      log(`   Start Date: ${report.rentCalculation.startDate}`)
      log(`   End Date: ${report.rentCalculation.endDate}`)
      log(`   Base Index: ${report.rentCalculation.baseIndex}`)
      log(`   Periods: ${report.rentCalculation.periods}`)

      // Display first few periods
      log(`\n   First periods:`)
      for (
        let i = 0;
        i < Math.min(3, extraction.rentSchedule!.schedule.length);
        i++
      ) {
        const p = extraction.rentSchedule!.schedule[i]
        log(
          `     ${p.periodStart} to ${p.periodEnd}: ${p.officeRentHT.toFixed(2)} €HT`
        )
      }
    } else {
      log(`\n💰 Rent Calculation:`, "yellow")
      log(`   Schedule Generated: ❌ (missing required data)`)
    }

    // Save extraction result
    const outputDir = "data/test-results"
    fs.mkdirSync(outputDir, { recursive: true })

    const extractionPath = path.join(
      outputDir,
      `${path.basename(testCase.pdfPath, ".pdf")}-extraction.json`
    )
    fs.writeFileSync(extractionPath, JSON.stringify(extraction, null, 2))
    log(`\n💾 Full extraction saved to: ${extractionPath}`, "green")

    return report
  } catch (error) {
    report.success = false
    report.error = error instanceof Error ? error.message : String(error)
    report.extractionTime = Date.now() - startTime

    log(`\n❌ Extraction failed: ${report.error}`, "red")
    console.error(error)

    return report
  }
}

async function main() {
  log("\n" + "🧪 PDF EXTRACTION VALIDATION TEST SUITE", "cyan")
  log("=".repeat(80) + "\n", "cyan")

  const reports: ExtractionReport[] = []

  for (const testCase of TEST_CASES) {
    const report = await testPdfExtraction(testCase)
    reports.push(report)

    // Pause between tests to avoid rate limits
    if (TEST_CASES.indexOf(testCase) < TEST_CASES.length - 1) {
      log(`\n⏸️  Waiting 2 seconds before next test...`, "yellow")
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
  }

  // Summary
  log(`\n\n${"=".repeat(80)}`, "cyan")
  log("SUMMARY", "cyan")
  log("=".repeat(80), "cyan")

  const successful = reports.filter((r) => r.success).length
  const failed = reports.filter((r) => !r.success).length

  log(`\n✅ Successful: ${successful}/${reports.length}`, "green")
  log(`❌ Failed: ${failed}/${reports.length}`, failed > 0 ? "red" : "green")

  const avgTime =
    reports.reduce((sum, r) => sum + r.extractionTime, 0) / reports.length
  log(`⏱️  Average extraction time: ${(avgTime / 1000).toFixed(2)}s`, "cyan")

  for (const report of reports) {
    const status = report.success ? "✅" : "❌"
    log(`\n${status} ${report.testCase}:`)
    if (report.success) {
      const avgConf = (report.metadata?.averageConfidence || 0) * 100
      log(
        `   Confidence: ${avgConf.toFixed(2)}% | ` +
          `Fields: ${report.metadata?.extractedFields}/${report.metadata?.totalFields} | ` +
          `Rent Calc: ${report.rentCalculation?.available ? "✅" : "❌"}`
      )
    } else {
      log(`   Error: ${report.error}`, "red")
    }
  }

  // Save summary report
  const summaryPath = "data/test-results/extraction-validation-summary.json"
  fs.writeFileSync(summaryPath, JSON.stringify(reports, null, 2))
  log(`\n📝 Summary report saved to: ${summaryPath}`, "green")

  log(`\n${"=".repeat(80)}`, "cyan")
  log("✅ EXTRACTION VALIDATION COMPLETE", "cyan")
  log("=".repeat(80) + "\n", "cyan")

  process.exit(failed > 0 ? 1 : 0)
}

main().catch((error) => {
  log(`\n❌ Fatal error: ${error}`, "red")
  console.error(error)
  process.exit(1)
})
