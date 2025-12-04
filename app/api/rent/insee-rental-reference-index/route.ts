// This endpoint is used to scrape the rent indices from INSEE pages
// and save them to the database.
// It is called by a cron job every week on Monday at 7:00 AM
// The cron job is defined in the vercel.json file
//
// Supports multiple index types (ILAT, ILC, ICC) based on configured environment variables:
// - INSEE_ILAT_URL: URL for ILAT index
// - INSEE_ILC_URL: URL for ILC index
// - INSEE_ICC_URL: URL for ICC index
//
// Query parameters:
// - indexType: (optional) Specific index to scrape (ILAT, ILC, ICC)
//              If not provided, scrapes all configured indices

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/app/lib/prisma"
import {
  scrapeInseeRentalIndex,
  scrapeAllInseeRentalIndices,
  getConfiguredIndexTypes,
} from "@/app/lib/insee/scrape-rental-index"
import {
  SUPPORTED_LEASE_INDEX_TYPES,
  type LeaseIndexType,
} from "@/app/lib/lease/types"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const requestedIndexType = searchParams.get("indexType")?.toUpperCase()

    // Validate index type if provided
    if (
      requestedIndexType &&
      !SUPPORTED_LEASE_INDEX_TYPES.includes(
        requestedIndexType as LeaseIndexType
      )
    ) {
      return NextResponse.json(
        {
          error: `Invalid indexType. Supported values: ${SUPPORTED_LEASE_INDEX_TYPES.join(", ")}`,
        },
        { status: 400 }
      )
    }

    // If specific index type requested, scrape only that one
    if (requestedIndexType) {
      const indexType = requestedIndexType as LeaseIndexType
      const payload = await scrapeInseeRentalIndex(indexType)

      // Upsert data (skipDuplicates thanks to unique constraint)
      await prisma.insee_rental_reference_index.createMany({
        data: payload.map((item) => ({
          indexType: item.indexType,
          year: item.year,
          quarter: item.quarter,
          value: item.value,
          createdAt: item.createdAt ? new Date(item.createdAt) : undefined,
        })),
        skipDuplicates: true,
      })

      return NextResponse.json({
        success: true,
        indexType,
        count: payload.length,
        data: payload,
      })
    }

    // Otherwise, scrape all configured indices
    const configuredTypes = getConfiguredIndexTypes()

    if (configuredTypes.length === 0) {
      return NextResponse.json(
        {
          error:
            "No INSEE index URLs configured. Set INSEE_ILAT_URL, INSEE_ILC_URL, or INSEE_ICC_URL.",
          configuredTypes: [],
        },
        { status: 500 }
      )
    }

    const { results, errors } = await scrapeAllInseeRentalIndices()

    // Save all results to database
    const counts: Record<string, number> = {}
    for (const [indexType, payload] of Object.entries(results)) {
      if (payload.length > 0) {
        await prisma.insee_rental_reference_index.createMany({
          data: payload.map((item) => ({
            indexType: item.indexType,
            year: item.year,
            quarter: item.quarter,
            value: item.value,
            createdAt: item.createdAt ? new Date(item.createdAt) : undefined,
          })),
          skipDuplicates: true,
        })
        counts[indexType] = payload.length
      }
    }

    const totalCount = Object.values(counts).reduce((sum, n) => sum + n, 0)

    return NextResponse.json({
      success: Object.keys(errors).length === 0,
      configuredTypes,
      counts,
      total: totalCount,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error("Failed to scrape rent indices:", error)
    return NextResponse.json(
      {
        error: "Failed to scrape INSEE rent indices",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
