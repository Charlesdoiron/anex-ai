/**
 * Test script to verify INSEE API route and database storage
 */

import { config } from "dotenv"
config({ path: ".env.local" })
config({ path: ".env" })

import { prisma } from "../app/lib/prisma"
import { getAvailableIndexTypes } from "../app/lib/lease/insee-rental-index-service"
import type { LeaseIndexType } from "../app/lib/lease/types"
import type { RentIndexPayload } from "../app/lib/insee/scrape-rental-index"

async function testApiAndStorage() {
  console.log("🧪 Test API et stockage INSEE\n")
  console.log("=".repeat(60))

  // Test 1: Vérifier l'état actuel de la base
  console.log("\n📊 Test 1: État actuel de la base de données")
  console.log("-".repeat(60))

  try {
    const totalCount = await prisma.insee_rental_reference_index.count()
    console.log(`Total d'enregistrements: ${totalCount}`)

    const availableTypes = await getAvailableIndexTypes()
    console.log(`Types disponibles: ${availableTypes.join(", ") || "Aucun"}`)

    if (availableTypes.length > 0) {
      for (const indexType of availableTypes) {
        const count = await prisma.insee_rental_reference_index.count({
          where: { indexType },
        })
        const latest = await prisma.insee_rental_reference_index.findFirst({
          where: { indexType },
          orderBy: [{ year: "desc" }, { quarter: "desc" }],
        })
        const oldest = await prisma.insee_rental_reference_index.findFirst({
          where: { indexType },
          orderBy: [{ year: "asc" }, { quarter: "asc" }],
        })

        if (latest && oldest) {
          console.log(
            `  ${indexType}: ${count} enregistrements (${oldest.year}T${oldest.quarter} → ${latest.year}T${latest.quarter})`
          )
        }
      }
    }
  } catch (error) {
    console.error("❌ Erreur lors de la lecture de la base:", error)
    if (error instanceof Error && error.message.includes("indexType")) {
      console.log("\n💡 La colonne indexType n'existe pas encore.")
      console.log("   Exécutez: npx prisma migrate deploy")
    }
  }

  // Test 2: Simuler l'appel API (scraper et sauvegarder)
  console.log("\n🚀 Test 2: Simulation de l'API (scraping + sauvegarde)")
  console.log("-".repeat(60))

  try {
    const { scrapeAllInseeRentalIndices, getConfiguredIndexTypes } =
      await import("../app/lib/insee/scrape-rental-index")

    const configuredTypes = getConfiguredIndexTypes()
    console.log(`Types à scraper: ${configuredTypes.join(", ")}`)

    const { results, errors } = await scrapeAllInseeRentalIndices()

    let totalSaved = 0
    for (const [indexType, payload] of Object.entries(results) as [
      LeaseIndexType,
      RentIndexPayload[],
    ][]) {
      if (payload.length > 0) {
        const saved = await prisma.insee_rental_reference_index.createMany({
          data: payload.map((item) => ({
            indexType: item.indexType,
            year: item.year,
            quarter: item.quarter,
            value: item.value,
            createdAt: item.createdAt ? new Date(item.createdAt) : undefined,
          })),
          skipDuplicates: true,
        })
        console.log(
          `  ✅ ${indexType}: ${payload.length} enregistrements scrapés, ${saved.count} nouveaux sauvegardés`
        )
        totalSaved += saved.count
      } else if (errors[indexType]) {
        console.log(`  ❌ ${indexType}: ${errors[indexType]}`)
      }
    }

    console.log(`\n📈 Total nouveaux enregistrements: ${totalSaved}`)
  } catch (error) {
    console.error("❌ Erreur lors du scraping/sauvegarde:", error)
  }

  // Test 3: Vérifier la récupération par type
  console.log("\n🔍 Test 3: Récupération par type d'indice")
  console.log("-".repeat(60))

  try {
    const { getInseeRentalIndexSeries } = await import(
      "../app/lib/lease/insee-rental-index-service"
    )

    for (const indexType of ["ILAT", "ILC", "ICC"] as const) {
      const series = await getInseeRentalIndexSeries(indexType)
      if (series.length > 0) {
        const latest = series[series.length - 1]
        const oldest = series[0]
        console.log(
          `  ${indexType}: ${series.length} points (${oldest.year}T${oldest.quarter} → ${latest.year}T${latest.quarter})`
        )
        console.log(`     Dernière valeur: ${latest.value}`)
      } else {
        console.log(`  ${indexType}: Aucune donnée disponible`)
      }
    }
  } catch (error) {
    console.error("❌ Erreur lors de la récupération:", error)
  }

  console.log("\n" + "=".repeat(60))
  console.log("✅ Tests terminés")
}

testApiAndStorage()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
