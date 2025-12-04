/**
 * Test script to verify INSEE scraper works with all 3 index types
 */

import { config } from "dotenv"
config({ path: ".env.local" })
config({ path: ".env" })

import {
  scrapeInseeRentalIndex,
  scrapeAllInseeRentalIndices,
  getConfiguredIndexTypes,
  type RentIndexPayload,
} from "../app/lib/insee/scrape-rental-index"
import {
  SUPPORTED_LEASE_INDEX_TYPES,
  type LeaseIndexType,
} from "../app/lib/lease/types"

async function testScraper() {
  console.log("🧪 Test du scraper INSEE\n")
  console.log("=".repeat(60))

  // Test 1: Vérifier les types configurés
  console.log("\n📋 Test 1: Types d'indices configurés")
  console.log("-".repeat(60))
  const configuredTypes = getConfiguredIndexTypes()
  console.log(`Types configurés: ${configuredTypes.join(", ")}`)
  console.log(`Types supportés: ${SUPPORTED_LEASE_INDEX_TYPES.join(", ")}`)

  if (configuredTypes.length === 0) {
    console.error(
      "❌ Aucun type configuré ! Vérifiez les variables d'environnement."
    )
    process.exit(1)
  }

  // Test 2: Scraper chaque indice individuellement
  console.log("\n📊 Test 2: Scraping individuel par indice")
  console.log("-".repeat(60))

  for (const indexType of configuredTypes) {
    try {
      console.log(`\n🔍 Scraping ${indexType}...`)
      const startTime = Date.now()
      const data = await scrapeInseeRentalIndex(indexType)
      const duration = Date.now() - startTime

      if (data.length === 0) {
        console.log(`  ⚠️  ${indexType}: Aucune donnée récupérée`)
      } else {
        const latest = data[data.length - 1]
        const oldest = data[0]
        console.log(`  ✅ ${indexType}: ${data.length} enregistrements`)
        console.log(
          `     Période: ${oldest.year}T${oldest.quarter} → ${latest.year}T${latest.quarter}`
        )
        console.log(
          `     Dernière valeur: ${latest.value} (${latest.year}T${latest.quarter})`
        )
        console.log(`     Durée: ${duration}ms`)
      }
    } catch (error) {
      console.error(
        `  ❌ ${indexType}: Erreur - ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // Test 3: Scraper tous les indices en parallèle
  console.log("\n🚀 Test 3: Scraping en parallèle (tous les indices)")
  console.log("-".repeat(60))

  try {
    const startTime = Date.now()
    const { results, errors } = await scrapeAllInseeRentalIndices()
    const duration = Date.now() - startTime

    console.log(`\nRésultats (durée totale: ${duration}ms):`)
    for (const [indexType, data] of Object.entries(results) as [
      LeaseIndexType,
      RentIndexPayload[],
    ][]) {
      if (data.length > 0) {
        console.log(`  ✅ ${indexType}: ${data.length} enregistrements`)
      } else if (errors[indexType]) {
        console.log(`  ❌ ${indexType}: ${errors[indexType]}`)
      } else {
        console.log(`  ⚠️  ${indexType}: Aucune donnée`)
      }
    }

    const totalRecords = Object.values(results).reduce(
      (sum, arr) => sum + arr.length,
      0
    )
    const errorCount = Object.values(errors).filter((e) => e).length

    console.log(`\n📈 Résumé:`)
    console.log(`   Total enregistrements: ${totalRecords}`)
    console.log(`   Erreurs: ${errorCount}`)
    console.log(
      `   Succès: ${configuredTypes.length - errorCount}/${configuredTypes.length}`
    )
  } catch (error) {
    console.error(`❌ Erreur lors du scraping en parallèle:`, error)
  }

  console.log("\n" + "=".repeat(60))
  console.log("✅ Tests terminés")
}

testScraper().catch(console.error)
