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

export const computeLeaseRentScheduleTool: ToolDefinition = {
  type: "function",
  name: "compute_lease_rent_schedule",
  description:
    "Calcule un calendrier de loyers HT (bureaux, parkings, charges, taxes, franchises) pour un bail commercial français.",
  parameters: {
    type: "object",
    properties: {
      start_date: {
        type: "string",
        format: "date",
        description: "Date de prise d'effet du bail (format ISO YYYY-MM-DD).",
      },
      end_date: {
        type: "string",
        format: "date",
        description: "Date de fin du bail utilisée pour arrêter le calcul.",
      },
      payment_frequency: {
        type: "string",
        enum: ["monthly", "quarterly"],
        description: "Fréquence de paiement prévue au bail.",
      },
      base_index_value: {
        type: "number",
        description:
          "Valeur d'indice de référence (ex: dernier ILAT connu au démarrage).",
      },
      known_index_points: {
        type: "array",
        description:
          "Liste chronologique des indices connus (INSEE) utilisés pour l'indexation future.",
        items: {
          type: "object",
          properties: {
            effective_date: {
              type: "string",
              format: "date",
              description: "Date d'effet de l'indice (AAAAMMJJ).",
            },
            index_value: {
              type: "number",
              description: "Valeur de l'indice à cette date.",
            },
          },
          required: ["effective_date", "index_value"],
          additionalProperties: false,
        },
      },
      charges_growth_rate: {
        type: "number",
        description:
          "Hypothèse d'évolution annuelle des charges et taxes (ex: 0.02 pour +2%).",
      },
      office_rent_ht: {
        type: "number",
        description:
          "Loyer HT (base) pour la composante bureaux sur une période de paiement.",
      },
      parking_rent_ht: {
        type: "number",
        description: "Loyer HT (base) pour les parkings sur une période.",
      },
      charges_ht: {
        type: "number",
        description: "Provision charges HT par période.",
      },
      taxes_ht: {
        type: "number",
        description: "Provision taxes foncières HT par période.",
      },
      other_costs_ht: {
        type: "number",
        description:
          "Autres montants HT récurrents par période (ex: services annexes).",
      },
      deposit_months: {
        type: "integer",
        description:
          "Nombre de mois retenus pour le dépôt de garantie (sur base loyers + charges + taxes).",
      },
      franchise_months: {
        type: "integer",
        description:
          "Nombre de mois de franchise loyers (bureaux + parkings) accordés à la signature.",
      },
      incentive_amount: {
        type: "number",
        description:
          "Montant des travaux / mesures d'accompagnement (positif = remise pour le preneur).",
      },
      horizon_years: {
        type: "integer",
        description:
          "Nombre d'années maximum à projeter depuis la prise d'effet (par défaut 3).",
      },
    },
    required: [
      "start_date",
      "end_date",
      "payment_frequency",
      "base_index_value",
      "office_rent_ht",
    ],
    additionalProperties: false,
  },
  strict: true,
}

export const TOOL_DEFINITIONS = {
  retrieve_chunks: retrieveChunksTool,
  compute_lease_rent_schedule: computeLeaseRentScheduleTool,
} satisfies Record<string, ToolDefinition>

export type ToolName = keyof typeof TOOL_DEFINITIONS

export function getTools(names?: (keyof typeof TOOL_DEFINITIONS)[]) {
  if (!names) {
    return Object.values(TOOL_DEFINITIONS)
  }
  return names.map((name) => TOOL_DEFINITIONS[name])
}
