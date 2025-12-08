/**
 * Test specific rent calculation example from client
 *
 * Client example:
 * - Lease starts April 5, 2024
 * - Base index Q1 2024: 100
 * - Annual rent: 3650 €HT → Quarterly: 912.5 €HT → Monthly: 304 €HT → Daily: 10 €HT
 * - Index on April 5, 2025: 110
 *
 * Expected calculations:
 * Q2 2024: 87 days (Apr 5 - Jun 30) × 10 €/day = 870 €HT
 * Q3 2024: 912.5 €HT
 * Q4 2024: 912.5 €HT
 * Q1 2025: 912.5 €HT
 * Q2 2025: [4 days (Apr 1-4) × 10 €] + [87 days (Apr 5-Jun 30) × 10 € × 1.1] = 40 + 957 = 997 €HT
 * Q3 2025: 912.5 × 1.1 = 1003.75 €HT
 * Q4 2025: 1003.75 €HT
 * Q1 2026: 1003.75 €HT
 */

import { computeLeaseRentSchedule } from "@/app/lib/lease/rent-schedule-calculator"
import type { ComputeLeaseRentScheduleInput } from "@/app/lib/lease/types"

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`)
  }
}

function assertClose(
  actual: number,
  expected: number,
  tolerance: number,
  message: string
): void {
  const diff = Math.abs(actual - expected)
  if (diff > tolerance) {
    throw new Error(
      `${message}\n  Expected: ${expected}\n  Actual: ${actual}\n  Diff: ${diff}`
    )
  }
}

async function main() {
  console.log("=".repeat(80))
  console.log("RENT CALCULATION TEST - CLIENT EXAMPLE")
  console.log("=".repeat(80))

  const input: ComputeLeaseRentScheduleInput = {
    startDate: "2024-04-05",
    endDate: "2026-04-05",
    paymentFrequency: "quarterly",
    baseIndexValue: 100,
    officeRentHT: 912.5, // Quarterly rent
    horizonYears: 3,
    knownIndexPoints: [
      {
        effectiveDate: "2025-04-05",
        indexValue: 110,
      },
    ],
  }

  console.log("\nInput:")
  console.log(`  Start date: ${input.startDate}`)
  console.log(`  End date: ${input.endDate}`)
  console.log(`  Frequency: ${input.paymentFrequency}`)
  console.log(`  Base index: ${input.baseIndexValue}`)
  console.log(`  Quarterly rent: ${input.officeRentHT} €HT`)
  console.log(`  Known index points:`)
  input.knownIndexPoints?.forEach((p) => {
    console.log(`    - ${p.effectiveDate}: ${p.indexValue}`)
  })

  const result = computeLeaseRentSchedule(input)

  console.log("\n" + "-".repeat(80))
  console.log("CALCULATED SCHEDULE")
  console.log("-".repeat(80))

  const tests: Array<{
    period: string
    year: number
    quarter: number
    expected: number
    description: string
  }> = [
    {
      period: "Q2 2024",
      year: 2024,
      quarter: 2,
      expected: 870,
      description: "87 days (Apr 5 - Jun 30) × 10 €/day",
    },
    {
      period: "Q3 2024",
      year: 2024,
      quarter: 3,
      expected: 912.5,
      description: "Full quarter at base index",
    },
    {
      period: "Q4 2024",
      year: 2024,
      quarter: 4,
      expected: 912.5,
      description: "Full quarter at base index",
    },
    {
      period: "Q1 2025",
      year: 2025,
      quarter: 1,
      expected: 912.5,
      description: "Full quarter at base index",
    },
    {
      period: "Q2 2025",
      year: 2025,
      quarter: 2,
      expected: 997,
      description: "4 days × 10 € + 87 days × 10 € × 1.1 = 40 + 957 = 997 €HT",
    },
    {
      period: "Q3 2025",
      year: 2025,
      quarter: 3,
      expected: 1003.75,
      description: "912.5 × 1.1",
    },
    {
      period: "Q4 2025",
      year: 2025,
      quarter: 4,
      expected: 1003.75,
      description: "912.5 × 1.1",
    },
    {
      period: "Q1 2026",
      year: 2026,
      quarter: 1,
      expected: 1003.75,
      description: "912.5 × 1.1",
    },
  ]

  let passed = 0
  let failed = 0
  const tolerance = 0.5 // Allow 0.50 € difference

  for (const test of tests) {
    const period = result.schedule.find(
      (p) => p.year === test.year && p.quarter === test.quarter
    )

    if (!period) {
      console.log(`\n❌ ${test.period}: Period not found in schedule`)
      failed++
      continue
    }

    const actual = period.officeRentHT
    const diff = Math.abs(actual - test.expected)
    const isCorrect = diff <= tolerance

    console.log(`\n${isCorrect ? "✅" : "❌"} ${test.period}:`)
    console.log(`  Period: ${period.periodStart} to ${period.periodEnd}`)
    console.log(`  Description: ${test.description}`)
    console.log(`  Expected: ${test.expected.toFixed(2)} €HT`)
    console.log(`  Actual: ${actual.toFixed(2)} €HT`)
    console.log(`  Index: ${period.indexValue} (factor: ${period.indexFactor})`)

    if (!isCorrect) {
      console.log(
        `  ⚠️  Difference: ${diff.toFixed(2)} € (tolerance: ${tolerance} €)`
      )
      failed++
    } else {
      passed++
    }
  }

  console.log("\n" + "-".repeat(80))
  console.log("FULL SCHEDULE DETAILS")
  console.log("-".repeat(80))

  for (const period of result.schedule) {
    console.log(
      `${period.periodStart} to ${period.periodEnd} | ` +
        `Q${period.quarter} ${period.year} | ` +
        `Index: ${period.indexValue.toFixed(2)} (×${period.indexFactor.toFixed(4)}) | ` +
        `Rent: ${period.officeRentHT.toFixed(2)} €HT | ` +
        `Total: ${period.netRentHT.toFixed(2)} €HT`
    )
  }

  console.log("\n" + "=".repeat(80))
  console.log("TEST RESULTS")
  console.log("=".repeat(80))
  console.log(`✅ Passed: ${passed}/${tests.length}`)
  console.log(`❌ Failed: ${failed}/${tests.length}`)
  console.log(`Accuracy: ${((passed / tests.length) * 100).toFixed(2)}%`)

  if (failed > 0) {
    console.log("\n⚠️  IMPORTANT NOTES:")
    console.log(
      "The current implementation applies the index to the entire period based on"
    )
    console.log(
      "the period start date. According to the client's example, Q2 2025 should be"
    )
    console.log(
      "split into two parts: days before and after the anniversary (April 5)."
    )
    console.log(
      "\nThis requires modifying the rent-schedule-calculator to detect anniversary"
    )
    console.log(
      "dates within a billing period and split the calculation accordingly."
    )
  }

  console.log("\n" + "=".repeat(80))

  process.exit(failed > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error("❌ Test failed with error:")
  console.error(error)
  process.exit(1)
})
