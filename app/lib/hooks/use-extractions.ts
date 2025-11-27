"use client"

import useSWR from "swr"
import type { LeaseRegime } from "@/app/lib/extraction/types"

export interface ExtractionSummary {
  id: string
  documentId: string
  fileName: string
  fileSize: number | null
  pageCount: number | null
  pipelineId: string | null
  createdAt: string
  regime: LeaseRegime | null
  duration: number | null
  surfaceArea: number | null
  annualRent: number | null
  purpose: string | null
  averageConfidence: number | null
}

interface ExtractionsResponse {
  success: boolean
  extractions: ExtractionSummary[]
  count: number
}

interface LegacyExtractionsResponse {
  data?: ExtractionSummary[]
}

async function fetcher(url: string): Promise<ExtractionSummary[]> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error("Failed to fetch extractions")
  }
  const data = (await response.json()) as
    | ExtractionsResponse
    | LegacyExtractionsResponse
  const list =
    ("extractions" in data &&
      Array.isArray(data.extractions) &&
      data.extractions) ||
    ("data" in data && Array.isArray(data.data) && data.data) ||
    []
  return list.filter(Boolean)
}

interface UseExtractionsOptions {
  enabled?: boolean
}

export function useExtractions(options: UseExtractionsOptions = {}) {
  const { enabled = true } = options

  const { data, error, isLoading, isValidating, mutate } = useSWR<
    ExtractionSummary[]
  >(enabled ? "/api/extractions" : null, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5000,
    errorRetryCount: 2,
  })

  return {
    extractions: data ?? [],
    isLoading,
    isValidating,
    error,
    mutate,
  }
}
