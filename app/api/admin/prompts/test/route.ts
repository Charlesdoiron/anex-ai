import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import { auth } from "@/app/lib/auth"
import { ExtractionService } from "@/app/lib/extraction/extraction-service"
import { postProcessExtraction } from "@/app/lib/extraction/post-process"
import { promptService } from "@/app/lib/extraction/prompt-service"
import type { ExtractionSection } from "@/app/lib/extraction/types"
import type { PdfExtractionResult } from "@/app/lib/extraction/pdf-extractor"
import { getOpenAIClient } from "@/app/lib/openai/client"
import {
  getPromptBySection,
  type PromptMetadata,
} from "@/app/lib/extraction/prompt-metadata"

const VALIDATION_MODEL = "gpt-5-nano"

async function requireAdmin(request: NextRequest) {
  const skipAuth = process.env.SKIP_AUTH === "true"
  if (skipAuth) {
    return { userId: "dev-user" }
  }

  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user?.id) {
    return null
  }

  return { userId: session.user.id }
}

interface TestRequestBody {
  section: ExtractionSection
  promptOverride?: string
  documentId: string
}

interface GroundTruthExpectation {
  expected: unknown
  tolerance: string
  comment?: string
}

interface GroundTruthFile {
  documentId: string
  documentPath: string
  expectations: Record<string, Record<string, GroundTruthExpectation>>
}

interface ComparisonDetail {
  field: string
  expected: unknown
  actual: unknown
  passed: boolean
  tolerance: string
  comment?: string
}

/**
 * POST /api/admin/prompts/test
 * Test a prompt against ground truth
 */
export async function POST(request: NextRequest) {
  const adminUser = await requireAdmin(request)
  if (!adminUser) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Authentication required" },
      { status: 401 }
    )
  }

  try {
    const body: TestRequestBody = await request.json()
    const { section, promptOverride, documentId } = body

    if (!section || !documentId) {
      return NextResponse.json(
        {
          error: "invalid_input",
          message: "section and documentId are required",
        },
        { status: 400 }
      )
    }

    // Load ground truth file
    const groundTruthPath = path.resolve(
      process.cwd(),
      "tests/extraction/ground-truth",
      `${documentId}.json`
    )

    let groundTruth: GroundTruthFile
    try {
      const raw = await fs.readFile(groundTruthPath, "utf-8")
      groundTruth = JSON.parse(raw)
    } catch {
      return NextResponse.json(
        {
          error: "ground_truth_not_found",
          message: `Ground truth file not found for document: ${documentId}`,
        },
        { status: 404 }
      )
    }

    // Load parsed document
    const documentPath = path.resolve(process.cwd(), groundTruth.documentPath)
    let parsedDocument: PdfExtractionResult
    try {
      const raw = await fs.readFile(documentPath, "utf-8")
      parsedDocument = JSON.parse(raw)
    } catch {
      return NextResponse.json(
        {
          error: "document_not_found",
          message: `Parsed document not found at: ${groundTruth.documentPath}`,
        },
        { status: 404 }
      )
    }

    // Get current prompts with optional override
    const systemInstructions = await promptService.getSystemInstructions()
    const extractionPrompts = await promptService.getExtractionPrompts()

    // Apply prompt override for the tested section
    const promptsWithOverride = promptOverride
      ? extractionPrompts.map((p) =>
          p.section === section ? { ...p, prompt: promptOverride } : p
        )
      : extractionPrompts

    // Filter to only run the tested section
    const singleSectionPrompts = promptsWithOverride.filter(
      (p) => p.section === section
    )

    // Run extraction for the specific section
    const extractionService = new ExtractionService(undefined, undefined, {
      systemInstructions,
      prompts: singleSectionPrompts,
      enableRagIngestion: false,
    })

    const start = Date.now()
    const extractionResult = await extractionService.extractFromParsedDocument(
      parsedDocument,
      `${documentId}.pdf`
    )
    const processedResult = postProcessExtraction(extractionResult)
    const durationMs = Date.now() - start

    // Compare with ground truth for this section using LLM
    const sectionExpectations = groundTruth.expectations[section] ?? {}
    const sectionMetadata = getPromptBySection(section)
    const comparison = await compareWithGroundTruthLLM(
      processedResult as unknown as Record<string, unknown>,
      section,
      sectionExpectations,
      sectionMetadata
    )

    // Get the actual extracted values for this section
    const sectionData = (processedResult as unknown as Record<string, unknown>)[
      section
    ]

    return NextResponse.json({
      success: true,
      section,
      documentId,
      promptUsed:
        promptOverride ??
        extractionPrompts.find((p) => p.section === section)?.prompt,
      extractionResult: sectionData,
      comparison,
      durationMs,
    })
  } catch (error) {
    console.error("Prompt test failed:", error)
    return NextResponse.json(
      {
        error: "test_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

async function compareWithGroundTruthLLM(
  result: Record<string, unknown>,
  section: string,
  expectations: Record<string, GroundTruthExpectation>,
  sectionMetadata?: PromptMetadata
): Promise<{
  passed: number
  failed: number
  total: number
  details: ComparisonDetail[]
}> {
  const details: ComparisonDetail[] = []
  const comparisons: Array<{
    field: string
    expected: unknown
    actual: unknown
    tolerance: string
    comment?: string
  }> = []

  // Collect all comparisons
  for (const [fieldPath, expectation] of Object.entries(expectations)) {
    const fullPath = `${section}.${fieldPath}`
    const actual = getValueAtPath(result, fullPath)
    const actualValue = unwrapExtractedValue(actual)

    comparisons.push({
      field: fieldPath,
      expected: expectation.expected,
      actual: actualValue,
      tolerance: expectation.tolerance,
      comment: expectation.comment,
    })
  }

  if (comparisons.length === 0) {
    return { passed: 0, failed: 0, total: 0, details: [] }
  }

  // Use fallback comparison (LLM validation disabled)
  let passed = 0
  let failed = 0

  for (const comp of comparisons) {
    const isPassed = fallbackCompare(comp.actual, comp.expected, comp.tolerance)

    if (isPassed) {
      passed += 1
    } else {
      failed += 1
    }

    details.push({
      field: comp.field,
      expected: comp.expected,
      actual: comp.actual,
      passed: isPassed,
      tolerance: comp.tolerance,
      comment: comp.comment,
    })
  }

  return {
    passed,
    failed,
    total: passed + failed,
    details,
  }
}

async function validateWithLLM(
  section: string,
  comparisons: Array<{
    field: string
    expected: unknown
    actual: unknown
    tolerance: string
    comment?: string
  }>,
  sectionMetadata?: PromptMetadata
): Promise<boolean[]> {
  const openai = getOpenAIClient()

  const comparisonText = comparisons
    .map((c, i) => {
      const expectedStr = formatValueForLLM(c.expected)
      const actualStr = formatValueForLLM(c.actual)
      const toleranceHint =
        c.tolerance === "contains"
          ? "Comparer le sens global (variations admises)"
          : c.tolerance === "exact"
            ? "Comparer le contenu précis"
            : "Comparer les valeurs numériques avec tolérance"
      const commentLine = c.comment
        ? `Contexte attendu: ${c.comment}`
        : "Contexte attendu: (non précisé)"
      return `${i + 1}. Champ "${c.field}" (${c.tolerance})
${commentLine}
Attendu : ${expectedStr}
Obtenu : ${actualStr}
Consigne : ${toleranceHint}`
    })
    .join("\n\n")

  const sectionContext = buildSectionContext(section, sectionMetadata)
  const prompt = `Tu es un validateur expert des extractions de baux commerciaux.

SECTION EN COURS :
${sectionContext}

OBJECTIF :
- Vérifier que la valeur obtenue respecte L'ESPRIT des consignes (résumé concis, catégories correctes, etc.).
- Accepter les formulations plus détaillées si elles ne contredisent pas l'attendu.
- Aucune pénalisation pour la ponctuation, la casse, les variations mineures.

RÈGLES DE VALIDATION :
- Deux valeurs sont ÉQUIVALENTES si elles représentent la même information
- "9" et "9 ans" → ÉQUIVALENT (même durée)
- "Bail commercial" et "commercial" → ÉQUIVALENT (même type)
- "16800" et "16 800 €" → ÉQUIVALENT (même montant)
- "2016-12-19" et "19 décembre 2016" → ÉQUIVALENT (même date)
- null/undefined et "Non mentionné" → ÉQUIVALENT si l'info n'existe pas
- Une valeur plus précise que l'attendue est OK (ex: "SCI RG7" vs "RG7")
- Lorsqu'une liste est attendue, vérifier que les catégories correspondent (même si la liste est plus détaillée)
- Ignorer les différences de casse, espaces, ordre, formatage

COMPARAISONS À ÉVALUER :
${comparisonText}

Réponds UNIQUEMENT avec un tableau JSON de booléens, un par comparaison.
Exemple pour 3 comparaisons : [true, false, true]`

  try {
    const response = await openai.responses.create({
      model: VALIDATION_MODEL,
      input: [{ role: "user", content: prompt }],
      text: { format: { type: "json_object" } },
    })

    const outputText = collectResponseText(response)
    if (!outputText) {
      console.warn("LLM validation returned empty response, using fallback")
      return comparisons.map((c) =>
        fallbackCompare(c.actual, c.expected, c.tolerance)
      )
    }

    const parsed = JSON.parse(outputText)

    // Handle different response formats
    let results: boolean[]
    if (Array.isArray(parsed)) {
      results = parsed
    } else if (parsed.results && Array.isArray(parsed.results)) {
      results = parsed.results
    } else if (parsed.validations && Array.isArray(parsed.validations)) {
      results = parsed.validations
    } else {
      // Try to extract boolean values from object
      results = Object.values(parsed).filter(
        (v) => typeof v === "boolean"
      ) as boolean[]
    }

    // Ensure we have the right number of results
    if (results.length !== comparisons.length) {
      console.warn(
        `LLM returned ${results.length} results for ${comparisons.length} comparisons, using fallback`
      )
      return comparisons.map((c) =>
        fallbackCompare(c.actual, c.expected, c.tolerance)
      )
    }

    return results
  } catch (error) {
    console.error("LLM validation failed:", error)
    return comparisons.map((c) =>
      fallbackCompare(c.actual, c.expected, c.tolerance)
    )
  }
}

function collectResponseText(response: {
  output?: Array<{
    type: string
    content?: Array<{ type: string; text?: string }>
  }>
}): string {
  if (!response.output) return ""
  let outputText = ""
  for (const item of response.output) {
    if (item.type === "message" && Array.isArray(item.content)) {
      for (const content of item.content) {
        if (
          content.type === "output_text" &&
          typeof content.text === "string"
        ) {
          outputText += content.text
        }
      }
    }
  }
  return outputText
}

function formatValueForLLM(value: unknown): string {
  if (value === null || value === undefined) return "null"
  if (typeof value === "string") return value || "(vide)"
  if (typeof value === "boolean") return value ? "Oui" : "Non"
  if (typeof value === "number") return String(value)
  if (Array.isArray(value)) {
    if (value.length === 0) return "(liste vide)"
    return value.join(", ")
  }
  return JSON.stringify(value)
}

function buildSectionContext(
  section: string,
  metadata?: PromptMetadata
): string {
  if (!metadata) {
    return `Section "${section}" (pas de métadonnées disponibles)`
  }
  const promptExcerpt = metadata.prompt
    ? truncateForLLM(metadata.prompt, 600)
    : "Pas de prompt détaillé"
  return [
    `Section "${metadata.label}" (${metadata.section})`,
    metadata.description
      ? `Description : ${metadata.description}`
      : "Description : (non fournie)",
    "Extrait du prompt :",
    promptExcerpt,
  ].join("\n")
}

function truncateForLLM(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text
  }
  return `${text.slice(0, maxLength)}…`
}

function fallbackCompare(
  actual: unknown,
  expected: unknown,
  tolerance: string
): boolean {
  if (expected === null && actual === null) return true
  if (expected === null || actual === null) return expected === actual

  switch (tolerance) {
    case "exact":
      return JSON.stringify(actual) === JSON.stringify(expected)

    case "contains": {
      if (actual == null || expected == null) return false
      const actualStr = String(actual).toLowerCase()
      const expectedStr = String(expected).toLowerCase()
      return actualStr.includes(expectedStr) || expectedStr.includes(actualStr)
    }

    case "numeric_5pct":
    case "numeric_10pct": {
      const actualNum =
        typeof actual === "number"
          ? actual
          : parseFloat(String(actual).replace(/[^\d.-]/g, ""))
      const expectedNum =
        typeof expected === "number"
          ? expected
          : parseFloat(String(expected).replace(/[^\d.-]/g, ""))
      if (Number.isNaN(actualNum) || Number.isNaN(expectedNum)) return false
      const pct = tolerance === "numeric_5pct" ? 0.05 : 0.1
      const maxDiff = Math.abs(expectedNum * pct)
      return Math.abs(actualNum - expectedNum) <= maxDiff
    }

    default:
      return JSON.stringify(actual) === JSON.stringify(expected)
  }
}

function getValueAtPath(obj: unknown, path: string): unknown {
  if (!obj) return undefined
  const segments = path.split(".")
  let current: unknown = obj
  for (const segment of segments) {
    if (current === null || current === undefined) return undefined
    if (typeof current !== "object") return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

function unwrapExtractedValue(value: unknown): unknown {
  if (
    typeof value === "object" &&
    value !== null &&
    "value" in value &&
    "confidence" in value
  ) {
    return (value as { value: unknown }).value
  }
  return value
}
