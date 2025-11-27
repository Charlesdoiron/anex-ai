/**
 * Test script to verify Excel export matches template format
 */
import { config } from "dotenv"
config({ path: ".env.local" })
config({ path: ".env" })

import * as fs from "fs"
import * as path from "path"
import { ExtractionService } from "../app/lib/extraction/extraction-service"
import {
  exportExtractionToExcel,
  exportExtractionToExcelBuffer,
} from "../app/components/extraction/utils/excel-export"

const DATA_DIR = path.join(process.cwd(), "data")

async function main() {
  const fileName = process.argv[2] || "Bail simple et court.pdf"
  const filePath = path.join(DATA_DIR, fileName)

  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`)
    process.exit(1)
  }

  console.log(`\n📄 Processing: ${fileName}\n`)

  const buffer = fs.readFileSync(filePath)
  const service = new ExtractionService((p) => {
    console.log(`[${Math.round(p.progress)}%] ${p.message}`)
  })

  const result = await service.extractFromPdf(buffer, fileName)

  // Export to Excel buffer
  const excelBuffer = exportExtractionToExcelBuffer(result)

  // Save Excel file
  const outputPath = path.join(
    DATA_DIR,
    "test-results",
    `${fileName.replace(".pdf", "")}-export.xlsx`
  )
  fs.writeFileSync(outputPath, excelBuffer)

  console.log(`\n✅ Excel export saved to: ${outputPath}`)
  console.log(`   - File size: ${(excelBuffer.length / 1024).toFixed(1)} KB`)
  console.log(`   - OCR Engine: ${result.usedOcrEngine || "none"}`)
}

main().catch(console.error)
