import { computeLeaseRentSchedule } from "../rent-schedule-calculator"

describe("computeLeaseRentSchedule", () => {
  it("builds a quarterly schedule with franchise, incentives and indexation", () => {
    const result = computeLeaseRentSchedule({
      startDate: "2024-03-06",
      endDate: "2025-03-05",
      paymentFrequency: "quarterly",
      baseIndexValue: 130.64,
      knownIndexPoints: [{ effectiveDate: "2025-01-01", indexValue: 136.45 }],
      chargesGrowthRate: 0.02,
      officeRentHT: 3000,
      parkingRentHT: 500,
      chargesHT: 300,
      taxesHT: 200,
      otherCostsHT: 0,
      depositMonths: 3,
      franchiseMonths: 6,
      incentiveAmount: 4000,
      horizonYears: 2,
    })

    expect(result.schedule).toHaveLength(5)

    const firstPeriod = result.schedule[0]
    expect(firstPeriod.periodStart).toBe("2024-03-06")
    expect(firstPeriod.periodEnd).toBe("2024-03-31")
    expect(firstPeriod.periodType).toBe("quarter")
    expect(firstPeriod.officeRentHT).toBeCloseTo(857.14, 2)
    expect(firstPeriod.parkingRentHT).toBeCloseTo(142.86, 2)
    expect(firstPeriod.chargesHT).toBeCloseTo(85.71, 2)
    expect(firstPeriod.taxesHT).toBeCloseTo(57.14, 2)
    expect(firstPeriod.franchiseHT).toBeCloseTo(-1000, 2)
    expect(firstPeriod.incentivesHT).toBeCloseTo(-4000, 2)

    const lastPeriod = result.schedule[result.schedule.length - 1]
    expect(lastPeriod.periodEnd).toBe("2025-03-05")
    expect(lastPeriod.quarter).toBe(1)
    expect(lastPeriod.indexFactor).toBeGreaterThanOrEqual(1)

    const totalNet = result.schedule.reduce(
      (sum, item) => sum + item.netRentHT,
      0
    )
    const summaryNet = result.summary.yearlyTotals.reduce(
      (sum, item) => sum + item.netRentHT,
      0
    )
    expect(totalNet).toBeCloseTo(summaryNet, 2)
    expect(result.summary.depositHT).toBeCloseTo(4000, 2)
    expect(result.summary.tcam).toBeGreaterThan(0)
  })

  it("supports monthly schedules without optional inputs", () => {
    const result = computeLeaseRentSchedule({
      startDate: "2025-01-15",
      endDate: "2025-04-14",
      paymentFrequency: "monthly",
      baseIndexValue: 125,
      officeRentHT: 1500,
      horizonYears: 1,
    })

    expect(result.schedule).toHaveLength(4)
    expect(result.schedule[0].periodStart).toBe("2025-01-15")
    expect(result.schedule[0].periodType).toBe("month")
    expect(result.schedule[0].officeRentHT).toBeCloseTo(822.58, 2)
    expect(result.schedule[0].netRentHT).toBeCloseTo(
      result.schedule[0].officeRentHT,
      5
    )
  })
})
