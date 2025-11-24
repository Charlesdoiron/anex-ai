export type ToolDefinition = {
  type: "function"
  name: string
  description: string
  parameters: {
    type: "object"
    properties: Record<string, unknown>
    required?: string[]
    additionalProperties?: boolean
  }
  strict?: boolean
}

export const retrieveChunksTool: ToolDefinition = {
  type: "function",
  name: "retrieve_chunks",
  description:
    "Recherche des passages pertinents dans le bail commercial téléversé par l'utilisateur. À utiliser OBLIGATOIREMENT avant de répondre à toute question sur le document.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "Requête de recherche décrivant précisément l'information recherchée dans le document (ex: 'loyer mensuel', 'durée du bail').",
      },
    },
    required: ["query"],
    additionalProperties: false,
  },
  strict: true,
}

export const TOOL_DEFINITIONS = {
  retrieve_chunks: retrieveChunksTool,
} satisfies Record<string, ToolDefinition>

export function getTools(names?: (keyof typeof TOOL_DEFINITIONS)[]) {
  if (!names) {
    return Object.values(TOOL_DEFINITIONS)
  }
  return names.map((name) => TOOL_DEFINITIONS[name])
}
