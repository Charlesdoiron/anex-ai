import type { Response } from "openai/resources/responses/responses"

export function collectResponseText(
  response: Response | null | undefined
): string {
  if (!response?.output) {
    return ""
  }

  let outputText = ""
  for (const item of response.output) {
    if (item.type !== "message" || !Array.isArray(item.content)) {
      continue
    }

    for (const content of item.content) {
      if (content.type === "output_text" && typeof content.text === "string") {
        outputText += content.text
      }
    }
  }

  return outputText
}

/**
 * Truncate text while preserving both beginning and end of document.
 * Commercial leases often have "Conditions Particulières" at the end with key values.
 * This keeps 70% from the start and 30% from the end.
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text
  }

  // Keep 70% from start, 30% from end
  const startRatio = 0.7
  const startLength = Math.floor(maxLength * startRatio)
  const endLength = maxLength - startLength - 100 // Reserve space for separator

  const startText = text.slice(0, startLength)
  const endText = text.slice(-endLength)

  return (
    startText +
    "\n\n[... section intermédiaire tronquée - voir CONDITIONS PARTICULIÈRES ci-dessous ...]\n\n" +
    endText
  )
}
