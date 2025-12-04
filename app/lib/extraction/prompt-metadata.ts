import type { ExtractionSection } from "./types"
import {
  SYSTEM_INSTRUCTIONS,
  PROMPT_DEFINITIONS,
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
    prompt: PROMPT_DEFINITIONS.regime.prompt,
    retryable: true,
    description: "Type de bail et références légales associées",
  },
  {
    id: "parties",
    label: "Parties au contrat",
    section: "parties",
    prompt: PROMPT_DEFINITIONS.parties.prompt,
    retryable: true,
    description: "Coordonnées et informations sur le bailleur et le preneur",
  },
  {
    id: "premises",
    label: "Description des locaux",
    section: "premises",
    prompt: PROMPT_DEFINITIONS.premises.prompt,
    retryable: true,
    description: "Désignation, surfaces et aménagements des locaux loués",
  },
  {
    id: "calendar",
    label: "Calendrier et durées",
    section: "calendar",
    prompt: PROMPT_DEFINITIONS.calendar.prompt,
    retryable: true,
    description: "Dates clés, durée du bail et modalités de préavis",
  },
  {
    id: "supportMeasures",
    label: "Mesures d'accompagnement",
    section: "supportMeasures",
    prompt: PROMPT_DEFINITIONS.supportMeasures.prompt,
    retryable: true,
    description: "Franchises de loyer et autres avantages accordés au preneur",
  },
  {
    id: "rent",
    label: "Loyer",
    section: "rent",
    prompt: PROMPT_DEFINITIONS.rent.prompt,
    retryable: true,
    description: "Montants de loyer, paiement et pénalités de retard",
  },
  {
    id: "indexation",
    label: "Indexation",
    section: "indexation",
    prompt: PROMPT_DEFINITIONS.indexation.prompt,
    retryable: true,
    description: "Clause d'indexation, indice de référence et fréquence",
  },
  {
    id: "taxes",
    label: "Taxes",
    section: "taxes",
    prompt: PROMPT_DEFINITIONS.taxes.prompt,
    retryable: true,
    description: "Taxes refacturées au preneur et montants associés",
  },
  {
    id: "charges",
    label: "Charges et honoraires",
    section: "charges",
    prompt: PROMPT_DEFINITIONS.charges.prompt,
    retryable: true,
    description:
      "Provisions pour charges, RIE et honoraires à la charge du preneur",
  },
  {
    id: "insurance",
    label: "Assurances",
    section: "insurance",
    prompt: PROMPT_DEFINITIONS.insurance.prompt,
    retryable: true,
    description: "Obligations d'assurance et renonciations à recours",
  },
  {
    id: "securities",
    label: "Sûretés",
    section: "securities",
    prompt: PROMPT_DEFINITIONS.securities.prompt,
    retryable: true,
    description: "Dépôt de garantie et autres garanties locatives",
  },
  {
    id: "inventory",
    label: "États des lieux",
    section: "inventory",
    prompt: PROMPT_DEFINITIONS.inventory.prompt,
    retryable: true,
    description: "Modalités des états des lieux d'entrée et de sortie",
  },
  {
    id: "maintenance",
    label: "Entretien et travaux",
    section: "maintenance",
    prompt: PROMPT_DEFINITIONS.maintenance.prompt,
    retryable: true,
    description: "Répartition des travaux et clause d'accession",
  },
  {
    id: "restitution",
    label: "Restitution",
    section: "restitution",
    prompt: PROMPT_DEFINITIONS.restitution.prompt,
    retryable: true,
    description: "Conditions de restitution des locaux",
  },
  {
    id: "transfer",
    label: "Cession et sous-location",
    section: "transfer",
    prompt: PROMPT_DEFINITIONS.transfer.prompt,
    retryable: true,
    description: "Conditions de cession, sous-location et division",
  },
  {
    id: "environmentalAnnexes",
    label: "Annexes environnementales",
    section: "environmentalAnnexes",
    prompt: PROMPT_DEFINITIONS.environmentalAnnexes.prompt,
    retryable: true,
    description: "Diagnostics environnementaux obligatoires et annexes vertes",
  },
  {
    id: "otherAnnexes",
    label: "Autres annexes",
    section: "otherAnnexes",
    prompt: PROMPT_DEFINITIONS.otherAnnexes.prompt,
    retryable: true,
    description: "Règlement intérieur, plans et récapitulatifs de charges",
  },
  {
    id: "other",
    label: "Autres informations",
    section: "other",
    prompt: PROMPT_DEFINITIONS.other.prompt,
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
