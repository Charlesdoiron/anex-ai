/**
 * Extraction Schema for French Commercial Lease Documents (Bail Commercial)
 * Based on client requirements for structured data extraction
 */

export type ExtractionStatus =
  | "pending"
  | "uploading"
  | "parsing_pdf"
  | "extracting_regime"
  | "extracting_parties"
  | "extracting_premises"
  | "extracting_calendar"
  | "extracting_support_measures"
  | "extracting_rent"
  | "extracting_indexation"
  | "extracting_taxes"
  | "extracting_charges"
  | "extracting_insurance"
  | "extracting_securities"
  | "extracting_inventory"
  | "extracting_maintenance"
  | "extracting_restitution"
  | "extracting_transfer"
  | "extracting_environmental"
  | "extracting_other_annexes"
  | "extracting_other"
  | "validating"
  | "completed"
  | "failed"

export interface ExtractionProgress {
  status: ExtractionStatus
  message: string
  progress: number // 0-100
  currentField?: string
  error?: string
}

export interface ExtractionStageDurations {
  pdfProcessingMs: number
  extractionMs: number
  ingestionMs: number
}

export type ConfidenceLevel = "high" | "medium" | "low" | "missing"

export interface ExtractedValue<T> {
  value: T
  confidence: ConfidenceLevel
  source?: string // Page reference or section
  rawText?: string // Original text from document
}

// 1. Régime du bail
export type LeaseRegime =
  | "commercial"
  | "civil"
  | "précaire"
  | "dérogatoire"
  | "à construire"
  | "à construction"
  | "BEFA"
  | "unknown"

export interface LeaseRegimeData {
  regime: ExtractedValue<LeaseRegime>
}

// 2. Parties
export interface ContactInfo {
  name: ExtractedValue<string>
  email: ExtractedValue<string | null>
  phone: ExtractedValue<string | null>
  address: ExtractedValue<string | null>
}

export interface PartiesData {
  landlord: ContactInfo
  landlordRepresentative: ContactInfo | null
  tenant: ContactInfo
}

// 3. Description des locaux loués
export interface PremisesData {
  purpose: ExtractedValue<string> // destination
  designation: ExtractedValue<string>
  address: ExtractedValue<string>
  buildingYear: ExtractedValue<number | null>
  floors: ExtractedValue<string[]>
  lotNumbers: ExtractedValue<string[]>
  surfaceArea: ExtractedValue<number | null> // m²
  isPartitioned: ExtractedValue<boolean | null> // cloisonné
  hasFurniture: ExtractedValue<boolean | null>
  furnishingConditions: ExtractedValue<string | null>
  signageConditions: ExtractedValue<string | null>
  hasOutdoorSpace: ExtractedValue<boolean | null>
  hasArchiveSpace: ExtractedValue<boolean | null>
  parkingSpaces: ExtractedValue<number>
  twoWheelerSpaces: ExtractedValue<number>
  bikeSpaces: ExtractedValue<number>
  shareWithCommonAreas: ExtractedValue<number | null> // quote-part
  shareWithoutCommonAreas: ExtractedValue<number | null>
  totalBuildingShare: ExtractedValue<number | null>
}

// 4. Calendrier
export interface CalendarData {
  signatureDate: ExtractedValue<string | null> // ISO date
  duration: ExtractedValue<number | null> // years
  effectiveDate: ExtractedValue<string | null> // ISO date
  earlyAccessDate: ExtractedValue<string | null> // ISO date
  endDate: ExtractedValue<string | null> // ISO date
  nextTriennialDate: ExtractedValue<string | null> // ISO date
  noticePeriod: ExtractedValue<string | null> // duration description
  terminationConditions: ExtractedValue<string | null>
  renewalConditions: ExtractedValue<string | null>
}

// 5. Mesures d'accompagnement
export interface SupportMeasuresData {
  hasRentFreeperiod: ExtractedValue<boolean>
  rentFreePeriodMonths: ExtractedValue<number | null>
  rentFreePeriodAmount: ExtractedValue<number | null> // HT
  hasOtherMeasures: ExtractedValue<boolean>
  otherMeasuresDescription: ExtractedValue<string | null>
}

// 6. Loyer
export interface RentData {
  annualRentExclTaxExclCharges: ExtractedValue<number | null> // HTHC
  quarterlyRentExclTaxExclCharges: ExtractedValue<number | null> // HTHC
  annualRentPerSqmExclTaxExclCharges: ExtractedValue<number | null> // HTHC
  annualParkingRentExclCharges: ExtractedValue<number | null> // HTHC
  quarterlyParkingRentExclCharges: ExtractedValue<number | null> // HTHC
  annualParkingRentPerUnitExclCharges: ExtractedValue<number | null> // HTHC
  isSubjectToVAT: ExtractedValue<boolean | null>
  paymentFrequency: ExtractedValue<"monthly" | "quarterly" | "annual" | null>
  latePaymentPenaltyConditions: ExtractedValue<string | null>
  latePaymentPenaltyAmount: ExtractedValue<number | null>
}

// 7. Indexation
export interface IndexationData {
  indexationClause: ExtractedValue<string | null>
  indexationType: ExtractedValue<string | null> // ILC, ILAT, ICC, etc.
  referenceQuarter: ExtractedValue<string | null>
  firstIndexationDate: ExtractedValue<string | null> // ISO date
  indexationFrequency: ExtractedValue<"annual" | "quarterly" | "other" | null>
}

// 8. Impôts et taxes
export interface TaxesData {
  propertyTaxRebilled: ExtractedValue<boolean | null>
  propertyTaxAmount: ExtractedValue<number | null>
  officeTaxAmount: ExtractedValue<number | null>
}

// 9. Charges et honoraires
export interface ChargesData {
  annualChargesProvisionExclTax: ExtractedValue<number | null>
  quarterlyChargesProvisionExclTax: ExtractedValue<number | null>
  annualChargesProvisionPerSqmExclTax: ExtractedValue<number | null>
  annualRIEFeeExclTax: ExtractedValue<number | null> // Redevance RIE
  quarterlyRIEFeeExclTax: ExtractedValue<number | null>
  annualRIEFeePerSqmExclTax: ExtractedValue<number | null>
  managementFeesOnTenant: ExtractedValue<boolean | null>
  rentManagementFeesOnTenant: ExtractedValue<boolean | null>
}

// 10. Assurances et recours
export interface InsuranceData {
  annualInsuranceAmountExclTax: ExtractedValue<number | null>
  insurancePremiumRebilled: ExtractedValue<boolean | null>
  hasWaiverOfRecourse: ExtractedValue<boolean | null>
  insuranceCertificateAnnexed: ExtractedValue<boolean | null>
}

// 11. Sûretés
export interface SecuritiesData {
  securityDepositAmount: ExtractedValue<number | null>
  otherSecurities: ExtractedValue<string[]>
}

// 12. États des lieux
export interface InventoryData {
  entryInventoryConditions: ExtractedValue<string | null>
  hasPreExitInventory: ExtractedValue<boolean | null>
  preExitInventoryConditions: ExtractedValue<string | null>
  exitInventoryConditions: ExtractedValue<string | null>
}

// 13. Entretien et travaux
export interface MaintenanceData {
  tenantMaintenanceConditions: ExtractedValue<string | null>
  landlordWorksList: ExtractedValue<string[]>
  tenantWorksList: ExtractedValue<string[]>
  workConditionsImposedOnTenant: ExtractedValue<string | null>
  hasAccessionClause: ExtractedValue<boolean | null> // sort des travaux
}

// 14. Restitution
export interface RestitutionData {
  restitutionConditions: ExtractedValue<string | null>
  restorationConditions: ExtractedValue<string | null>
}

// 15. Cession - Sous-location
export interface TransferData {
  sublettingConditions: ExtractedValue<string | null>
  currentSubleaseInfo: ExtractedValue<{
    subtenantName: string | null
    effectiveDate: string | null
    nextTerminationDate: string | null
    endDate: string | null
  } | null>
  assignmentConditions: ExtractedValue<string | null>
  divisionPossible: ExtractedValue<boolean | null>
}

// 16.1. Annexes environnementales
export interface EnvironmentalAnnexesData {
  hasDPE: ExtractedValue<boolean | null>
  dpeNote: ExtractedValue<string | null>
  hasAsbestosDiagnostic: ExtractedValue<boolean | null>
  hasEnvironmentalAnnex: ExtractedValue<boolean | null> // > 2000m²
  hasRiskAndPollutionStatement: ExtractedValue<boolean | null>
}

// 16.2. Autres annexes
export interface OtherAnnexesData {
  hasInternalRegulations: ExtractedValue<boolean | null>
  hasPremisesPlan: ExtractedValue<boolean | null>
  hasChargesInventory: ExtractedValue<boolean | null>
  hasAnnualChargesSummary: ExtractedValue<boolean | null>
  hasThreeYearWorksBudget: ExtractedValue<boolean | null>
  hasPastWorksSummary: ExtractedValue<boolean | null>
}

// 17. Autres
export interface OtherData {
  isSignedAndInitialed: ExtractedValue<boolean | null>
  civilCodeDerogations: ExtractedValue<string[]>
  commercialCodeDerogations: ExtractedValue<string[]>
}

// Complete extraction result
import type { ComputeLeaseRentScheduleResult } from "@/app/lib/lease/types"

export interface LeaseExtractionResult {
  documentId: string
  fileName: string
  extractionDate: string // ISO date
  rawText: string
  pageCount: number
  usedOcrEngine?: "tesseract" | "vision" | null

  regime: LeaseRegimeData
  parties: PartiesData
  premises: PremisesData
  calendar: CalendarData
  supportMeasures: SupportMeasuresData
  rent: RentData
  indexation: IndexationData
  taxes: TaxesData
  charges: ChargesData
  insurance: InsuranceData
  securities: SecuritiesData
  inventory: InventoryData
  maintenance: MaintenanceData
  restitution: RestitutionData
  transfer: TransferData
  environmentalAnnexes: EnvironmentalAnnexesData
  otherAnnexes: OtherAnnexesData
  other: OtherData

  // Computed rent schedule (using INSEE index + extracted fields)
  rentSchedule?: ComputeLeaseRentScheduleResult

  // Future: computed scores will go here
  scores?: {
    [key: string]: number | string
  }

  // Metadata
  extractionMetadata: {
    totalFields: number
    extractedFields: number
    missingFields: number
    lowConfidenceFields: number
    averageConfidence: number
    processingTimeMs: number
    retries: number
    stageDurations: ExtractionStageDurations
  }
}
