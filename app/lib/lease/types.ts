export type PaymentFrequency = "monthly" | "quarterly"

export interface KnownIndexPointInput {
  effectiveDate: string
  indexValue: number
}

export interface ComputeLeaseRentScheduleInput {
  startDate: string
  endDate: string
  paymentFrequency: PaymentFrequency
  baseIndexValue: number
  knownIndexPoints?: KnownIndexPointInput[]
  chargesGrowthRate?: number
  officeRentHT: number
  parkingRentHT?: number
  chargesHT?: number
  taxesHT?: number
  otherCostsHT?: number
  depositMonths?: number
  franchiseMonths?: number
  incentiveAmount?: number
  horizonYears?: number
}

export interface RentSchedulePeriod {
  periodStart: string
  periodEnd: string
  periodType: "month" | "quarter"
  year: number
  month?: number
  quarter?: number
  indexValue: number
  indexFactor: number
  officeRentHT: number
  parkingRentHT: number
  otherCostsHT: number
  chargesHT: number
  taxesHT: number
  franchiseHT: number
  incentivesHT: number
  netRentHT: number
}

export interface YearlyTotalSummary {
  year: number
  baseRentHT: number
  chargesHT: number
  taxesHT: number
  franchiseHT: number
  incentivesHT: number
  netRentHT: number
}

export interface ComputeLeaseRentScheduleSummary {
  depositHT: number
  tcam?: number
  yearlyTotals: YearlyTotalSummary[]
}

export interface ComputeLeaseRentScheduleResult {
  summary: ComputeLeaseRentScheduleSummary
  schedule: RentSchedulePeriod[]
}
