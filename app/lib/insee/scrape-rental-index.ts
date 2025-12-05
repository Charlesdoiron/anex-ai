import { load } from "cheerio"
import {
  SUPPORTED_LEASE_INDEX_TYPES,
  type LeaseIndexType,
} from "../lease/types"

export interface RentIndexPayload {
  indexType: LeaseIndexType
  year: number
  quarter: number
  value: number
  createdAt: string | null
}

/**
 * Environment variable names for each index type URL
 */
const INDEX_URL_ENV_KEYS: Record<LeaseIndexType, string> = {
  ILAT: "INSEE_ILAT_URL",
  ILC: "INSEE_ILC_URL",
  ICC: "INSEE_ICC_URL",
}

/**
 * Get configured URL for a specific index type
 */
function getIndexUrl(indexType: LeaseIndexType): string | null {
  const envKey = INDEX_URL_ENV_KEYS[indexType]
  return process.env[envKey] || null
}

/**
 * Get all configured index types (those with URLs set)
 */
export function getConfiguredIndexTypes(): LeaseIndexType[] {
  return SUPPORTED_LEASE_INDEX_TYPES.filter(
    (type) => getIndexUrl(type) !== null
  )
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
  // Remove spaces (including non-breaking spaces \u00A0) used as thousand separators
  // Then replace comma with dot for decimal separator
  const numStr = value?.replace(/[\s\u00A0]/g, "").replace(",", ".") || ""
  const num = parseFloat(numStr)
  return isNaN(num) ? null : num
}

function transformRow(
  row: Record<string, string>,
  indexType: LeaseIndexType
): RentIndexPayload | null {
  const year = parseInt(row["Année"], 10)
  if (isNaN(year)) return null

  const quarter = parseQuarter(row["Trimestre"])
  if (!quarter) return null

  const value = parseFrenchNumber(row["Valeur"])
  if (value === null) return null

  const createdAt = parseFrenchDate(row["Parution au J.O."])

  return { indexType, year, quarter, value, createdAt }
}

/**
 * Scrape a single index type from INSEE
 */
export async function scrapeInseeRentalIndex(
  indexType: LeaseIndexType
): Promise<RentIndexPayload[]> {
  const url = getIndexUrl(indexType)

  if (!url) {
    throw new Error(
      `INSEE URL for ${indexType} is not configured. Set ${INDEX_URL_ENV_KEYS[indexType]} environment variable.`
    )
  }

  const isVercel = process.env.VERCEL === "1"
  let browser

  try {
    browser = await getBrowser()
    const page = await browser.newPage()

    await page.goto(url, {
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
      throw new Error(
        `No table headers found in #tableau-series for ${indexType}`
      )
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
      .map((row) => transformRow(row, indexType))
      .filter((item): item is RentIndexPayload => item !== null)

    return payload
  } catch (error) {
    if (browser) {
      await browser.close()
    }
    throw error
  }
}

export interface ScrapeAllResult {
  results: Record<LeaseIndexType, RentIndexPayload[]>
  errors: Record<LeaseIndexType, string>
}

/**
 * Scrape all configured index types from INSEE
 * Only scrapes indices that have their URL configured
 */
export async function scrapeAllInseeRentalIndices(): Promise<ScrapeAllResult> {
  const configuredTypes = getConfiguredIndexTypes()

  if (configuredTypes.length === 0) {
    console.warn(
      "[INSEE] No index URLs configured. Set INSEE_ILAT_URL, INSEE_ILC_URL, or INSEE_ICC_URL."
    )
    const emptyResults: Record<LeaseIndexType, RentIndexPayload[]> = {
      ILAT: [],
      ILC: [],
      ICC: [],
    }
    const emptyErrors: Record<LeaseIndexType, string> = {
      ILAT: "",
      ILC: "",
      ICC: "",
    }
    return {
      results: emptyResults,
      errors: emptyErrors,
    }
  }

  const results: Record<LeaseIndexType, RentIndexPayload[]> = {
    ILAT: [],
    ILC: [],
    ICC: [],
  }
  const errors: Record<LeaseIndexType, string> = {
    ILAT: "",
    ILC: "",
    ICC: "",
  }

  for (const indexType of configuredTypes) {
    try {
      console.log(`[INSEE] Scraping ${indexType}...`)
      const data = await scrapeInseeRentalIndex(indexType)
      results[indexType] = data
      console.log(`[INSEE] ${indexType}: ${data.length} records`)
      errors[indexType] = ""
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      errors[indexType] = errorMsg
      console.error(`[INSEE] Failed to scrape ${indexType}:`, errorMsg)
    }
  }

  return { results, errors }
}
