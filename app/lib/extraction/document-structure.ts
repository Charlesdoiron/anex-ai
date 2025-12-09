/**
 * Simple document handling for extraction
 *
 * Strategy:
 * - For documents < MAX_DIRECT_LENGTH: send entire document to LLM
 * - For larger documents: use smart truncation (beginning + end)
 *
 * With gpt-5-mini's 400k token context window, most leases fit entirely.
 * We use ~1M chars to leave room for prompts and response (~250k tokens).
 */

// Conservative limit: ~250k tokens worth of text, leaving room for prompts and response
const MAX_DIRECT_LENGTH = 1_000_000

// For very large documents, keep this much from start and end
const TRUNCATION_START_RATIO = 0.7
const TRUNCATION_END_RATIO = 0.3

export interface DocumentInfo {
  text: string
  originalLength: number
  wasTruncated: boolean
  truncationMethod?: "smart" | "none"
}

/**
 * Prepare document text for LLM extraction.
 * Most documents will be returned as-is.
 */
export function prepareDocumentText(
  rawText: string,
  maxLength: number = MAX_DIRECT_LENGTH
): DocumentInfo {
  const originalLength = rawText.length

  // Most documents fit entirely - just return as-is
  if (rawText.length <= maxLength) {
    return {
      text: rawText,
      originalLength,
      wasTruncated: false,
      truncationMethod: "none",
    }
  }

  // For very large documents, use smart truncation
  // Keep beginning (usually has parties, context) and end (usually has signatures, key terms)
  const startLength = Math.floor(maxLength * TRUNCATION_START_RATIO)
  const endLength = Math.floor(maxLength * TRUNCATION_END_RATIO) - 200 // Reserve space for separator

  const startText = rawText.slice(0, startLength)
  const endText = rawText.slice(-endLength)

  const truncatedText =
    startText +
    "\n\n[... section intermédiaire omise pour respecter les limites de traitement ...]\n\n" +
    endText

  console.log(
    `[Document] Truncated from ${originalLength} to ${truncatedText.length} chars (${((truncatedText.length / originalLength) * 100).toFixed(1)}%)`
  )

  return {
    text: truncatedText,
    originalLength,
    wasTruncated: true,
    truncationMethod: "smart",
  }
}

/**
 * Quick check if document likely contains key lease data.
 * Uses simple text search - fast and reliable.
 */
export function quickDataCheck(text: string): {
  hasRentInfo: boolean
  hasIndexInfo: boolean
  hasPartiesInfo: boolean
  hasCalendarInfo: boolean
} {
  const lowerText = text.toLowerCase()

  return {
    hasRentInfo:
      lowerText.includes("loyer") &&
      (lowerText.includes("€") || lowerText.includes("euro")),
    hasIndexInfo:
      lowerText.includes("indexation") ||
      lowerText.includes("ilat") ||
      lowerText.includes("icc") ||
      lowerText.includes("ilc"),
    hasPartiesInfo:
      lowerText.includes("bailleur") && lowerText.includes("preneur"),
    hasCalendarInfo:
      (lowerText.includes("durée") || lowerText.includes("duree")) &&
      (lowerText.includes("effet") || lowerText.includes("compter")),
  }
}

/**
 * Find approximate location of key sections using simple text search.
 * Returns character positions for key terms.
 */
export function findKeySections(text: string): {
  rent: number | null
  indexation: number | null
  parties: number | null
  guarantee: number | null
} {
  const patterns = {
    rent: [/loyer\s*(annuel|principal|de\s*base)/i, /\bLOYER\b/],
    indexation: [/indexation/i, /indice\s*de\s*r[ée]f[ée]rence/i],
    parties: [/entre\s*les\s*soussign[ée]/i, /le\s*bailleur/i],
    guarantee: [/d[ée]p[ôo]t\s*de\s*garantie/i, /garantie/i],
  }

  const results: Record<string, number | null> = {
    rent: null,
    indexation: null,
    parties: null,
    guarantee: null,
  }

  for (const [key, patternList] of Object.entries(patterns)) {
    for (const pattern of patternList) {
      const match = text.match(pattern)
      if (match?.index !== undefined) {
        results[key] = match.index
        break
      }
    }
  }

  return results as {
    rent: number | null
    indexation: number | null
    parties: number | null
    guarantee: number | null
  }
}

/**
 * Extract a section of text around a position.
 * Useful for targeted extraction when document is too large.
 */
export function extractSection(
  text: string,
  position: number,
  contextBefore: number = 2000,
  contextAfter: number = 5000
): string {
  const start = Math.max(0, position - contextBefore)
  const end = Math.min(text.length, position + contextAfter)
  return text.slice(start, end)
}
