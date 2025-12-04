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

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text
  }

  return text.slice(0, maxLength) + "\n\n[... document truncated ...]"
}
