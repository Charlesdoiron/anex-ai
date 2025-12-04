import type { FunctionTool, Tool } from "openai/resources/responses/responses"

export type ToolDefinition = FunctionTool

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
    "Calcule un calendrier de loyers HT (bureaux, parkings, charges, taxes, franchises) pour un bail commercial français. Utilise cet outil quand l'utilisateur demande un échéancier, une projection ou un calcul de loyers.",
  parameters: {
    type: "object",
    properties: {
      start_date: {
        type: "string",
        description: "Date de prise d'effet du bail (format ISO YYYY-MM-DD).",
      },
      end_date: {
        type: "string",
        description: "Date de fin du bail (format ISO YYYY-MM-DD).",
      },
      payment_frequency: {
        type: "string",
        enum: ["monthly", "quarterly"],
        description: "Fréquence de paiement: 'monthly' ou 'quarterly'.",
      },
      base_index_value: {
        type: "number",
        description:
          "Valeur d'indice de référence (ex: dernier ILAT connu au démarrage).",
      },
      known_index_points: {
        type: ["array", "null"],
        description:
          "Liste chronologique des indices connus (INSEE) pour l'indexation future. Null si inconnus.",
        items: {
          type: "object",
          properties: {
            effective_date: {
              type: "string",
              description: "Date d'effet de l'indice (format ISO YYYY-MM-DD).",
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
        type: ["number", "null"],
        description:
          "Hypothèse d'évolution annuelle des charges et taxes (ex: 0.02 pour +2%). Null si inconnu.",
      },
      office_rent_ht: {
        type: "number",
        description:
          "Loyer HT (base) pour la composante bureaux sur une période de paiement.",
      },
      parking_rent_ht: {
        type: ["number", "null"],
        description:
          "Loyer HT (base) pour les parkings sur une période. Null si pas de parking.",
      },
      charges_ht: {
        type: ["number", "null"],
        description: "Provision charges HT par période. Null si inconnue.",
      },
      taxes_ht: {
        type: ["number", "null"],
        description:
          "Provision taxes foncières HT par période. Null si inconnue.",
      },
      other_costs_ht: {
        type: ["number", "null"],
        description:
          "Autres montants HT récurrents par période (ex: services annexes). Null si aucun.",
      },
      deposit_months: {
        type: ["number", "null"],
        description:
          "Nombre de mois retenus pour le dépôt de garantie (sur base loyers + charges + taxes). Null si inconnu.",
      },
      franchise_months: {
        type: ["number", "null"],
        description:
          "Nombre de mois de franchise loyers (bureaux + parkings) accordés à la signature. Null si aucune.",
      },
      incentive_amount: {
        type: ["number", "null"],
        description:
          "Montant des travaux / mesures d'accompagnement (positif = remise pour le preneur). Null si aucun.",
      },
      horizon_years: {
        type: ["number", "null"],
        description:
          "Nombre d'années maximum à projeter depuis la prise d'effet. Par défaut 3 si null.",
      },
    },
    required: [
      "start_date",
      "end_date",
      "payment_frequency",
      "base_index_value",
      "known_index_points",
      "charges_growth_rate",
      "office_rent_ht",
      "parking_rent_ht",
      "charges_ht",
      "taxes_ht",
      "other_costs_ht",
      "deposit_months",
      "franchise_months",
      "incentive_amount",
      "horizon_years",
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

export function getTools(names?: (keyof typeof TOOL_DEFINITIONS)[]): Tool[] {
  if (!names) {
    return Object.values(TOOL_DEFINITIONS)
  }
  return names.map((name) => TOOL_DEFINITIONS[name])
}
