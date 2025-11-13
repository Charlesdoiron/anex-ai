export interface SourceInfo {
  pageNumber?: number;
  fileName?: string;
  startCharIdx?: number | null;
  endCharIdx?: number | null;
  score?: number | null;
  metadata?: Record<string, unknown>;
}

export function extractSourceInfoFromRetrievalNodes(
  retrievalNodes: any[]
): SourceInfo[] {
  if (!retrievalNodes || retrievalNodes.length === 0) {
    return [];
  }

  return retrievalNodes.map((item: any) => {
    const node = item.node || item;
    const extraInfo = node?.extra_info || {};
    const metadata = node?.metadata || {};

    // Extract page number from various possible locations
    const pageNumber =
      extraInfo.page_label !== undefined
        ? Number(extraInfo.page_label)
        : extraInfo.page_number !== undefined
        ? Number(extraInfo.page_number)
        : extraInfo.page !== undefined
        ? Number(extraInfo.page)
        : metadata.page_label !== undefined
        ? Number(metadata.page_label)
        : metadata.page_number !== undefined
        ? Number(metadata.page_number)
        : metadata.page !== undefined
        ? Number(metadata.page)
        : undefined;

    // Extract file name
    const fileName =
      extraInfo.file_name ||
      extraInfo.fileName ||
      extraInfo.original_file_name ||
      extraInfo.originalFileName ||
      metadata.file_name ||
      metadata.fileName ||
      undefined;

    return {
      pageNumber:
        pageNumber !== undefined && !isNaN(pageNumber) ? pageNumber : undefined,
      fileName: fileName as string | undefined,
      startCharIdx: node?.start_char_idx ?? null,
      endCharIdx: node?.end_char_idx ?? null,
      score: item.score ?? null,
      metadata: { ...extraInfo, ...metadata },
    };
  });
}

/**
 * Deduplicates retrieval nodes by text content
 */
export function deduplicateRetrievalNodes(retrievalNodes: any[]): any[] {
  if (!retrievalNodes || retrievalNodes.length === 0) {
    return [];
  }

  const seen = new Set<string>();
  const deduplicated: any[] = [];

  for (const item of retrievalNodes) {
    const node = item.node || item;
    const text = (node?.text || node?.getText?.() || "").trim();

    // Create a normalized key (first 200 chars + score for uniqueness)
    const key = `${text.substring(0, 200)}_${item.score || 0}`;

    if (!seen.has(key) && text.length > 0) {
      seen.add(key);
      deduplicated.push(item);
    }
  }

  return deduplicated;
}

/**
 * Sorts retrieval nodes by relevance score (highest first)
 */
export function sortNodesByRelevance(retrievalNodes: any[]): any[] {
  return [...retrievalNodes].sort((a, b) => {
    const scoreA = a.score ?? a.node?.score ?? 0;
    const scoreB = b.score ?? b.node?.score ?? 0;
    return scoreB - scoreA; // Descending order
  });
}

/**
 * Truncates context based on relevance scores and max length
 */
export function truncateContextByRelevance(
  retrievalNodes: any[],
  maxLength: number,
  minScore: number = 0.5
): string {
  if (!retrievalNodes || retrievalNodes.length === 0) {
    return "Aucun résultat trouvé dans le document.";
  }

  // Filter by minimum score first
  const filteredNodes = retrievalNodes.filter((item) => {
    const score = item.score ?? item.node?.score ?? 0;
    return score >= minScore;
  });

  if (filteredNodes.length === 0) {
    // If no nodes meet the threshold, use top 3 nodes regardless of score
    const sortedNodes = sortNodesByRelevance(retrievalNodes);
    const topNodes = sortedNodes.slice(0, 3);
    const texts = topNodes
      .map((item) => {
        const node = item.node || item;
        return (node?.text || node?.getText?.() || "").trim();
      })
      .filter((text) => text && text.length > 0);

    const extractedText =
      texts.length > 0
        ? texts.join("\n\n").substring(0, maxLength)
        : "Aucun résultat trouvé dans le document.";

    return extractedText;
  }

  // Sort by relevance
  const sortedNodes = sortNodesByRelevance(filteredNodes);

  const texts: string[] = [];
  let currentLength = 0;

  for (const item of sortedNodes) {
    const node = item.node || item;
    const text = (node?.text || node?.getText?.() || "").trim();

    if (!text || text.length === 0) continue;

    const textWithSeparator = texts.length > 0 ? `\n\n${text}` : text;
    const newLength = currentLength + textWithSeparator.length;

    if (newLength <= maxLength) {
      texts.push(text);
      currentLength = newLength;
    } else {
      // Try to fit at least part of the text if it's highly relevant
      const score = item.score ?? item.node?.score ?? 0;
      if (score > 0.7 && currentLength < maxLength * 0.8) {
        // For high relevance, allow partial inclusion
        const remaining = maxLength - currentLength - 2; // -2 for separator
        if (remaining > 100) {
          texts.push(text.substring(0, remaining) + "...");
          break;
        }
      }
      break;
    }
  }

  const extractedText =
    texts.length > 0
      ? texts.join("\n\n")
      : "Résultats trouvés mais contenu texte non disponible.";

  return extractedText;
}
