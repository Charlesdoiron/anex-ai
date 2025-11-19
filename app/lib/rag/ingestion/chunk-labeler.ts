import OpenAI from "openai"
import { RAG_CONFIG } from "../config"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function labelChunk(
  chunkText: string
): Promise<{ summary: string; label: string }> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Fast model for labeling
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that summarizes text chunks. Provide a very brief summary (max 1 sentence) and a short descriptive label (max 3-5 words) for the given text chunk. Return JSON.",
        },
        {
          role: "user",
          content: `Text chunk:\n"${chunkText.substring(0, 2000)}..."\n\nProvide JSON with "summary" and "label".`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    })

    const content = response.choices[0].message.content
    if (!content) return { summary: "", label: "" }

    const parsed = JSON.parse(content)
    return {
      summary: parsed.summary || "",
      label: parsed.label || "",
    }
  } catch (error) {
    console.error("Error labeling chunk:", error)
    return { summary: "", label: "" }
  }
}
