/**
 * Prompt Service - Abstraction layer for prompt management
 * Currently uses hardcoded defaults, designed for future DB integration
 */

import type { ExtractionSection } from "./types"
import { PROMPT_METADATA, SYSTEM_PROMPT_METADATA } from "./prompt-metadata"
import { EXTRACTION_PROMPTS, SYSTEM_INSTRUCTIONS } from "./prompts"

export interface PromptOverride {
  section: ExtractionSection | "system"
  prompt: string
  updatedAt: Date
  updatedBy?: string
}

export interface PromptWithMetadata {
  section: ExtractionSection | "system"
  label: string
  currentPrompt: string
  defaultPrompt: string
  isOverridden: boolean
  retryable: boolean
  updatedAt?: Date
  updatedBy?: string
}

export interface PromptTestRequest {
  section: ExtractionSection
  promptOverride?: string
  documentId: string
}

export interface PromptTestResult {
  section: ExtractionSection
  documentId: string
  promptUsed: string
  extractionResult: Record<string, unknown>
  groundTruthComparison?: {
    passed: number
    failed: number
    total: number
    details: Array<{
      field: string
      expected: unknown
      actual: unknown
      passed: boolean
    }>
  }
  durationMs: number
}

type PromptSection = ExtractionSection | "system"

const inMemoryOverrides = new Map<PromptSection, PromptOverride>()

export class PromptService {
  /**
   * Get all prompts with their current state and metadata
   */
  async getAllPrompts(): Promise<PromptWithMetadata[]> {
    const systemOverride = await this.getOverride("system")
    const systemPrompt = this.buildPromptWithMetadata(
      "system",
      SYSTEM_PROMPT_METADATA.label,
      SYSTEM_INSTRUCTIONS,
      false,
      systemOverride
    )

    const sectionPrompts = await Promise.all(
      PROMPT_METADATA.map(async (metadata) => {
        const override = await this.getOverride(metadata.section)
        return this.buildPromptWithMetadata(
          metadata.section,
          metadata.label,
          metadata.prompt,
          metadata.retryable,
          override
        )
      })
    )

    return [systemPrompt, ...sectionPrompts]
  }

  /**
   * Get a specific prompt by section
   */
  async getPrompt(
    section: ExtractionSection | "system"
  ): Promise<PromptWithMetadata | null> {
    if (section === "system") {
      const override = await this.getOverride("system")
      return this.buildPromptWithMetadata(
        "system",
        SYSTEM_PROMPT_METADATA.label,
        SYSTEM_INSTRUCTIONS,
        false,
        override
      )
    }

    const metadata = PROMPT_METADATA.find((p) => p.section === section)
    if (!metadata) {
      return null
    }

    const override = await this.getOverride(section)
    return this.buildPromptWithMetadata(
      metadata.section,
      metadata.label,
      metadata.prompt,
      metadata.retryable,
      override
    )
  }

  /**
   * Update a prompt (creates an override)
   */
  async updatePrompt(
    section: PromptSection,
    prompt: string,
    userId?: string
  ): Promise<PromptWithMetadata> {
    const override: PromptOverride = {
      section,
      prompt,
      updatedAt: new Date(),
      updatedBy: userId,
    }

    // TODO: When DB is ready, save to database
    // await prisma.extractionPrompt.upsert({
    //   where: { section },
    //   update: { prompt, updatedAt: new Date(), updatedBy: userId },
    //   create: { section, prompt, updatedBy: userId },
    // })

    // For now, use in-memory storage
    inMemoryOverrides.set(section, override)

    const result = await this.getPrompt(section)
    if (!result) {
      throw new Error(`Unknown section: ${section}`)
    }
    return result
  }

  /**
   * Reset a prompt to its default (removes override)
   */
  async resetPrompt(section: PromptSection): Promise<PromptWithMetadata> {
    // TODO: When DB is ready, delete from database
    // await prisma.extractionPrompt.delete({ where: { section } }).catch(() => {})

    inMemoryOverrides.delete(section)

    const result = await this.getPrompt(section)
    if (!result) {
      throw new Error(`Unknown section: ${section}`)
    }
    return result
  }

  /**
   * Get the prompts array formatted for the extraction service
   */
  async getExtractionPrompts(): Promise<
    Array<{
      section: ExtractionSection
      prompt: string
      retryable: boolean
    }>
  > {
    const allPrompts = await this.getAllPrompts()
    return allPrompts
      .filter((p) => p.section !== "system")
      .map((p) => ({
        section: p.section as ExtractionSection,
        prompt: p.currentPrompt,
        retryable: p.retryable,
      }))
  }

  /**
   * Get the system instructions (with override if exists)
   */
  async getSystemInstructions(): Promise<string> {
    const prompt = await this.getPrompt("system")
    return prompt?.currentPrompt ?? SYSTEM_INSTRUCTIONS
  }

  /**
   * Get sections grouped by category for UI
   */
  getSectionGroups(): Record<
    string,
    Array<{ section: ExtractionSection; label: string }>
  > {
    const groups: Record<
      string,
      Array<{ section: ExtractionSection; label: string }>
    > = {
      "Informations générales": [
        { section: "regime", label: "Régime juridique" },
        { section: "parties", label: "Parties" },
        { section: "premises", label: "Locaux" },
        { section: "calendar", label: "Calendrier" },
      ],
      "Conditions financières": [
        { section: "supportMeasures", label: "Mesures d'accompagnement" },
        { section: "rent", label: "Loyer" },
        { section: "indexation", label: "Indexation" },
        { section: "taxes", label: "Taxes" },
        { section: "charges", label: "Charges" },
      ],
      "Garanties et assurances": [
        { section: "insurance", label: "Assurance" },
        { section: "securities", label: "Sûretés" },
      ],
      "Conditions d'occupation": [
        { section: "inventory", label: "État des lieux" },
        { section: "maintenance", label: "Entretien et travaux" },
        { section: "restitution", label: "Restitution" },
        { section: "transfer", label: "Cession et sous-location" },
      ],
      Annexes: [
        { section: "environmentalAnnexes", label: "Annexes environnementales" },
        { section: "otherAnnexes", label: "Autres annexes" },
        { section: "other", label: "Autres" },
      ],
    }
    return groups
  }

  /**
   * Get available ground truth documents for testing
   */
  async getAvailableTestDocuments(): Promise<
    Array<{
      id: string
      name: string
      path: string
    }>
  > {
    // For now, return hardcoded list. Later can scan directory
    return [
      {
        id: "bail-sans-difficulte",
        name: "Bail sans difficulté particulière",
        path: "tests/extraction/ground-truth/bail-sans-difficulte.json",
      },
    ]
  }

  private async getOverride(
    section: PromptSection
  ): Promise<PromptOverride | null> {
    // TODO: When DB is ready, query database
    // return prisma.extractionPrompt.findUnique({ where: { section } })

    return inMemoryOverrides.get(section) ?? null
  }

  private buildPromptWithMetadata(
    section: PromptSection,
    label: string,
    defaultPrompt: string,
    retryable: boolean,
    override?: PromptOverride | null
  ): PromptWithMetadata {
    return {
      section,
      label,
      currentPrompt: override?.prompt ?? defaultPrompt,
      defaultPrompt,
      isOverridden: Boolean(override),
      retryable,
      updatedAt: override?.updatedAt,
      updatedBy: override?.updatedBy,
    }
  }
}

export const promptService = new PromptService()

/**
 * Get extraction service options configured with current prompts
 * Use this when creating an ExtractionService to get the latest prompt overrides
 */
export async function getExtractionServiceOptions(): Promise<{
  systemInstructions: string
  prompts: Array<{
    section: ExtractionSection
    prompt: string
    retryable: boolean
  }>
}> {
  const [systemInstructions, prompts] = await Promise.all([
    promptService.getSystemInstructions(),
    promptService.getExtractionPrompts(),
  ])
  return { systemInstructions, prompts }
}
