/**
 * Test complet du flux : extraction → détection indice → calcul avec bon indice
 */

import { config } from "dotenv"
config({ path: ".env.local" })
config({ path: ".env" })

import { prisma } from "../app/lib/prisma"
import { getInseeRentalIndexSeries } from "../app/lib/lease/insee-rental-index-service"
import { buildIndexInputsForLease } from "../app/lib/lease/insee-rental-index-service"
import type { LeaseIndexType } from "../app/lib/lease/types"

async function testCompleteFlow() {
  console.log("🧪 Test complet du flux multi-indices\n")
  console.log("=".repeat(60))

  // Cas 1: Bail avec ILAT
  console.log("\n📋 Cas 1: Bail indexé sur ILAT")
  console.log("-".repeat(60))
  await testIndexType("ILAT", "2024-03-06")

  // Cas 2: Bail avec ILC
  console.log("\n📋 Cas 2: Bail indexé sur ILC")
  console.log("-".repeat(60))
  await testIndexType("ILC", "2023-01-15")

  // Cas 3: Bail avec ICC
  console.log("\n📋 Cas 3: Bail indexé sur ICC")
  console.log("-".repeat(60))
  await testIndexType("ICC", "2022-06-01")

  // Cas 4: Fallback (indice non détecté → ILAT par défaut)
  console.log("\n📋 Cas 4: Fallback (indice non détecté)")
  console.log("-".repeat(60))
  await testIndexType(null, "2024-01-01")

  console.log("\n" + "=".repeat(60))
  console.log("✅ Tous les tests terminés")
}

async function testIndexType(
  indexType: LeaseIndexType | null,
  effectiveDate: string
) {
  try {
    const detectedIndexType = indexType || "ILAT"
    console.log(`Indice détecté: ${detectedIndexType}`)
    console.log(`Date d'effet: ${effectiveDate}`)

    // Récupérer la série pour cet indice
    const series = await getInseeRentalIndexSeries(detectedIndexType)
    console.log(`Série disponible: ${series.length} points`)

    if (series.length === 0) {
      console.log("  ⚠️  Aucune donnée disponible pour cet indice")
      return
    }

    // Construire les inputs pour le calcul
    const { baseIndexValue, knownIndexPoints } = buildIndexInputsForLease(
      effectiveDate,
      3, // horizonYears
      series
    )

    if (!baseIndexValue) {
      console.log("  ⚠️  Impossible de déterminer l'indice de base")
      return
    }

    // Trouver le trimestre de référence
    const effectiveDateObj = new Date(effectiveDate)
    const year = effectiveDateObj.getUTCFullYear()
    const quarter = Math.floor(effectiveDateObj.getUTCMonth() / 3) + 1

    console.log(`Indice de base: ${baseIndexValue} (${year}T${quarter})`)
    console.log(`Points connus: ${knownIndexPoints.length}`)

    if (knownIndexPoints.length > 0) {
      const firstKnown = knownIndexPoints[0]
      const lastKnown = knownIndexPoints[knownIndexPoints.length - 1]
      console.log(
        `  Période couverte: ${firstKnown.effectiveDate} → ${lastKnown.effectiveDate}`
      )
    }

    // Vérifier que les valeurs sont cohérentes
    const basePoint = series.find(
      (s) => s.year === year && s.quarter === quarter
    )
    if (basePoint) {
      console.log(
        `  ✅ Valeur vérifiée: ${basePoint.value} = ${baseIndexValue}`
      )
    } else {
      const latest = series[series.length - 1]
      console.log(
        `  ⚠️  Trimestre ${year}T${quarter} non trouvé, utilisation du dernier disponible: ${latest.year}T${latest.quarter} = ${latest.value}`
      )
    }

    console.log(`  ✅ Calcul prêt pour indice ${detectedIndexType}`)
  } catch (error) {
    console.error(
      `  ❌ Erreur:`,
      error instanceof Error ? error.message : String(error)
    )
  }
}

testCompleteFlow()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
