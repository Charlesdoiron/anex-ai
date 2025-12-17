import { config } from "dotenv"

// Load .env.local first (overrides), then .env as fallback
config({ path: ".env.local" })
config({ path: ".env" })

import fs from "fs"
import path from "path"

import { checkPdfPageWithVision } from "../app/lib/extraction/pdf-vision-check"

function getArg(name: string): string | null {
  const idx = process.argv.findIndex((a) => a === name)
  if (idx === -1) return null
  const value = process.argv[idx + 1]
  return value ?? null
}

async function main() {
  const pdfPathArg = getArg("--pdf")
  const pageArg = getArg("--page")
  const question = getArg("--question")

  if (!pdfPathArg || !pageArg || !question) {
    console.error(
      "Usage: npx tsx scripts/vision-page-check.ts --pdf <path> --page <1-based> --question <text>"
    )
    process.exit(2)
  }

  const pageNumber = Number.parseInt(pageArg, 10)
  if (!Number.isInteger(pageNumber) || pageNumber <= 0) {
    console.error("--page must be a positive integer (1-based)")
    process.exit(2)
  }

  const pdfPath = path.resolve(process.cwd(), pdfPathArg)
  const pdfBuffer = fs.readFileSync(pdfPath)

  const result = await checkPdfPageWithVision({
    pdfBuffer,
    pageNumber,
    question,
  })

  console.log(
    JSON.stringify(
      {
        pageNumber: result.pageNumber,
        pageCount: result.pageCount,
        visionAnswer: result.visionAnswer,
        tesseractTextPreview: result.tesseractText.slice(0, 1200),
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
