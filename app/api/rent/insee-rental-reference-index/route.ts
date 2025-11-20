// This endpoint is used to scrape the rent index from the INSEE page
// and save it to the database
// It is called by a cron job every week on Monday at 7:00 AM
// The cron job is defined in the vercel.json file
// The endpoint is called by the cron job and returns a JSON object with the following fields:
// - success: boolean
// - data: array of objects with the following fields:
//   - year: number
//   - quarter: number
//   - value: number
//   - createdAt: string

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/app/lib/prisma"
import { scrapeInseeRentalIndex } from "@/app/lib/insee/scrape-rental-index"

export async function GET(request: NextRequest) {
  try {
    const payload = await scrapeInseeRentalIndex()

    await prisma.insee_rental_reference_index.createMany({
      data: payload.map((item) => ({
        year: item.year,
        quarter: item.quarter,
        value: item.value,
        createdAt: item.createdAt ? new Date(item.createdAt) : undefined,
      })),
    })

    return NextResponse.json({
      success: true,
      data: payload,
    })
  } catch (error) {
    console.error("Failed to scrape rent index:", error)
    return NextResponse.json(
      {
        error: "Failed to scrape the rent index from the INSEE page",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
