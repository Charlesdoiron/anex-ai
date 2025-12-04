import {
  SYSTEM_INSTRUCTIONS,
  EXTRACTION_PROMPTS,
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
} from "@/app/lib/extraction/prompts"

export interface FieldConfig {
  label: string
  id: string
  fieldId: string
  section: string
  subsection?: string
  content: string
}

function getSectionLabel(section: string): string {
  const labels: Record<string, string> = {
    system: "Système",
    regime: "Régime juridique",
    parties: "Parties",
    premises: "Locaux",
    calendar: "Calendrier",
    supportMeasures: "Mesures d'accompagnement",
    rent: "Loyer",
    indexation: "Indexation",
    taxes: "Taxes",
    charges: "Charges",
    insurance: "Assurance",
    securities: "Sûretés",
    inventory: "État des lieux",
    maintenance: "Entretien",
    restitution: "Restitution",
    transfer: "Cession",
    environmentalAnnexes: "Annexes environnementales",
    otherAnnexes: "Autres annexes",
    other: "Autres",
  }
  return labels[section] || section
}

const PROMPT_MAP: Record<string, string> = {
  regime: REGIME_PROMPT,
  parties: PARTIES_PROMPT,
  premises: PREMISES_PROMPT,
  calendar: CALENDAR_PROMPT,
  supportMeasures: SUPPORT_MEASURES_PROMPT,
  rent: RENT_PROMPT,
  indexation: INDEXATION_PROMPT,
  taxes: TAXES_PROMPT,
  charges: CHARGES_PROMPT,
  insurance: INSURANCE_PROMPT,
  securities: SECURITIES_PROMPT,
  inventory: INVENTORY_PROMPT,
  maintenance: MAINTENANCE_PROMPT,
  restitution: RESTITUTION_PROMPT,
  transfer: TRANSFER_PROMPT,
  environmentalAnnexes: ENVIRONMENTAL_ANNEXES_PROMPT,
  otherAnnexes: OTHER_ANNEXES_PROMPT,
  other: OTHER_PROMPT,
}

interface Subsection {
  number: number
  title: string
  content: string
}

function parsePromptSubsections(prompt: string): Subsection[] {
  const subsections: Subsection[] = []

  // Look for numbered subsections after "CHAMPS À EXTRAIRE :"
  const champsMatch = prompt.match(/CHAMPS À EXTRAIRE\s*:?\s*\n/i)
  if (!champsMatch) {
    return subsections
  }

  const champsIndex = champsMatch.index! + champsMatch[0].length
  const beforeChamps = prompt.substring(0, champsIndex)
  const restOfPrompt = prompt.substring(champsIndex)

  // Pattern to match numbered subsections: "1. TITLE :" or "1. TITLE:"
  const subsectionPattern = /^(\d+)\.\s+([A-Z][^:\n]+?)\s*:?\s*\n/gm
  const matches = Array.from(restOfPrompt.matchAll(subsectionPattern))

  if (matches.length === 0) {
    return subsections
  }

  // Find where the numbered subsections end and shared sections begin
  const lastSubsectionEnd =
    matches[matches.length - 1].index! + matches[matches.length - 1][0].length
  const afterLastSubsection = restOfPrompt.substring(lastSubsectionEnd)

  // Find the start of shared sections (INDICES, ATTENTION, EXEMPLES, Format, etc.)
  const sharedSectionsPattern =
    /^(INDICES|ATTENTION|EXEMPLES|FORMAT|IMPORTANT|NOTE|RÈGLES|GESTION|OÙ|EXTRACTION|GESTION DES|CORRECTION|EXEMPLES DE|ATTENTION -|IMPORTANT -|Format|Format de sortie)/im
  const sharedSectionsMatch = afterLastSubsection.match(sharedSectionsPattern)

  let sharedSectionsContent = ""
  if (sharedSectionsMatch) {
    const sharedStartIndex = afterLastSubsection.indexOf(sharedSectionsMatch[0])
    sharedSectionsContent = afterLastSubsection.substring(sharedStartIndex)
  } else {
    const contentAfterLast = afterLastSubsection.trim()
    if (contentAfterLast && !contentAfterLast.match(/^\d+\./)) {
      sharedSectionsContent = contentAfterLast
    }
  }

  // Extract each subsection with its specific content
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    const number = parseInt(match[1], 10)
    const title = match[2].trim()

    const subsectionStart = match.index! + match[0].length
    const subsectionEnd =
      i < matches.length - 1 ? matches[i + 1].index! : lastSubsectionEnd

    const subsectionContent = restOfPrompt
      .substring(subsectionStart, subsectionEnd)
      .trim()

    const subsectionHeader = restOfPrompt.substring(
      match.index!,
      match.index! + match[0].length
    )
    const fullSubsectionContent = sharedSectionsContent
      ? `${beforeChamps}${subsectionHeader}${subsectionContent}\n\n${sharedSectionsContent}`
      : `${beforeChamps}${subsectionHeader}${subsectionContent}`

    subsections.push({
      number,
      title,
      content: fullSubsectionContent,
    })
  }

  return subsections
}

function createFieldConfigs(
  section: string,
  prompt: string,
  startId: number
): FieldConfig[] {
  const subsections = parsePromptSubsections(prompt)

  // If no subsections found, return single field with full prompt
  if (subsections.length === 0) {
    return [
      {
        label: getSectionLabel(section),
        id: `prompt${startId}`,
        fieldId: section,
        section,
        content: prompt,
      },
    ]
  }

  // Return multiple fields, one per subsection
  return subsections.map((subsection, index) => ({
    label: `${getSectionLabel(section)} - ${subsection.title}`,
    id: `prompt${startId + index}`,
    fieldId: `${section}_${subsection.number}`,
    section,
    subsection: subsection.title,
    content: subsection.content,
  }))
}

function buildFieldsConfig(): FieldConfig[] {
  const fields: FieldConfig[] = [
    {
      label: getSectionLabel("system"),
      id: "prompt1",
      fieldId: "system",
      section: "system",
      content: SYSTEM_INSTRUCTIONS,
    },
  ]

  let nextId = 2
  for (const extractionPrompt of EXTRACTION_PROMPTS) {
    const prompt =
      PROMPT_MAP[extractionPrompt.section] || extractionPrompt.prompt
    const newFields = createFieldConfigs(
      extractionPrompt.section,
      prompt,
      nextId
    )
    fields.push(...newFields)
    nextId += newFields.length
  }

  return fields
}

export const fieldsConfig: FieldConfig[] = buildFieldsConfig()
