export function splitText(
  text: string,
  chunkSize: number = 1000,
  overlap: number = 200
): string[] {
  if (!text) return []
  if (text.length <= chunkSize) return [text]

  const chunks: string[] = []
  let startIndex = 0

  while (startIndex < text.length) {
    let endIndex = startIndex + chunkSize

    if (endIndex >= text.length) {
      chunks.push(text.slice(startIndex))
      break
    }

    // Try to find a punctuation mark to break at
    const lookbackWindow = Math.min(100, chunkSize / 2) // Look back up to 100 chars or half chunk
    const slice = text.slice(endIndex - lookbackWindow, endIndex)
    const lastPeriod = slice.lastIndexOf(".")
    const lastNewline = slice.lastIndexOf("\n")
    const breakPoint = Math.max(lastPeriod, lastNewline)

    if (breakPoint !== -1) {
      endIndex = endIndex - lookbackWindow + breakPoint + 1
    } else {
      // No good break point, try space
      const lastSpace = slice.lastIndexOf(" ")
      if (lastSpace !== -1) {
        endIndex = endIndex - lookbackWindow + lastSpace + 1
      }
    }

    chunks.push(text.slice(startIndex, endIndex).trim())
    startIndex = endIndex - overlap
  }

  return chunks
}
