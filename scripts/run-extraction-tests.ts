import fs from "fs/promises"
import path from "path"

import {
  loadPromptOverrides,
  runPromptTestCase,
  type PromptTestCaseResult,
} from "@/app/lib/extraction/prompt-test-runner"

interface CliArgs {
  cases?: string[]
  groundTruthDir?: string
  promptsPath?: string
  output?: string
  verbose?: boolean
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.help) {
    printHelp()
    process.exit(0)
  }

  const groundTruthDir = path.resolve(
    process.cwd(),
    args.groundTruthDir ?? "tests/extraction/ground-truth"
  )

  const caseFiles = await resolveCaseFiles(groundTruthDir, args.cases)

  if (!caseFiles.length) {
    console.error("Aucun fichier de vérité terrain trouvé.")
    process.exit(1)
  }

  const overrides = args.promptsPath
    ? await loadPromptOverrides(path.resolve(process.cwd(), args.promptsPath))
    : undefined

  const results: PromptTestCaseResult[] = []
  let hasFailure = false

  for (const caseFile of caseFiles) {
    console.log(`\n▶︎ Test du cas ${path.basename(caseFile)}...`)
    try {
      const result = await runPromptTestCase(caseFile, {
        promptOverrides: overrides,
      })
      results.push(result)
      reportCaseResult(result, Boolean(args.verbose))
      if (result.summary.failed > 0) {
        hasFailure = true
      }
    } catch (error) {
      hasFailure = true
      console.error(
        `✖ Échec lors du traitement de ${caseFile}:`,
        error instanceof Error ? error.message : error
      )
    }
  }

  if (args.output) {
    await fs.writeFile(
      path.resolve(process.cwd(), args.output),
      JSON.stringify(results, null, 2),
      "utf-8"
    )
    console.log(`\nRapport exporté vers ${args.output}`)
  }

  if (hasFailure) {
    process.exit(1)
  }
}

function reportCaseResult(result: PromptTestCaseResult, verbose: boolean) {
  const { summary } = result
  console.log(
    `Résultat: ${summary.passed} ok / ${summary.failed} échecs / ${summary.skipped} ignorés (en ${result.durationMs}ms)`
  )

  if (!verbose) {
    return
  }

  for (const assertion of result.assertions) {
    if (assertion.skipped) {
      console.log(
        `  • ${assertion.path} (ignoré: ${assertion.reason ?? "dépendance manquante"})`
      )
      continue
    }
    const status = assertion.success ? "OK" : "KO"
    console.log(
      `  • [${status}] ${assertion.path} — attendu=${JSON.stringify(
        assertion.expected
      )}, obtenu=${JSON.stringify(assertion.actual)}`
    )
    if (!assertion.success && assertion.reason) {
      console.log(`      raison: ${assertion.reason}`)
    }
    if (assertion.comment) {
      console.log(`      note: ${assertion.comment}`)
    }
  }
}

async function resolveCaseFiles(
  dir: string,
  caseIds?: string[]
): Promise<string[]> {
  if (caseIds?.length) {
    return caseIds.map((caseId) =>
      path.resolve(dir, `${caseId.replace(/\.json$/, "")}.json`)
    )
  }

  const entries = await fs.readdir(dir, { withFileTypes: true })
  return entries
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith(".json") &&
        !entry.name.startsWith(".")
    )
    .map((entry) => path.resolve(dir, entry.name))
    .sort()
}

function parseArgs(argv: string[]) {
  const args: CliArgs & { help?: boolean } = {}
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    switch (arg) {
      case "--case":
      case "-c":
        args.cases = argv[++i]?.split(",").map((value) => value.trim())
        break
      case "--dir":
      case "-d":
        args.groundTruthDir = argv[++i]
        break
      case "--prompts":
      case "-p":
        args.promptsPath = argv[++i]
        break
      case "--output":
      case "-o":
        args.output = argv[++i]
        break
      case "--verbose":
      case "-v":
        args.verbose = true
        break
      case "--help":
      case "-h":
        args.help = true
        break
      default:
        console.warn(`Option inconnue ignorée: ${arg}`)
    }
  }
  return args
}

function printHelp() {
  console.log(`Usage: tsx scripts/run-extraction-tests.ts [options]

Options:
  -c, --case <ids>        Liste d'identifiants séparés par des virgules (sinon tous les cas)
  -d, --dir <path>        Dossier contenant les vérités terrain (défaut: tests/extraction/ground-truth)
  -p, --prompts <path>    Fichier JSON d'override de prompts
  -o, --output <path>     Fichier où exporter le rapport JSON
  -v, --verbose           Afficher le détail de chaque assertion
  -h, --help              Affiche cette aide
`)
}

void main()
