import type { ExtractionSection } from "./types"
import {
  SYSTEM_INSTRUCTIONS,
  REGIME_PROMPT,
  PARTIES_PROMPT,
  PREMISES_PROMPT,
  CALENDAR_PROMPT,
  SUPPORT_MEASURES_PROMPT,
  RENT_PROMPT,
  INDEXATION_PROMPT,
  TAXES_PROMPT,
  CHARGES_PROMPT,
  INSURANCE_PROMPT,
  SECURITIES_PROMPT,
  INVENTORY_PROMPT,
  MAINTENANCE_PROMPT,
  RESTITUTION_PROMPT,
  TRANSFER_PROMPT,
  ENVIRONMENTAL_ANNEXES_PROMPT,
  OTHER_ANNEXES_PROMPT,
  OTHER_PROMPT,
  EXTRACTION_PROMPTS,
} from "./prompts"

export interface PromptMetadata {
  id: string
  label: string
  section: ExtractionSection
  prompt: string
  retryable: boolean
  description?: string
}

export interface SystemPromptMetadata {
  id: "system"
  section: "system"
  label: string
  prompt: string
  description?: string
}

export const SYSTEM_PROMPT_METADATA: SystemPromptMetadata = {
  id: "system",
  section: "system",
  label: "Instructions système",
  prompt: SYSTEM_INSTRUCTIONS,
  description:
    "Contexte global et règles de réponse pour tous les prompts d'extraction",
}

const PROMPT_LIST: PromptMetadata[] = [
  {
    id: "regime",
    label: "Régime juridique",
    section: "regime",
    prompt: REGIME_PROMPT,
    retryable: true,
    description: "Type de bail et références légales associées",
  },
  {
    id: "parties",
    label: "Parties au contrat",
    section: "parties",
    prompt: PARTIES_PROMPT,
    retryable: true,
    description: "Coordonnées et informations sur le bailleur et le preneur",
  },
  {
    id: "premises",
    label: "Description des locaux",
    section: "premises",
    prompt: PREMISES_PROMPT,
    retryable: true,
    description: "Désignation, surfaces et aménagements des locaux loués",
  },
  {
    id: "calendar",
    label: "Calendrier et durées",
    section: "calendar",
    prompt: CALENDAR_PROMPT,
    retryable: true,
    description: "Dates clés, durée du bail et modalités de préavis",
  },
  {
    id: "supportMeasures",
    label: "Mesures d'accompagnement",
    section: "supportMeasures",
    prompt: SUPPORT_MEASURES_PROMPT,
    retryable: true,
    description: "Franchises de loyer et autres avantages accordés au preneur",
  },
  {
    id: "rent",
    label: "Loyer",
    section: "rent",
    prompt: RENT_PROMPT,
    retryable: true,
    description: "Montants de loyer, paiement et pénalités de retard",
  },
  {
    id: "indexation",
    label: "Indexation",
    section: "indexation",
    prompt: INDEXATION_PROMPT,
    retryable: true,
    description: "Clause d'indexation, indice de référence et fréquence",
  },
  {
    id: "taxes",
    label: "Taxes",
    section: "taxes",
    prompt: TAXES_PROMPT,
    retryable: true,
    description: "Taxes refacturées au preneur et montants associés",
  },
  {
    id: "charges",
    label: "Charges et honoraires",
    section: "charges",
    prompt: CHARGES_PROMPT,
    retryable: true,
    description:
      "Provisions pour charges, RIE et honoraires à la charge du preneur",
  },
  {
    id: "insurance",
    label: "Assurances",
    section: "insurance",
    prompt: INSURANCE_PROMPT,
    retryable: true,
    description: "Obligations d'assurance et renonciations à recours",
  },
  {
    id: "securities",
    label: "Sûretés",
    section: "securities",
    prompt: SECURITIES_PROMPT,
    retryable: true,
    description: "Dépôt de garantie et autres garanties locatives",
  },
  {
    id: "inventory",
    label: "États des lieux",
    section: "inventory",
    prompt: INVENTORY_PROMPT,
    retryable: true,
    description: "Modalités des états des lieux d'entrée et de sortie",
  },
  {
    id: "maintenance",
    label: "Entretien et travaux",
    section: "maintenance",
    prompt: MAINTENANCE_PROMPT,
    retryable: true,
    description: "Répartition des travaux et clause d'accession",
  },
  {
    id: "restitution",
    label: "Restitution",
    section: "restitution",
    prompt: RESTITUTION_PROMPT,
    retryable: true,
    description: "Conditions de restitution des locaux",
  },
  {
    id: "transfer",
    label: "Cession et sous-location",
    section: "transfer",
    prompt: TRANSFER_PROMPT,
    retryable: true,
    description: "Conditions de cession, sous-location et division",
  },
  {
    id: "environmentalAnnexes",
    label: "Annexes environnementales",
    section: "environmentalAnnexes",
    prompt: ENVIRONMENTAL_ANNEXES_PROMPT,
    retryable: true,
    description: "Diagnostics environnementaux obligatoires et annexes vertes",
  },
  {
    id: "otherAnnexes",
    label: "Autres annexes",
    section: "otherAnnexes",
    prompt: OTHER_ANNEXES_PROMPT,
    retryable: true,
    description: "Règlement intérieur, plans et récapitulatifs de charges",
  },
  {
    id: "other",
    label: "Autres informations",
    section: "other",
    prompt: OTHER_PROMPT,
    retryable: true,
    description: "Dérogations et clauses diverses",
  },
]

export const PROMPT_METADATA: PromptMetadata[] = PROMPT_LIST

export function getPromptById(id: string): PromptMetadata | undefined {
  return PROMPT_METADATA.find((prompt) => prompt.id === id)
}

export function getPromptBySection(
  section: ExtractionSection
): PromptMetadata | undefined {
  return PROMPT_METADATA.find((prompt) => prompt.section === section)
}

export function getDefaultExtractionPrompts() {
  return EXTRACTION_PROMPTS.map((prompt) => ({ ...prompt }))
}
