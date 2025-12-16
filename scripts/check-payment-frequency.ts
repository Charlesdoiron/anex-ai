/**
 * Script to check payment frequency in BAIL MCCF.pdf
 */

import * as fs from "fs"
import { extractPdfText } from "../app/lib/extraction/pdf-extractor"

async function main() {
  const pdfPath = "data/data-adjust-4/BAIL MCCF.pdf"
  const buffer = fs.readFileSync(pdfPath)

  console.log("Extracting text from PDF...")
  const pdfData = await extractPdfText(buffer, {
    onStatus: (msg) => console.log(msg),
  })

  const text = pdfData.text.toLowerCase()

  console.log("\n" + "=".repeat(80))
  console.log("RECHERCHE DE LA FRÉQUENCE DE PAIEMENT")
  console.log("=".repeat(80))

  // Chercher les mots-clés liés à la fréquence de paiement
  const keywords = {
    quarterly: [
      "trimestriel",
      "trimestre",
      "terme",
      "terme échu",
      "à terme",
      "par trimestre",
      "chaque trimestre",
      "trimestriellement",
    ],
    monthly: [
      "mensuel",
      "mensuellement",
      "par mois",
      "chaque mois",
      "mensuelle",
    ],
  }

  console.log("\n--- MENTIONS TRIMESTRIELLES ---")
  for (const keyword of keywords.quarterly) {
    const regex = new RegExp(`.{0,100}${keyword}.{0,100}`, "gi")
    const matches = text.match(regex)
    if (matches && matches.length > 0) {
      console.log(`\n✅ "${keyword}" trouvé:`)
      matches.slice(0, 3).forEach((match, idx) => {
        console.log(`  ${idx + 1}. ${match.trim()}`)
      })
    }
  }

  console.log("\n--- MENTIONS MENSUELLES ---")
  for (const keyword of keywords.monthly) {
    const regex = new RegExp(`.{0,100}${keyword}.{0,100}`, "gi")
    const matches = text.match(regex)
    if (matches && matches.length > 0) {
      console.log(`\n✅ "${keyword}" trouvé:`)
      matches.slice(0, 3).forEach((match, idx) => {
        console.log(`  ${idx + 1}. ${match.trim()}`)
      })
    }
  }

  // Chercher spécifiquement dans les sections LOYER
  console.log("\n--- SECTIONS LOYER / PAIEMENT ---")
  const loyerSections = text.split(/\b(loyer|paiement|payable|exigible)\b/gi)
  const relevantSections = loyerSections
    .filter((section) => {
      const lower = section.toLowerCase()
      return (
        lower.includes("trimest") ||
        lower.includes("mensuel") ||
        lower.includes("terme") ||
        lower.includes("mois")
      )
    })
    .slice(0, 10)

  if (relevantSections.length > 0) {
    console.log("\nSections pertinentes trouvées:")
    relevantSections.forEach((section, idx) => {
      const trimmed = section.trim().substring(0, 200)
      console.log(`\n${idx + 1}. ...${trimmed}...`)
    })
  }

  // Chercher dans TITRE I et TITRE II
  console.log("\n--- TITRE I - CONDITIONS GÉNÉRALES ---")
  const titre1Match = text.match(/titre\s+i[^\n]{0,2000}/gi)
  if (titre1Match) {
    const titre1Text = titre1Match[0]
    const loyerInTitre1 = titre1Text.match(
      /.{0,300}(loyer|paiement|payable|exigible).{0,300}/gi
    )
    if (loyerInTitre1) {
      loyerInTitre1.forEach((match, idx) => {
        console.log(`\n${idx + 1}. ${match.substring(0, 400)}...`)
      })
    }
  }

  console.log("\n--- TITRE II - CONDITIONS PARTICULIÈRES ---")
  const titre2Match = text.match(/titre\s+ii[^\n]{0,2000}/gi)
  if (titre2Match) {
    const titre2Text = titre2Match[0]
    const loyerInTitre2 = titre2Text.match(
      /.{0,300}(loyer|paiement|payable|exigible).{0,300}/gi
    )
    if (loyerInTitre2) {
      loyerInTitre2.forEach((match, idx) => {
        console.log(`\n${idx + 1}. ${match.substring(0, 400)}...`)
      })
    }
  }

  // Sauvegarder un extrait du texte pour inspection manuelle
  const outputPath = "data/test-results/bail-mccf-text-excerpt.txt"
  fs.mkdirSync("data/test-results", { recursive: true })
  fs.writeFileSync(
    outputPath,
    text.substring(0, 50000) + "\n\n[... texte tronqué ...]"
  )
  console.log(`\n✅ Extrait du texte sauvegardé dans: ${outputPath}`)
}

main().catch(console.error)
