import OpenAI from "openai"

export class MissingOpenAIKeyError extends Error {
  constructor() {
    super("OPENAI_API_KEY is not configured.")
    this.name = "MissingOpenAIKeyError"
  }
}

let cachedClient: OpenAI | null = null

function createClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    throw new MissingOpenAIKeyError()
  }
  return new OpenAI({ apiKey })
}

export function getOpenAIClient(): OpenAI {
  if (!cachedClient) {
    cachedClient = createClient()
  }
  return cachedClient
}

export function getOptionalOpenAIClient(): OpenAI | null {
  try {
    return getOpenAIClient()
  } catch (error) {
    if (error instanceof MissingOpenAIKeyError) {
      return null
    }
    throw error
  }
}
