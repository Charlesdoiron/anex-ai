"use client"

import {
  X,
  Download,
  FileText,
  Calendar,
  TrendingUp,
  Calculator,
  Info,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  ChevronDown,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { exportRentCalculationToExcel } from "@/app/components/extraction/utils/rent-calculation-excel-export"
import RentCalculationCharts from "./rent-calculation-charts"
import type {
  RentCalculationResult,
  RentCalculationExtractedData,
} from "@/app/lib/extraction/rent-calculation-service"
import type {
  YearlyTotalSummary,
  RentSchedulePeriod,
  ComputeLeaseRentScheduleInput,
  ComputeLeaseRentScheduleResult,
} from "@/app/lib/lease/types"

// Data structure as stored in DB (different from RentCalculationResult)
interface RentCalculationStoredData {
  documentId: string
  fileName: string
  extractionDate: string
  pageCount?: number
  toolType?: string
  extractedData: RentCalculationExtractedData
  rentSchedule: ComputeLeaseRentScheduleResult | null
  scheduleInput: ComputeLeaseRentScheduleInput | null
  // extractionMetadata from DB (different from metadata)
  extractionMetadata?: {
    processingTimeMs: number
    retries: number
  }
  // Original metadata if available
  metadata?: RentCalculationResult["metadata"]
}

type RentCalculationData = RentCalculationResult | RentCalculationStoredData

interface RentCalculationDetailModalProps {
  result: RentCalculationData | null
  onClose: () => void
}

export default function RentCalculationDetailModal({
  result,
  onClose,
}: RentCalculationDetailModalProps) {
  const [isVisible, setIsVisible] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (result) {
      document.body.style.overflow = "hidden"
      requestAnimationFrame(() => setIsVisible(true))
    } else {
      setIsVisible(false)
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [result])

  const handleClose = useCallback(() => {
    setIsVisible(false)
    setTimeout(onClose, 200)
  }, [onClose])

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose()
    }
    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [handleClose])

  if (!result) return null

  function handleDownload() {
    if (!result) return
    try {
      // Convert to expected format if needed
      const exportData: RentCalculationResult = {
        documentId: result.documentId,
        fileName: result.fileName,
        extractionDate: result.extractionDate,
        pageCount: result.pageCount ?? 0,
        toolType: "calculation-rent",
        extractedData: result.extractedData,
        rentSchedule: result.rentSchedule,
        scheduleInput: result.scheduleInput,
        metadata: (result as RentCalculationResult).metadata ?? {
          processingTimeMs:
            (result as RentCalculationStoredData).extractionMetadata
              ?.processingTimeMs ?? 0,
          retries:
            (result as RentCalculationStoredData).extractionMetadata?.retries ??
            0,
          extractionSuccess: true,
          scheduleSuccess: !!result.rentSchedule,
        },
      }
      exportRentCalculationToExcel(exportData)
    } catch (error) {
      console.error("Error exporting to Excel:", error)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto">
      <div
        className={`fixed inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity duration-200 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
        onClick={handleClose}
      />

      <div
        className={`relative w-full max-w-4xl mx-4 my-8 transition-all duration-300 ${
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
        }`}
      >
        <div className="bg-white rounded-lg shadow-xl overflow-hidden border border-gray-200">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-teal-50">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-md bg-emerald-600/10 flex items-center justify-center text-emerald-600 flex-shrink-0">
                  <Calculator className="w-4 h-4" strokeWidth={1.5} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-gray-900 truncate">
                    {result.fileName?.replace(/\.pdf$/i, "") || "Document"}
                  </h2>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(result.extractionDate).toLocaleDateString(
                        "fr-FR",
                        {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        }
                      )}
                    </span>
                    <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px] font-medium">
                      Calcul de loyer
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={handleDownload}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors"
                >
                  <Download size={14} />
                  <span className="hidden sm:inline">Excel</span>
                </button>
                <button
                  onClick={handleClose}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div
            ref={scrollRef}
            className="p-5 max-h-[calc(100vh-180px)] overflow-y-auto bg-gray-50/30"
          >
            <RentCalculationContent result={result} />
          </div>
        </div>
      </div>
    </div>
  )
}

function RentCalculationContent({ result }: { result: RentCalculationData }) {
  const [showDetails, setShowDetails] = useState(true)
  const extracted = result.extractedData
  const schedule = result.rentSchedule
  const input = result.scheduleInput

  const hasSchedule =
    schedule && schedule.schedule && schedule.schedule.length > 0

  // Handle both metadata structures (from fresh result vs from DB)
  const errorMessage = (result as RentCalculationResult).metadata?.errorMessage

  // Check for missing critical fields
  const hasEffectiveDate = !!extracted?.calendar?.effectiveDate?.value
  const hasRent = !!(
    extracted?.rent?.annualRentExclTaxExclCharges?.value ||
    extracted?.rent?.quarterlyRentExclTaxExclCharges?.value
  )
  const hasCriticalData = hasEffectiveDate && hasRent
  const extractionFailed = !hasCriticalData

  return (
    <div className="space-y-4">
      {/* Status banner */}
      {hasSchedule ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-md p-3 flex items-start gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-emerald-700">
            <span className="font-medium">Calcul réussi</span>
            <span className="text-emerald-600">
              {" "}
              — {schedule.schedule.length} périodes calculées
            </span>
          </div>
        </div>
      ) : extractionFailed ? (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-red-700">
            <span className="font-medium">Extraction incomplète</span>
            <div className="mt-1 text-red-600">
              Données manquantes : {!hasEffectiveDate && "date d'effet"}
              {!hasEffectiveDate && !hasRent && ", "}
              {!hasRent && "loyer"}
              <br />
              {"L'échéancier n'a pas pu être calculé."}
            </div>
          </div>
        </div>
      ) : errorMessage ? (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 flex items-start gap-2">
          <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-700">
            <span className="font-medium">Échéancier non calculé : </span>
            {errorMessage}
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-md p-3 flex items-start gap-2">
          <Info className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-gray-600">
            Aucun échéancier disponible
          </div>
        </div>
      )}

      {/* Charts - Only when schedule is available */}
      {hasSchedule && input && (
        <RentCalculationCharts
          schedule={schedule}
          baseIndexValue={input.baseIndexValue}
        />
      )}

      {/* Collapsible details section */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-gray-500" />
          <span className="text-xs font-medium text-gray-700">
            Détails de l&apos;extraction et échéancier
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform ${showDetails ? "rotate-180" : ""}`}
        />
      </button>

      {showDetails && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          {/* Extracted data */}
          <SectionCard
            title="Données extraites"
            icon={<FileText className="w-3.5 h-3.5" strokeWidth={1.5} />}
          >
            <div className="grid grid-cols-2 gap-x-6">
              <FieldRow
                label="Date d'effet"
                value={extracted.calendar.effectiveDate?.value}
                type="date"
              />
              <FieldRow
                label="Date de signature"
                value={extracted.calendar.signatureDate?.value}
                type="date"
              />
              <FieldRow
                label="Durée"
                value={
                  extracted.calendar.duration?.value
                    ? `${extracted.calendar.duration.value} ans`
                    : null
                }
              />
              <FieldRow
                label="Fréquence"
                value={formatFrequency(extracted.rent.paymentFrequency?.value)}
              />
              <FieldRow
                label="Loyer annuel bureaux HT"
                value={extracted.rent.annualRentExclTaxExclCharges?.value}
                type="currency"
              />
              <FieldRow
                label="Loyer trimestriel bureaux HT"
                value={extracted.rent.quarterlyRentExclTaxExclCharges?.value}
                type="currency"
              />
              <FieldRow
                label="Loyer annuel parking HT"
                value={extracted.rent.annualParkingRentExclCharges?.value}
                type="currency"
              />
              <FieldRow
                label="Type d'indice"
                value={extracted.indexation?.indexationType?.value}
              />
              <FieldRow
                label="Indice de référence"
                value={extracted.indexation?.referenceQuarter?.value}
              />
            </div>
          </SectionCard>

          {/* Schedule input parameters */}
          {input && (
            <SectionCard
              title="Paramètres de calcul"
              icon={<Calculator className="w-3.5 h-3.5" strokeWidth={1.5} />}
            >
              <div className="grid grid-cols-2 gap-x-6">
                <FieldRow
                  label="Date de début"
                  value={input.startDate}
                  type="date"
                />
                <FieldRow
                  label="Date de fin"
                  value={input.endDate}
                  type="date"
                />
                <FieldRow
                  label="Indice INSEE de base"
                  value={input.baseIndexValue?.toFixed(2)}
                />
                <FieldRow
                  label="Type d'indice"
                  value={input.indexType?.toUpperCase()}
                />
                <FieldRow
                  label="Fréquence"
                  value={formatFrequency(input.paymentFrequency)}
                />
                <FieldRow
                  label="Loyer bureaux / période"
                  value={input.officeRentHT}
                  type="currency"
                />
                <FieldRow
                  label="Loyer parking / période"
                  value={input.parkingRentHT}
                  type="currency"
                />
              </div>
            </SectionCard>
          )}

          {/* Yearly totals */}
          {hasSchedule && schedule.summary.yearlyTotals.length > 0 && (
            <SectionCard
              title="Totaux annuels"
              icon={<TrendingUp className="w-3.5 h-3.5" strokeWidth={1.5} />}
            >
              <div className="overflow-x-auto -mx-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-100">
                      <th className="text-left font-medium py-2 px-4">Année</th>
                      <th className="text-right font-medium py-2 px-4">
                        Loyer base HT
                      </th>
                      <th className="text-right font-medium py-2 px-4">
                        Charges HT
                      </th>
                      <th className="text-right font-medium py-2 px-4">
                        Loyer net HT
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.summary.yearlyTotals.map(
                      (year: YearlyTotalSummary) => (
                        <tr key={year.year} className="border-b border-gray-50">
                          <td className="py-2 px-4 font-medium text-gray-900">
                            {year.year}
                          </td>
                          <td className="py-2 px-4 text-right text-gray-700">
                            {formatCurrency(year.baseRentHT)}
                          </td>
                          <td className="py-2 px-4 text-right text-gray-700">
                            {formatCurrency(year.chargesHT)}
                          </td>
                          <td className="py-2 px-4 text-right font-medium text-emerald-600">
                            {formatCurrency(year.netRentHT)}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>

              {schedule.summary.depositHT > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <FieldRow
                    label="Dépôt de garantie HT"
                    value={schedule.summary.depositHT}
                    type="currency"
                  />
                </div>
              )}
            </SectionCard>
          )}

          {/* Detailed schedule preview */}
          {hasSchedule && (
            <SectionCard
              title={`Échéancier détaillé (${schedule.schedule.length} périodes)`}
              icon={<Calendar className="w-3.5 h-3.5" strokeWidth={1.5} />}
            >
              <div className="overflow-x-auto -mx-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-100">
                      <th className="text-left font-medium py-2 px-4">
                        Période
                      </th>
                      <th className="text-right font-medium py-2 px-4">
                        Indice
                      </th>
                      <th className="text-right font-medium py-2 px-4">
                        Bureaux HT
                      </th>
                      <th className="text-right font-medium py-2 px-4">
                        Parking HT
                      </th>
                      <th className="text-right font-medium py-2 px-4">
                        Net HT
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.schedule
                      .slice(0, 12)
                      .map((period: RentSchedulePeriod, idx: number) => {
                        const periodLabel =
                          period.periodType === "month"
                            ? `${period.year}-${String(period.month).padStart(2, "0")}`
                            : `${period.year} T${period.quarter}`

                        return (
                          <tr key={idx} className="border-b border-gray-50">
                            <td className="py-2 px-4 font-medium text-gray-900">
                              {periodLabel}
                            </td>
                            <td className="py-2 px-4 text-right text-gray-500">
                              {period.indexValue.toFixed(2)}
                            </td>
                            <td className="py-2 px-4 text-right text-gray-700">
                              {formatCurrency(period.officeRentHT)}
                            </td>
                            <td className="py-2 px-4 text-right text-gray-700">
                              {formatCurrency(period.parkingRentHT)}
                            </td>
                            <td className="py-2 px-4 text-right font-medium text-emerald-600">
                              {formatCurrency(period.netRentHT)}
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
              {schedule.schedule.length > 12 && (
                <p className="text-xs text-gray-400 mt-2 px-4">
                  ... et {schedule.schedule.length - 12} autres périodes (voir
                  Excel pour le détail complet)
                </p>
              )}
            </SectionCard>
          )}
        </div>
      )}
    </div>
  )
}

interface SectionCardProps {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}

function SectionCard({ title, icon, children }: SectionCardProps) {
  return (
    <div className="bg-white rounded-md border border-gray-200 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
        <span className="text-emerald-600">{icon}</span>
        <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
          {title}
        </h3>
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  )
}

interface FieldRowProps {
  label: string
  value: string | number | boolean | null | undefined
  type?: "text" | "date" | "boolean" | "currency"
}

function FieldRow({ label, value, type = "text" }: FieldRowProps) {
  let displayValue: string

  if (value === null || value === undefined || value === "") {
    displayValue = "—"
  } else if (type === "boolean") {
    displayValue = value ? "Oui" : "Non"
  } else if (type === "date" && value) {
    try {
      displayValue = new Date(String(value)).toLocaleDateString("fr-FR")
    } catch {
      displayValue = String(value)
    }
  } else if (type === "currency" && typeof value === "number") {
    displayValue = formatCurrency(value) || "—"
  } else {
    displayValue = String(value)
  }

  const isEmpty = displayValue === "—"

  return (
    <div className="flex items-start justify-between py-1.5 gap-4">
      <span className="text-xs text-gray-500 flex-shrink-0">{label}</span>
      <span
        className={`text-xs text-right ${isEmpty ? "text-gray-300" : "text-gray-800"}`}
      >
        {displayValue}
      </span>
    </div>
  )
}

function formatCurrency(value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null
  return `${value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
}

function formatFrequency(freq: string | null | undefined): string {
  if (freq === "monthly") return "Mensuel"
  if (freq === "quarterly") return "Trimestriel"
  return freq || "—"
}
