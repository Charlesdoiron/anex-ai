/**
 * Test extraction on multiple leases
 */

import { ExtractionService } from "../app/lib/extraction/extraction-service"
import * as fs from "fs"
import path from "path"

const TEST_FILES = [
  "data/Bail Saint Priest_28 08 (draft).pdf",
  "data/Bail avec 1 avenant et conditions générales et particulières.pdf",
]

async function extractFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`)
    return null
  }

  const fileName = path.basename(filePath)
  console.log(`\n${"=".repeat(80)}`)
  console.log(`📄 Processing: ${fileName}`)
  console.log("=".repeat(80))

  const buffer = fs.readFileSync(filePath)

  const service = new ExtractionService(
    (progress) => {
      if (
        progress.status === "parsing_pdf" ||
        progress.status === "completed" ||
        progress.status === "validating"
      ) {
        console.log(`  [${progress.status}] ${progress.message}`)
      }
    },
    undefined,
    { enableRagIngestion: false }
  )

  try {
    const result = await service.extractFromPdf(buffer, fileName)

    console.log("\n📊 RÉSULTATS CLÉS:")
    console.log("-".repeat(40))

    // Parties
    console.log("\n## PARTIES")
    console.log(
      "  Bailleur:",
      result.parties?.landlord?.name?.value || "Non mentionné"
    )
    console.log(
      "  Preneur:",
      result.parties?.tenant?.name?.value || "Non mentionné"
    )

    // Calendar
    console.log("\n## CALENDRIER")
    console.log(
      "  Date d'effet:",
      result.calendar?.effectiveDate?.value || "Non mentionné"
    )
    console.log("  Durée:", result.calendar?.duration?.value || "Non mentionné")
    console.log(
      "  Date de fin:",
      result.calendar?.endDate?.value || "Non mentionné"
    )

    // Rent
    console.log("\n## LOYER")
    console.log(
      "  Loyer annuel HT:",
      result.rent?.annualRentExclTaxExclCharges?.value ?? "Non mentionné",
      "€"
    )
    console.log(
      "    → Source:",
      result.rent?.annualRentExclTaxExclCharges?.source || "-"
    )
    console.log(
      "  Loyer trimestriel HT:",
      result.rent?.quarterlyRentExclTaxExclCharges?.value ?? "Non mentionné",
      "€"
    )
    console.log(
      "  Loyer parking annuel:",
      result.rent?.annualParkingRentExclCharges?.value ?? "Non mentionné",
      "€"
    )

    // Indexation
    console.log("\n## INDEXATION")
    console.log(
      "  Clause d'indexation:",
      result.indexation?.hasIndexationClause?.value ?? "Non mentionné"
    )
    console.log(
      "  Type d'indice:",
      result.indexation?.indexationType?.value || "Non mentionné"
    )
    console.log(
      "  Trimestre référence:",
      result.indexation?.referenceQuarter?.value || "Non mentionné"
    )
    console.log(
      "    → RawText:",
      (result.indexation?.referenceQuarter?.rawText || "-").substring(0, 100)
    )

    // Support measures
    console.log("\n## MESURES D'ACCOMPAGNEMENT")
    console.log(
      "  Franchise de loyer:",
      result.supportMeasures?.hasRentFreeperiod?.value ?? "Non mentionné"
    )
    console.log(
      "  Description autres mesures:",
      (
        result.supportMeasures?.otherMeasuresDescription?.value ||
        "Non mentionné"
      ).substring(0, 80)
    )
    console.log(
      "  Durée (mois):",
      result.supportMeasures?.rentFreePeriodMonths?.value ?? "Non mentionné"
    )

    // Securities
    console.log("\n## SÛRETÉS")
    console.log(
      "  Dépôt de garantie:",
      result.securities?.securityDepositAmount?.value ?? "Non mentionné",
      "€"
    )
    console.log(
      "    → Source:",
      result.securities?.securityDepositAmount?.source || "-"
    )

    // Premises
    console.log("\n## LOCAUX")
    console.log(
      "  Surface:",
      result.premises?.surfaceArea?.value ?? "Non mentionné",
      "m²"
    )
    console.log(
      "  Adresse:",
      result.premises?.address?.value || "Non mentionné"
    )

    // Rent schedule
    if (result.rentSchedule) {
      const schedule = result.rentSchedule.schedule || []
      const summary = result.rentSchedule.summary
      console.log("\n## ÉCHÉANCIER DE LOYER")
      console.log(
        "  TCAM:",
        summary?.tcam ? `${(summary.tcam * 100).toFixed(2)}%` : "Non calculé"
      )
      console.log("  Nombre de périodes:", schedule.length)

      if (schedule.length > 0) {
        console.log("\n  Premières périodes:")
        const firstPeriods = schedule.slice(0, 6)
        for (const p of firstPeriods) {
          console.log(
            `    ${p.periodStart} → ${p.periodEnd}: ${p.officeRentHT.toFixed(2)}€ HT (indice: ${p.indexValue}, facteur: ${p.indexFactor.toFixed(4)})`
          )
        }

        if (schedule.length > 6) {
          console.log(
            `\n  ... et ${schedule.length - 6} périodes supplémentaires`
          )

          // Afficher la dernière période pour voir l'évolution
          const lastPeriod = schedule[schedule.length - 1]
          console.log(`\n  Dernière période:`)
          console.log(
            `    ${lastPeriod.periodStart} → ${lastPeriod.periodEnd}: ${lastPeriod.officeRentHT.toFixed(2)}€ HT (indice: ${lastPeriod.indexValue}, facteur: ${lastPeriod.indexFactor.toFixed(4)})`
          )
        }
      }

      if (summary?.yearlyTotals) {
        console.log("\n  Totaux annuels:")
        for (const y of summary.yearlyTotals.slice(0, 4)) {
          console.log(
            `    ${y.year}: Loyer ${y.baseRentHT.toFixed(2)}€ - Franchise ${Math.abs(y.franchiseHT).toFixed(2)}€ = Net ${y.netRentHT.toFixed(2)}€`
          )
        }
      }
    } else {
      console.log("\n## ÉCHÉANCIER DE LOYER")
      console.log("  ❌ Non calculé")
    }

    // Stats
    console.log("\n📈 STATISTIQUES")
    console.log(
      "  Champs extraits:",
      result.extractionMetadata?.extractedFields,
      "/",
      result.extractionMetadata?.totalFields
    )
    console.log("  Champs manquants:", result.extractionMetadata?.missingFields)
    console.log(
      "  Temps de traitement:",
      Math.round((result.extractionMetadata?.processingTimeMs || 0) / 1000),
      "s"
    )

    // Save result
    const outputPath = path.join(
      "data/test-results",
      fileName.replace(".pdf", "-extraction.json")
    )
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2))
    console.log("\n  💾 Résultat sauvegardé:", outputPath)

    return result
  } catch (error) {
    console.error(`❌ Extraction failed:`, error)
    return null
  }
}

async function main() {
  console.log("🚀 Test d'extraction sur plusieurs baux")
  console.log(`   ${TEST_FILES.length} fichiers à traiter\n`)

  for (const file of TEST_FILES) {
    await extractFile(file)
  }

  console.log("\n" + "=".repeat(80))
  console.log("✅ Tests terminés")
}

main().catch(console.error)
