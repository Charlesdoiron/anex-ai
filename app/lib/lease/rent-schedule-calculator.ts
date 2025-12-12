import {
  ComputeLeaseRentScheduleInput,
  ComputeLeaseRentScheduleResult,
  ComputeLeaseRentScheduleSummary,
  KnownIndexPointInput,
  PaymentFrequency,
  RentSchedulePeriod,
  YearlyTotalSummary,
} from "./types"

const MS_PER_DAY = 86_400_000
const DAYS_IN_YEAR = 365

interface ParsedIndexPoint {
  date: Date
  indexValue: number
}

interface TimelinePeriod {
  anchorStart: Date
  anchorEnd: Date
  billableStart: Date
  billableEnd: Date
  totalDays: number
  billableDays: number
  monthsEquivalent: number
}

export function computeLeaseRentSchedule(
  input: ComputeLeaseRentScheduleInput
): ComputeLeaseRentScheduleResult {
  const startDate = parseISODate(input.startDate, "start_date")
  const endDate = parseISODate(input.endDate, "end_date")

  if (endDate < startDate) {
    throw new Error("end_date must be on or after start_date.")
  }

  if (input.baseIndexValue <= 0) {
    throw new Error("base_index_value must be greater than zero.")
  }

  if (!["monthly", "quarterly"].includes(input.paymentFrequency)) {
    throw new Error(
      "payment_frequency must be either 'monthly' or 'quarterly'."
    )
  }

  const paymentFrequency = input.paymentFrequency
  const monthsPerPeriod = paymentFrequency === "monthly" ? 1 : 3
  const horizonYears = input.horizonYears ?? 3

  if (horizonYears <= 0) {
    throw new Error("horizon_years must be greater than zero.")
  }

  const officeRentHT = input.officeRentHT
  const parkingRentHT = input.parkingRentHT ?? 0
  const chargesHT = input.chargesHT ?? 0
  const taxesHT = input.taxesHT ?? 0
  const otherCostsHT = input.otherCostsHT ?? 0
  const depositMonths = Math.max(0, input.depositMonths ?? 0)
  const franchiseMonths = Math.max(0, input.franchiseMonths ?? 0)
  const incentiveAmount = Math.max(0, input.incentiveAmount ?? 0)
  const chargesGrowthRate = input.chargesGrowthRate ?? 0

  const horizonCapDate = minDate(endDate, addYears(startDate, horizonYears))
  const timeline = buildTimeline(startDate, horizonCapDate, paymentFrequency)

  if (!timeline.length) {
    throw new Error("No billable periods found within the provided horizon.")
  }

  const parsedPoints = parseKnownIndexPoints(
    input.knownIndexPoints ?? [],
    startDate
  )
  const tcam = computeTcam(
    input.baseIndexValue,
    startDate,
    parsedPoints.length ? parsedPoints : undefined
  )
  const indexResolver = buildIndexResolver(
    input.baseIndexValue,
    startDate,
    parsedPoints,
    tcam
  )

  let franchiseMonthsRemaining = franchiseMonths
  let incentiveBalance = incentiveAmount
  const schedule: RentSchedulePeriod[] = []
  const yearlyTotals = new Map<number, YearlyTotalSummary>()
  const periodType: RentSchedulePeriod["periodType"] =
    paymentFrequency === "monthly" ? "month" : "quarter"

  // Calculate the first anniversary date (1 year after start)
  const firstAnniversaryDate = addYears(startDate, 1)

  for (const period of timeline) {
    const isFullPeriod = period.billableDays === period.totalDays

    const daysPerYear = DAYS_IN_YEAR
    const periodsPerYear = paymentFrequency === "monthly" ? 12 : 4
    const averageDaysPerPeriod = daysPerYear / periodsPerYear

    const proration = isFullPeriod
      ? 1
      : period.billableDays / averageDaysPerPeriod

    // Check if we're still in the first year (before first anniversary)
    const isFirstYear = period.billableEnd < firstAnniversaryDate

    // Find the anniversary that falls within or has already passed for this period
    // An anniversary affects a period if it falls within [periodStart, periodEnd]
    const anniversaryInPeriod = parsedPoints.find(
      (p) => p.date >= period.billableStart && p.date <= period.billableEnd
    )

    // Find the last anniversary that has passed before this period started
    const lastPassedAnniversary = parsedPoints
      .filter((p) => p.date < period.billableStart)
      .sort((a, b) => b.date.getTime() - a.date.getTime())[0]

    let officeRent = 0
    let parkingRent = 0
    let otherCosts = 0
    let indexValue = 0
    let indexFactor = 0

    if (isFirstYear) {
      // First year: no indexation, use base rent
      indexValue = input.baseIndexValue
      indexFactor = 1

      officeRent = proration > 0 ? roundCurrency(officeRentHT * proration) : 0
      parkingRent = proration > 0 ? roundCurrency(parkingRentHT * proration) : 0
      otherCosts = proration > 0 ? roundCurrency(otherCostsHT * proration) : 0
    } else if (anniversaryInPeriod) {
      // Anniversary falls within this period - split calculation
      // Use billableDays as denominator to ensure prorations sum to 1.0
      const totalBillableDays = period.billableDays

      const daysBeforeAnniversary = differenceInDaysInclusive(
        period.billableStart,
        addDays(anniversaryInPeriod.date, -1)
      )
      // Use the previous index (or base) for days before anniversary
      const indexBeforeAnniversary = lastPassedAnniversary
        ? lastPassedAnniversary.indexValue
        : input.baseIndexValue
      const factorBeforeAnniversary =
        indexBeforeAnniversary / input.baseIndexValue
      // Proration within this period based on actual days
      const prorationBeforeWithinPeriod =
        daysBeforeAnniversary / totalBillableDays

      const daysFromAnniversary = differenceInDaysInclusive(
        anniversaryInPeriod.date,
        period.billableEnd
      )
      const indexFromAnniversary = anniversaryInPeriod.indexValue
      const factorFromAnniversary = indexFromAnniversary / input.baseIndexValue
      const prorationAfterWithinPeriod = daysFromAnniversary / totalBillableDays

      // Apply overall proration for partial periods (e.g., first/last month)
      // proration = billableDays / averageDaysPerPeriod (already calculated above)
      const overallProration = proration

      // Calculate rent for both index periods, then apply overall proration
      officeRent = roundCurrency(
        officeRentHT *
          overallProration *
          (prorationBeforeWithinPeriod * factorBeforeAnniversary +
            prorationAfterWithinPeriod * factorFromAnniversary)
      )
      parkingRent = roundCurrency(
        parkingRentHT *
          overallProration *
          (prorationBeforeWithinPeriod * factorBeforeAnniversary +
            prorationAfterWithinPeriod * factorFromAnniversary)
      )
      otherCosts = roundCurrency(
        otherCostsHT *
          overallProration *
          (prorationBeforeWithinPeriod * factorBeforeAnniversary +
            prorationAfterWithinPeriod * factorFromAnniversary)
      )

      // Display the new index value for this period
      indexValue = indexFromAnniversary
      indexFactor = factorFromAnniversary
    } else if (lastPassedAnniversary) {
      // We're past an anniversary, use the last passed anniversary's index
      indexValue = lastPassedAnniversary.indexValue
      indexFactor = indexValue / input.baseIndexValue

      officeRent =
        proration > 0
          ? roundCurrency(officeRentHT * proration * indexFactor)
          : 0
      parkingRent =
        proration > 0
          ? roundCurrency(parkingRentHT * proration * indexFactor)
          : 0
      otherCosts =
        proration > 0
          ? roundCurrency(otherCostsHT * proration * indexFactor)
          : 0
    } else {
      // Fallback: use base index (shouldn't happen in normal flow)
      indexValue = input.baseIndexValue
      indexFactor = 1

      officeRent = proration > 0 ? roundCurrency(officeRentHT * proration) : 0
      parkingRent = proration > 0 ? roundCurrency(parkingRentHT * proration) : 0
      otherCosts = proration > 0 ? roundCurrency(otherCostsHT * proration) : 0
    }

    const yearIndex = fullYearsSince(startDate, period.billableStart)
    const chargesBaseForYear =
      chargesHT * Math.pow(1 + chargesGrowthRate, yearIndex)
    const taxesBaseForYear =
      taxesHT * Math.pow(1 + chargesGrowthRate, yearIndex)
    const chargesAmount =
      proration > 0 ? roundCurrency(chargesBaseForYear * proration) : 0
    const taxesAmount =
      proration > 0 ? roundCurrency(taxesBaseForYear * proration) : 0

    // Franchise calculation: waive rent for specified number of months
    // Uses base monthly rent (not prorated) to avoid rounding issues
    let franchiseHT = 0
    if (franchiseMonthsRemaining > 0 && period.monthsEquivalent > 0) {
      const monthsApplied = Math.min(
        franchiseMonthsRemaining,
        period.monthsEquivalent
      )
      franchiseMonthsRemaining -= monthsApplied

      // Use base monthly rent for consistent franchise calculation
      const baseMonthlyRent = (officeRentHT + parkingRentHT) / monthsPerPeriod
      const franchiseValue = baseMonthlyRent * monthsApplied
      franchiseHT = franchiseValue > 0 ? -roundCurrency(franchiseValue) : 0
    }

    let incentivesHT = 0
    if (incentiveBalance > 0) {
      incentivesHT = -roundCurrency(incentiveBalance)
      incentiveBalance = 0
    }

    const netRentHT = roundCurrency(
      officeRent +
        parkingRent +
        otherCosts +
        chargesAmount +
        taxesAmount +
        franchiseHT +
        incentivesHT
    )

    const scheduleItem: RentSchedulePeriod = {
      periodStart: formatISODate(period.billableStart),
      periodEnd: formatISODate(period.billableEnd),
      periodType,
      year: period.billableStart.getUTCFullYear(),
      month:
        periodType === "month"
          ? period.billableStart.getUTCMonth() + 1
          : undefined,
      quarter:
        periodType === "quarter" ? getQuarter(period.billableStart) : undefined,
      indexValue: roundDecimal(indexValue, 4),
      indexFactor: roundDecimal(indexFactor, 6),
      officeRentHT: officeRent,
      parkingRentHT: parkingRent,
      otherCostsHT: otherCosts,
      chargesHT: chargesAmount,
      taxesHT: taxesAmount,
      franchiseHT,
      incentivesHT,
      netRentHT,
    }

    schedule.push(scheduleItem)
    accumulateYearlyTotals(yearlyTotals, scheduleItem)
  }

  // Deposit is based on base rent only (office + parking), not charges/taxes
  const monthlyBaseRent = (officeRentHT + parkingRentHT) / monthsPerPeriod
  const summary: ComputeLeaseRentScheduleSummary = {
    depositHT: roundCurrency(depositMonths * monthlyBaseRent),
    tcam: typeof tcam === "number" ? roundDecimal(tcam, 6) : undefined,
    yearlyTotals: Array.from(yearlyTotals.values())
      .sort((a, b) => a.year - b.year)
      .map((total) => ({
        year: total.year,
        baseRentHT: roundCurrency(total.baseRentHT),
        chargesHT: roundCurrency(total.chargesHT),
        taxesHT: roundCurrency(total.taxesHT),
        franchiseHT: roundCurrency(total.franchiseHT),
        incentivesHT: roundCurrency(total.incentivesHT),
        netRentHT: roundCurrency(total.netRentHT),
      })),
  }

  return {
    summary,
    schedule,
  }
}

function parseKnownIndexPoints(
  points: KnownIndexPointInput[],
  startDate: Date
): ParsedIndexPoint[] {
  return points
    .map((point) => ({
      date: parseISODate(
        point.effectiveDate,
        "known_index_points.effective_date"
      ),
      indexValue: point.indexValue,
    }))
    .filter(
      (point) =>
        !Number.isNaN(point.indexValue) &&
        point.indexValue > 0 &&
        point.date >= startDate
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime())
}

function computeTcam(
  baseIndex: number,
  baseDate: Date,
  points?: ParsedIndexPoint[]
): number | undefined {
  if (!points?.length || baseIndex <= 0) {
    return undefined
  }

  const furthestPoint = points[points.length - 1]
  const years = yearsBetween(baseDate, furthestPoint.date)
  if (years <= 0) {
    return undefined
  }

  return Math.pow(furthestPoint.indexValue / baseIndex, 1 / years) - 1
}

function buildIndexResolver(
  baseIndexValue: number,
  baseDate: Date,
  points: ParsedIndexPoint[],
  tcam?: number
) {
  return (date: Date) => {
    let latest: ParsedIndexPoint = {
      date: baseDate,
      indexValue: baseIndexValue,
    }

    for (const point of points) {
      if (point.date <= date && point.date >= latest.date) {
        latest = point
      }
    }

    // For dates beyond known points, extrapolate using TCAM from last known point
    if (points.length > 0) {
      const lastKnown = points[points.length - 1]
      if (date > lastKnown.date) {
        // Extrapolate from the last known point using TCAM
        return extrapolateIndex(
          lastKnown.indexValue,
          lastKnown.date,
          date,
          tcam
        )
      }
    } else if (!points.length) {
      // Extrapolate from base when no known points are available
      return extrapolateIndex(baseIndexValue, baseDate, date, tcam)
    }

    return latest.indexValue
  }
}

function extrapolateIndex(
  anchorValue: number,
  anchorDate: Date,
  targetDate: Date,
  tcam?: number
) {
  if (!tcam) {
    return anchorValue
  }
  const years = yearsBetween(anchorDate, targetDate)
  if (years <= 0) {
    return anchorValue
  }
  return anchorValue * Math.pow(1 + tcam, years)
}

function buildTimeline(
  startDate: Date,
  horizonEnd: Date,
  paymentFrequency: PaymentFrequency
): TimelinePeriod[] {
  const periods: TimelinePeriod[] = []
  const monthsPerPeriod = paymentFrequency === "monthly" ? 1 : 3
  let anchorStart = alignToPeriodStart(startDate, paymentFrequency)

  while (anchorStart <= horizonEnd) {
    const anchorEnd = minDate(
      endOfPeriod(anchorStart, paymentFrequency),
      horizonEnd
    )
    const totalDays = differenceInDaysInclusive(anchorStart, anchorEnd)
    const billableStart = maxDate(anchorStart, startDate)
    const billableEnd = anchorEnd

    if (billableStart > billableEnd) {
      break
    }

    const billableDays = differenceInDaysInclusive(billableStart, billableEnd)
    const monthsEquivalent = monthsPerPeriod * (billableDays / totalDays)

    periods.push({
      anchorStart,
      anchorEnd,
      billableStart,
      billableEnd,
      totalDays,
      billableDays,
      monthsEquivalent,
    })

    if (anchorEnd >= horizonEnd) {
      break
    }
    anchorStart = addMonths(anchorStart, monthsPerPeriod)
  }

  return periods
}

function alignToPeriodStart(
  date: Date,
  paymentFrequency: PaymentFrequency
): Date {
  if (paymentFrequency === "monthly") {
    return startOfMonth(date)
  }
  return startOfQuarter(date)
}

function endOfPeriod(date: Date, paymentFrequency: PaymentFrequency): Date {
  if (paymentFrequency === "monthly") {
    return endOfMonth(date)
  }
  return endOfQuarter(date)
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function endOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
}

function startOfQuarter(date: Date): Date {
  const month = date.getUTCMonth()
  const quarterStartMonth = Math.floor(month / 3) * 3
  return new Date(Date.UTC(date.getUTCFullYear(), quarterStartMonth, 1))
}

function endOfQuarter(date: Date): Date {
  const month = date.getUTCMonth()
  const quarterStartMonth = Math.floor(month / 3) * 3
  return new Date(Date.UTC(date.getUTCFullYear(), quarterStartMonth + 3, 0))
}

function addMonths(date: Date, months: number): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1)
  )
}

function addYears(date: Date, years: number): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear() + years,
      date.getUTCMonth(),
      date.getUTCDate()
    )
  )
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

function minDate(...dates: Date[]): Date {
  return new Date(Math.min(...dates.map((d) => d.getTime())))
}

function maxDate(...dates: Date[]): Date {
  return new Date(Math.max(...dates.map((d) => d.getTime())))
}

function differenceInDaysInclusive(start: Date, end: Date): number {
  const startUTC = Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate()
  )
  const endUTC = Date.UTC(
    end.getUTCFullYear(),
    end.getUTCMonth(),
    end.getUTCDate()
  )
  return Math.round((endUTC - startUTC) / MS_PER_DAY) + 1
}

function yearsBetween(start: Date, end: Date): number {
  const days = differenceInDaysInclusive(start, end) - 1
  return days / DAYS_IN_YEAR
}

function fullYearsSince(start: Date, target: Date): number {
  let years = target.getUTCFullYear() - start.getUTCFullYear()
  const anniversary = new Date(
    Date.UTC(
      start.getUTCFullYear() + years,
      start.getUTCMonth(),
      start.getUTCDate()
    )
  )
  if (target < anniversary) {
    years -= 1
  }
  return Math.max(0, years)
}

function getQuarter(date: Date): number {
  return Math.floor(date.getUTCMonth() / 3) + 1
}

function formatISODate(date: Date): string {
  return date.toISOString().split("T")[0]!
}

function parseISODate(value: string, field: string): Date {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${field} must be a valid ISO date.`)
  }
  return new Date(
    Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate())
  )
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function roundDecimal(value: number, precision: number): number {
  const factor = Math.pow(10, precision)
  return Math.round((value + Number.EPSILON) * factor) / factor
}

function accumulateYearlyTotals(
  accumulator: Map<number, YearlyTotalSummary>,
  period: RentSchedulePeriod
) {
  const entry = accumulator.get(period.year) ?? {
    year: period.year,
    baseRentHT: 0,
    chargesHT: 0,
    taxesHT: 0,
    franchiseHT: 0,
    incentivesHT: 0,
    netRentHT: 0,
  }

  entry.baseRentHT +=
    period.officeRentHT + period.parkingRentHT + period.otherCostsHT
  entry.chargesHT += period.chargesHT
  entry.taxesHT += period.taxesHT
  entry.franchiseHT += period.franchiseHT
  entry.incentivesHT += period.incentivesHT
  entry.netRentHT += period.netRentHT

  accumulator.set(period.year, entry)
}
