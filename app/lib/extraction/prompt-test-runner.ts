import fs from "fs/promises"
import path from "path"

import {
  ExtractionService,
  type ExtractionServiceOptions,
} from "./extraction-service"
import type { ExtractionSection, LeaseExtractionResult } from "./types"
import { postProcessExtraction } from "./post-process"
import {
  EXTRACTION_PROMPTS,
  SYSTEM_INSTRUCTIONS,
  type ExtractionPrompt,
} from "./prompts"
import type { PdfExtractionResult } from "./pdf-extractor"

export type AssertionMode = "exact" | "number" | "stringIncludes" | "date"

export type ToleranceType =
  | "exact"
  | "contains"
  | "numeric_5pct"
  | "numeric_10pct"

export interface FieldAssertion {
  path: string
  expected: unknown
  mode?: AssertionMode
  tolerance?: number
  dependsOn?: string[]
  contextOverrides?: Record<string, unknown>
  comment?: string
  critical?: boolean
}

export interface EnhancedExpectation {
  expected: unknown
  tolerance: ToleranceType
  comment?: string
  dependsOn?: string[]
}

export interface EnhancedGroundTruth {
  documentId: string
  documentPath: string
  description?: string
  expectations: Record<string, Record<string, EnhancedExpectation>>
  fieldDependencies?: Record<
    string,
    { dependsOn: string[]; computation: string }
  >
  notes?: string[]
}

export interface GroundTruthCase {
  id: string
  description?: string
  documentPath: string
  fileName?: string
  expected: FieldAssertion[]
}

export type GroundTruthConfig = GroundTruthCase | EnhancedGroundTruth

export interface PromptOverrides {
  systemInstructions?: string
  prompts?: Array<{
    section: ExtractionSection
    prompt?: string
    retryable?: boolean
  }>
}

export interface FieldAssertionResult {
  path: string
  mode: AssertionMode
  expected: unknown
  actual: unknown
  success: boolean
  skipped: boolean
  reason?: string
  comment?: string
  critical?: boolean
}

export interface PromptTestCaseResult {
  caseId: string
  description?: string
  documentPath: string
  assertions: FieldAssertionResult[]
  summary: {
    total: number
    passed: number
    failed: number
    skipped: number
  }
  durationMs: number
}

export interface PromptTestRunnerOptions {
  promptOverrides?: PromptOverrides
  verbose?: boolean
}

function isEnhancedGroundTruth(
  config: GroundTruthConfig
): config is EnhancedGroundTruth {
  return "expectations" in config && typeof config.expectations === "object"
}

function convertToleranceToMode(tolerance: ToleranceType): {
  mode: AssertionMode
  numericTolerance: number
} {
  switch (tolerance) {
    case "contains":
      return { mode: "stringIncludes", numericTolerance: 0 }
    case "numeric_5pct":
      return { mode: "number", numericTolerance: 0.05 }
    case "numeric_10pct":
      return { mode: "number", numericTolerance: 0.1 }
    case "exact":
    default:
      return { mode: "exact", numericTolerance: 0 }
  }
}

function convertEnhancedToAssertions(
  config: EnhancedGroundTruth
): FieldAssertion[] {
  const assertions: FieldAssertion[] = []
  const dependencies = config.fieldDependencies ?? {}

  for (const [section, fields] of Object.entries(config.expectations)) {
    for (const [fieldPath, expectation] of Object.entries(fields)) {
      const fullPath = `${section}.${fieldPath}`
      const { mode, numericTolerance } = convertToleranceToMode(
        expectation.tolerance
      )

      let tolerance = numericTolerance
      if (mode === "number" && numericTolerance > 0) {
        const expectedNum =
          typeof expectation.expected === "number"
            ? expectation.expected
            : Number(expectation.expected)
        if (!Number.isNaN(expectedNum)) {
          tolerance = Math.abs(expectedNum * numericTolerance)
        }
      }

      const fieldDeps =
        dependencies[fullPath]?.dependsOn ?? expectation.dependsOn ?? []

      assertions.push({
        path: fullPath,
        expected: expectation.expected,
        mode,
        tolerance,
        dependsOn: fieldDeps.length > 0 ? fieldDeps : undefined,
        comment: expectation.comment,
      })
    }
  }

  return assertions
}

function normalizeGroundTruth(config: GroundTruthConfig): {
  id: string
  description?: string
  documentPath: string
  fileName?: string
  expected: FieldAssertion[]
} {
  if (isEnhancedGroundTruth(config)) {
    return {
      id: config.documentId,
      description: config.description,
      documentPath: config.documentPath,
      expected: convertEnhancedToAssertions(config),
    }
  }
  return config
}

export async function runPromptTestCase(
  caseFilePath: string,
  options?: PromptTestRunnerOptions
): Promise<PromptTestCaseResult> {
  const rawConfig = await readJsonFile<GroundTruthConfig>(caseFilePath)
  const caseConfig = normalizeGroundTruth(rawConfig)
  const resolvedDocumentPath = resolveDocumentPath(
    caseConfig.documentPath,
    caseFilePath
  )
  const parsedDocument =
    await readJsonFile<PdfExtractionResult>(resolvedDocumentPath)

  const extractionOptions: ExtractionServiceOptions = {
    systemInstructions:
      options?.promptOverrides?.systemInstructions ?? SYSTEM_INSTRUCTIONS,
    prompts: applyPromptOverrides(EXTRACTION_PROMPTS, options?.promptOverrides),
    enableRagIngestion: false,
  }

  const extractionService = new ExtractionService(
    undefined,
    undefined,
    extractionOptions
  )

  const fileName = caseConfig.fileName ?? path.basename(caseConfig.documentPath)

  const start = Date.now()
  const extractionResult = await extractionService.extractFromParsedDocument(
    parsedDocument,
    fileName
  )
  const processedResult = postProcessExtraction(extractionResult)

  const assertions = evaluateAssertions(processedResult, caseConfig.expected)

  const summary = assertions.reduce(
    (acc, assertion) => {
      if (assertion.skipped) {
        acc.skipped += 1
      } else if (assertion.success) {
        acc.passed += 1
      } else {
        acc.failed += 1
      }
      return acc
    },
    { total: assertions.length, passed: 0, failed: 0, skipped: 0 }
  )

  return {
    caseId: caseConfig.id,
    description: caseConfig.description,
    documentPath: resolvedDocumentPath,
    assertions,
    summary,
    durationMs: Date.now() - start,
  }
}

export async function loadPromptOverrides(
  filePath: string
): Promise<PromptOverrides> {
  return readJsonFile<PromptOverrides>(filePath)
}

function applyPromptOverrides(
  basePrompts: ExtractionPrompt[],
  overrides?: PromptOverrides
): ExtractionPrompt[] {
  if (!overrides?.prompts?.length) {
    return basePrompts
  }

  const promptMap = new Map(
    basePrompts.map((prompt) => [prompt.section, { ...prompt }])
  )

  for (const override of overrides.prompts) {
    const current = promptMap.get(override.section)
    if (current) {
      promptMap.set(override.section, {
        ...current,
        prompt: override.prompt ?? current.prompt,
        retryable:
          typeof override.retryable === "boolean"
            ? override.retryable
            : current.retryable,
      })
    } else {
      promptMap.set(override.section, {
        section: override.section,
        prompt: override.prompt ?? "",
        retryable: override.retryable ?? true,
      })
    }
  }

  return Array.from(promptMap.values())
}

function evaluateAssertions(
  result: LeaseExtractionResult,
  assertions: FieldAssertion[]
): FieldAssertionResult[] {
  return assertions.map((assertion) => evaluateAssertion(result, assertion))
}

function evaluateAssertion(
  result: LeaseExtractionResult,
  assertion: FieldAssertion
): FieldAssertionResult {
  const mode: AssertionMode = assertion.mode ?? "exact"
  const dependencies = assertion.dependsOn ?? []

  const dependencyMissing = dependencies.find((path) => {
    const value = getValueAtPath(result, path)
    return value === undefined || value === null
  })

  if (dependencyMissing) {
    return {
      path: assertion.path,
      expected: assertion.expected,
      actual: undefined,
      success: false,
      skipped: true,
      reason: `Dependency ${dependencyMissing} missing`,
      mode,
      comment: assertion.comment,
      critical: assertion.critical,
    }
  }

  const evaluationTarget = applyContextOverrides(
    result,
    assertion.contextOverrides
  )
  const actualValue = getValueAtPath(evaluationTarget, assertion.path)
  const success = compareValues(
    actualValue,
    assertion.expected,
    mode,
    assertion.tolerance ?? 0
  )

  return {
    path: assertion.path,
    expected: assertion.expected,
    actual: actualValue,
    success,
    skipped: false,
    reason: success ? undefined : "Value mismatch",
    mode,
    comment: assertion.comment,
    critical: assertion.critical,
  }
}

function compareValues(
  actual: unknown,
  expected: unknown,
  mode: AssertionMode,
  tolerance: number
): boolean {
  switch (mode) {
    case "number": {
      const actualNumber = typeof actual === "number" ? actual : Number(actual)
      const expectedNumber =
        typeof expected === "number" ? expected : Number(expected)
      if (Number.isNaN(actualNumber) || Number.isNaN(expectedNumber)) {
        return false
      }
      return Math.abs(actualNumber - expectedNumber) <= tolerance
    }
    case "stringIncludes": {
      if (actual == null || expected == null) {
        return false
      }
      const actualText = String(actual).toLowerCase()
      const expectedText = String(expected).toLowerCase()
      return actualText.includes(expectedText)
    }
    case "date": {
      if (!actual || !expected) {
        return false
      }
      const actualDate = new Date(String(actual))
      const expectedDate = new Date(String(expected))
      if (
        Number.isNaN(actualDate.getTime()) ||
        Number.isNaN(expectedDate.getTime())
      ) {
        return false
      }
      return actualDate.toISOString() === expectedDate.toISOString()
    }
    case "exact":
    default:
      return JSON.stringify(actual) === JSON.stringify(expected)
  }
}

function isExtractedValue(obj: unknown): obj is { value: unknown } {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "value" in obj &&
    "confidence" in obj
  )
}

function getValueAtPath(object: unknown, path: string): unknown {
  if (!object) {
    return undefined
  }
  const segments = path.split(".")
  let current: unknown = object
  for (const segment of segments) {
    if (
      current === undefined ||
      current === null ||
      typeof current !== "object"
    ) {
      return undefined
    }
    current = (current as Record<string, unknown>)[segment]
  }

  if (isExtractedValue(current)) {
    return current.value
  }
  return current
}

function applyContextOverrides(
  result: LeaseExtractionResult,
  overrides?: Record<string, unknown>
): LeaseExtractionResult {
  if (!overrides || Object.keys(overrides).length === 0) {
    return result
  }
  const clone =
    typeof structuredClone === "function"
      ? structuredClone(result)
      : (JSON.parse(JSON.stringify(result)) as LeaseExtractionResult)

  const mutableClone = clone as unknown as Record<string, unknown>
  for (const [path, value] of Object.entries(overrides)) {
    setValueAtPath(mutableClone, path, value)
  }

  return clone
}

function setValueAtPath(
  target: Record<string, unknown>,
  path: string,
  value: unknown
) {
  const segments = path.split(".")
  let current: Record<string, unknown> = target
  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i]
    const node = current[segment]
    if (!node || typeof node !== "object") {
      current[segment] = {}
    }
    current = current[segment] as Record<string, unknown>
  }
  current[segments[segments.length - 1]] = value
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const resolved = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath)
  const raw = await fs.readFile(resolved, "utf-8")
  return JSON.parse(raw) as T
}

function resolveDocumentPath(docPath: string, caseFilePath: string): string {
  if (path.isAbsolute(docPath)) {
    return docPath
  }
  if (docPath.startsWith(".")) {
    return path.resolve(path.dirname(caseFilePath), docPath)
  }
  return path.resolve(process.cwd(), docPath)
}
