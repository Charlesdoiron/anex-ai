import { load } from "cheerio"

export interface RentIndexPayload {
  year: number
  quarter: number
  value: number
  createdAt: string | null
}

async function getBrowser() {
  const isVercel = process.env.VERCEL === "1"
  if (isVercel) {
    const puppeteer = await import("puppeteer-core")
    const chromium = await import("@sparticuz/chromium")
    return await puppeteer.default.launch({
      args: chromium.default.args,
      defaultViewport: { width: 1280, height: 720 },
      executablePath: await chromium.default.executablePath(),
      headless: true,
    })
  }

  const puppeteer = await import("puppeteer")
  return await puppeteer.default.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  })
}

function parseFrenchDate(dateStr: string | undefined): string | null {
  if (!dateStr?.trim()) return null
  const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (!match) return null
  const [, day, month, year] = match
  return `${year}-${month}-${day}`
}

function parseQuarter(trimestre: string | undefined): number | null {
  const match = trimestre?.match(/T(\d)/)
  return match ? parseInt(match[1], 10) : null
}

function parseFrenchNumber(value: string | undefined): number | null {
  const numStr = value?.replace(",", ".") || ""
  const num = parseFloat(numStr)
  return isNaN(num) ? null : num
}

function transformRow(row: Record<string, string>): RentIndexPayload | null {
  const year = parseInt(row["Année"], 10)
  if (isNaN(year)) return null

  const quarter = parseQuarter(row["Trimestre"])
  if (!quarter) return null

  const value = parseFrenchNumber(row["Valeur"])
  if (value === null) return null

  const createdAt = parseFrenchDate(row["Parution au J.O."])

  return { year, quarter, value, createdAt }
}

export async function scrapeInseeRentalIndex(): Promise<RentIndexPayload[]> {
  const INSEE_RENTAL_REFERENCE_INDEX_URL =
    process.env.INSEE_RENTAL_REFERENCE_INDEX_URL

  if (!INSEE_RENTAL_REFERENCE_INDEX_URL) {
    throw new Error("INSEE_RENTAL_REFERENCE_INDEX_URL is not set")
  }

  const isVercel = process.env.VERCEL === "1"
  let browser

  try {
    browser = await getBrowser()
    const page = await browser.newPage()

    await page.goto(INSEE_RENTAL_REFERENCE_INDEX_URL, {
      waitUntil: "domcontentloaded",
      timeout: isVercel ? 15000 : 30000,
    })

    await page.waitForSelector("#tableau-series", {
      timeout: isVercel ? 8000 : 10000,
    })

    const html = await page.content()
    await browser.close()
    browser = undefined

    const $ = load(html)
    const headers = $("#tableau-series thead tr th")

    if (headers.length === 0) {
      throw new Error("No table headers found in #tableau-series")
    }

    const headerTexts = headers
      .map((_, header) => $(header).text().trim())
      .get()
      .filter((text) => text.length > 0)

    const tableData: Array<Record<string, string>> = []
    $("#tableau-series tbody tr").each((_, row) => {
      const rowData: Record<string, string> = {}
      $(row)
        .find("td")
        .each((cellIndex, cell) => {
          const headerKey = headerTexts[cellIndex] || `column_${cellIndex}`
          rowData[headerKey] = $(cell).text().trim()
        })
      if (Object.keys(rowData).length > 0) {
        tableData.push(rowData)
      }
    })

    const payload = tableData
      .map(transformRow)
      .filter((item): item is RentIndexPayload => item !== null)

    return payload
  } catch (error) {
    if (browser) {
      await browser.close()
    }
    throw error
  }
}
