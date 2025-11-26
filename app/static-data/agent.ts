interface Agent {
  slug: string
  name: string
  description: string
  path: string | null
  tools: Tool[]
}

export type toolType = "extraction-lease" | "calculation-rent"
interface Tool {
  slug: string
  name: string
  description: string
  path: string | null
  type: toolType
}

export const AGENTS: Agent[] = [
  {
    slug: "bail",
    name: "Agent Bail",
    description:
      "Agent spécialisé dans l'extraction de données des baux commerciaux.<br/> Il possède deux modes de fonctionnement : <strong>l'extraction de données</strong> et <strong>le calcul de loyer via l'indice INSEE</strong>.",
    path: "/agent/bail",

    tools: [
      {
        slug: "extraction-baux-commerciaux",
        name: "Extraction de données des baux commerciaux",
        description: "Extraction de données des baux commerciaux.",
        path: "/agent/bail/extraction-baux-commerciaux",
        type: "extraction-lease",
      },
      {
        slug: "calcul-loyer-indice-insee",
        name: "Calcul de loyer via le barème de l'indice INSEE",
        description: "Calcul de loyer via le barème de l'indice INSEE.",
        path: "/agent/bail/calcul-loyer-indice-insee",
        type: "calculation-rent",
      },
    ],
  },
]
