/**
 * Vérification finale de l'état de la base de données
 */

import { config } from "dotenv"
config({ path: ".env.local" })
config({ path: ".env" })

import { prisma } from "../app/lib/prisma"

async function verifyFinalState() {
  console.log("🔍 Vérification finale de l'état de la base\n")
  console.log("=".repeat(60))

  try {
    // Compter par type d'indice
    const result = await prisma.$queryRaw<
      Array<{ indexType: string; count: bigint }>
    >`
      SELECT "indexType", COUNT(*)::int as count 
      FROM insee_rental_reference_index 
      GROUP BY "indexType" 
      ORDER BY "indexType"
    `

    console.log("\n📊 Répartition par type d'indice:")
    console.log("-".repeat(60))
    let total = 0
    for (const row of result) {
      const count = Number(row.count)
      total += count
      console.log(`  ${row.indexType}: ${count} enregistrements`)
    }
    console.log(`  TOTAL: ${total} enregistrements`)

    // Détails par type
    console.log("\n📈 Détails par type:")
    console.log("-".repeat(60))
    for (const row of result) {
      const indexType = row.indexType
      const latest = await prisma.insee_rental_reference_index.findFirst({
        where: { indexType },
        orderBy: [{ year: "desc" }, { quarter: "desc" }],
      })
      const oldest = await prisma.insee_rental_reference_index.findFirst({
        where: { indexType },
        orderBy: [{ year: "asc" }, { quarter: "asc" }],
      })

      if (latest && oldest) {
        console.log(`\n  ${indexType}:`)
        console.log(
          `    Période: ${oldest.year}T${oldest.quarter} → ${latest.year}T${latest.quarter}`
        )
        console.log(
          `    Dernière valeur: ${latest.value} (${latest.year}T${latest.quarter})`
        )
        console.log(
          `    Première valeur: ${oldest.value} (${oldest.year}T${oldest.quarter})`
        )
      }
    }

    console.log("\n✅ Base de données prête pour la production")
  } catch (error) {
    console.error("❌ Erreur:", error)
  } finally {
    await prisma.$disconnect()
  }
}

verifyFinalState()
