"use client"

import {
  X,
  Download,
  FileText,
  Building2,
  Coins,
  TrendingUp,
  Calendar,
  Shield,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Clean LaTeX notation from text (e.g., $2^{\circ}$ -> 2°)
 */
function cleanLatex(text: string): string {
  return (
    text
      // Convert $N^{\circ}$ or $N^\circ$ to N°
      .replace(/\$(\d+)\^\\?\{?\\circ\\?\}?\$/g, "$1°")
      // Convert standalone \circ to °
      .replace(/\\circ/g, "°")
      // Convert $...$ wrapped content (remove the $ markers)
      .replace(/\$([^$]+)\$/g, "$1")
      // Clean up remaining LaTeX artifacts
      .replace(/\^\{([^}]+)\}/g, "$1")
      .replace(/\^(\d+)/g, "$1")
      .replace(/\\_/g, "_")
      .replace(/\\\s/g, " ")
  )
}
import { exportRentCalculationToExcel } from "@/app/components/extraction/utils/rent-calculation-excel-export"
import { exportRentCalculationToPDF } from "@/app/components/extraction/utils/pdf-export"
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
  extractionMetadata?: {
    processingTimeMs: number
    retries: number
  }
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

  async function handleDownloadExcel() {
    if (!result) return
    try {
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
      await exportRentCalculationToExcel(exportData)
    } catch (error) {
      console.error("Error exporting to Excel:", error)
    }
  }

  function handleDownloadPDF() {
    if (!result) return
    try {
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
      exportRentCalculationToPDF(exportData)
    } catch (error) {
      console.error("Error exporting to PDF:", error)
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
        className={`relative w-full max-w-5xl mx-4 my-8 transition-all duration-300 ${
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
        }`}
      >
        <div className="bg-white rounded-lg shadow-xl overflow-hidden border border-gray-200">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-teal-50">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-md bg-emerald-600/10 flex items-center justify-center text-emerald-600 flex-shrink-0">
                  <Coins className="w-4 h-4" strokeWidth={1.5} />
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
                  onClick={handleDownloadPDF}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                  title="Télécharger en PDF"
                >
                  <FileText size={14} />
                  <span className="hidden sm:inline">PDF</span>
                </button>
                <button
                  onClick={handleDownloadExcel}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors"
                  title="Télécharger en Excel"
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
            className="p-6 max-h-[calc(100vh-180px)] overflow-y-auto bg-gray-50/30"
          >
            <RentCalculationContent result={result} />
          </div>
        </div>
      </div>
    </div>
  )
}

function RentCalculationContent({ result }: { result: RentCalculationData }) {
  const extracted = result.extractedData
  const schedule = result.rentSchedule
  const input = result.scheduleInput

  const hasSchedule =
    schedule && schedule.schedule && schedule.schedule.length > 0

  // Calculate today's date for splitting past/future periods
  const today = new Date()
  const todayStr = today.toISOString().split("T")[0]

  // Split schedule into past and future periods
  const pastPeriods = hasSchedule
    ? schedule.schedule.filter((p) => p.periodEnd < todayStr)
    : []
  const futurePeriods = hasSchedule
    ? schedule.schedule.filter((p) => p.periodStart >= todayStr)
    : []

  // Calculate cumulative amounts
  const totalOfficeRentHT = hasSchedule
    ? schedule.schedule.reduce((sum, p) => sum + p.officeRentHT, 0)
    : 0
  const totalParkingRentHT = hasSchedule
    ? schedule.schedule.reduce((sum, p) => sum + p.parkingRentHT, 0)
    : 0

  const paidOfficeRentHT = pastPeriods.reduce(
    (sum, p) => sum + p.officeRentHT,
    0
  )
  const paidParkingRentHT = pastPeriods.reduce(
    (sum, p) => sum + p.parkingRentHT,
    0
  )

  const remainingOfficeRentHT = futurePeriods.reduce(
    (sum, p) => sum + p.officeRentHT,
    0
  )
  const remainingParkingRentHT = futurePeriods.reduce(
    (sum, p) => sum + p.parkingRentHT,
    0
  )

  // Get franchise and measures
  const franchiseMonths =
    extracted.supportMeasures?.rentFreePeriodMonths?.value ?? 0
  const franchiseAmount =
    extracted.supportMeasures?.rentFreePeriodAmount?.value ?? 0
  const measuresDescription =
    extracted.supportMeasures?.otherMeasuresDescription?.value

  return (
    <div className="space-y-4">
      {/* Données bail */}
      <SectionCard
        title="Données bail"
        icon={<Building2 className="w-4 h-4" strokeWidth={1.5} />}
      >
        <div className="space-y-2">
          <DataRow
            label="Nom de l'actif"
            value={result.fileName?.replace(/\.pdf$/i, "") || "—"}
          />
          <DataRow
            label="Adresse du bien"
            value={extracted.premises?.address?.value}
          />
          <DataRow
            label="Date d'effet"
            value={extracted.calendar.effectiveDate?.value}
            type="date"
          />
          <DataRow
            label="Durée du bail"
            value={
              extracted.calendar.duration?.value
                ? `${extracted.calendar.duration.value} années`
                : null
            }
          />
          <DataRow
            label="Surface"
            value={
              extracted.premises?.surfaceArea?.value
                ? `${extracted.premises.surfaceArea.value} m²`
                : null
            }
          />
          <DataRow
            label="# places de parking"
            value={
              extracted.premises?.parkingSpaces?.value
                ? `${extracted.premises.parkingSpaces.value} unités`
                : null
            }
          />
        </div>
      </SectionCard>

      {/* Données financières */}
      <SectionCard
        title="Données financières"
        icon={<Coins className="w-4 h-4" strokeWidth={1.5} />}
        highlight
      >
        <div className="space-y-2">
          <DataRow
            label="Fréquence de paiement"
            value={formatFrequency(extracted.rent.paymentFrequency?.value)}
          />

          <div className="pt-3 pb-1 border-t border-gray-100">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Loyers bureaux
            </div>
          </div>
          <DataRow
            label="Loyer de base annuel HTHC"
            value={extracted.rent.annualRentExclTaxExclCharges?.value}
            type="currency"
          />
          <DataRow
            label="Loyer de base trimestriel HTHC"
            value={extracted.rent.quarterlyRentExclTaxExclCharges?.value}
            type="currency"
          />
          <DataRow
            label="Loyer HTHC / m² / an"
            value={extracted.rent.annualRentPerSqmExclTaxExclCharges?.value}
            type="currency"
          />

          <div className="pt-3 pb-1 border-t border-gray-100">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Loyers parking
            </div>
          </div>
          <DataRow
            label="Loyer de base parking annuel HTHC"
            value={extracted.rent.annualParkingRentExclCharges?.value}
            type="currency"
          />
          <DataRow
            label="Loyer de base parking trimestriel HTHC"
            value={extracted.rent.quarterlyParkingRentExclCharges?.value}
            type="currency"
          />
          <DataRow
            label="Loyer parking HTHC / unité / an"
            value={extracted.rent.annualParkingRentPerUnitExclCharges?.value}
            type="currency"
          />

          <div className="pt-3 pb-1 border-t border-gray-100">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Charges et taxes
            </div>
          </div>
          <DataRow
            label="Provisions pour charges annuelles HT"
            value={extracted.charges?.annualChargesProvisionExclTax?.value}
            type="currency"
          />
          <DataRow
            label="Provisions pour charges trimestrielles HT"
            value={extracted.charges?.quarterlyChargesProvisionExclTax?.value}
            type="currency"
          />
          <DataRow
            label="Provision pour charges HT / m² / an"
            value={
              extracted.charges?.annualChargesProvisionPerSqmExclTax?.value
            }
            type="currency"
          />
          <DataRow
            label="Provisions pour taxes annuelles"
            value={extracted.taxes?.propertyTaxAmount?.value}
            type="currency"
          />
          <DataRow
            label="Provisions pour taxes trimestrielles"
            value={
              extracted.taxes?.propertyTaxAmount?.value
                ? extracted.taxes.propertyTaxAmount.value / 4
                : null
            }
            type="currency"
          />
          <DataRow
            label="Provision pour taxes HT / m² / an"
            value={
              extracted.taxes?.propertyTaxAmount?.value &&
              extracted.premises?.surfaceArea?.value
                ? extracted.taxes.propertyTaxAmount.value /
                  extracted.premises.surfaceArea.value
                : null
            }
            type="currency"
          />

          <div className="pt-3 pb-1 border-t border-gray-100">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Mesures d&apos;accompagnement
            </div>
          </div>
          <DataRow
            label="Franchise accordée"
            value={
              franchiseMonths > 0
                ? `${franchiseMonths} mois${franchiseAmount > 0 ? ` + ${formatCurrency(franchiseAmount)}` : ""}`
                : null
            }
          />
          <DataRow
            label="Autres mesures d'accompagnement"
            value={measuresDescription}
          />

          <div className="pt-3 pb-1 border-t border-gray-100">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Indexation
            </div>
          </div>
          <DataRow
            label="Indice"
            value={
              extracted.indexation?.indexationType?.value
                ? `${extracted.indexation.indexationType.value}${
                    extracted.indexation.referenceQuarter?.value
                      ? ` - ${extracted.indexation.referenceQuarter.value}`
                      : ""
                  }`
                : null
            }
          />
          <DataRow
            label="Périodicité de l'indice"
            value={formatIndexFrequency(null)}
          />
        </div>
      </SectionCard>

      {/* Sûretés */}
      <SectionCard
        title="Sûretés"
        icon={<Shield className="w-4 h-4" strokeWidth={1.5} />}
      >
        <div className="space-y-2">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Dépôt de garantie
          </div>
          <DataRow
            label="Montant du dépôt de garantie"
            value={extracted.securities?.securityDepositAmount?.value}
            type="currency"
          />
        </div>
      </SectionCard>

      {/* Loyers cumulés (only if schedule exists) */}
      {hasSchedule && (
        <SectionCard
          title="Loyers cumulés et prévisionnels"
          icon={<TrendingUp className="w-4 h-4" strokeWidth={1.5} />}
          highlight
        >
          <div className="space-y-2">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Sur la durée totale du bail
            </div>
            <DataRow
              label="Loyers cumulés HTHC sur la durée du bail"
              value={totalOfficeRentHT}
              type="currency"
              highlight
            />
            <DataRow
              label="Loyers parking cumulés HTHC sur la durée du bail"
              value={totalParkingRentHT}
              type="currency"
              highlight
            />

            <div className="pt-3 pb-1 border-t border-gray-100">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Périodes passées
              </div>
            </div>
            <DataRow
              label="Loyers cumulés HTHC payés"
              value={paidOfficeRentHT}
              type="currency"
            />
            <DataRow
              label="Loyers parking cumulés HTHC payés"
              value={paidParkingRentHT}
              type="currency"
            />

            <div className="pt-3 pb-1 border-t border-gray-100">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Périodes futures
              </div>
            </div>
            <DataRow
              label="Loyers prévisionnel HTHC restant dû jusqu'à l'échéance du bail"
              value={remainingOfficeRentHT}
              type="currency"
            />
            <DataRow
              label="Loyers parking prévisionnel HTHC restant dû jusqu'à l'échéance du bail"
              value={remainingParkingRentHT}
              type="currency"
            />
          </div>
        </SectionCard>
      )}

      {/* Échéancier des périodes passées */}
      {pastPeriods.length > 0 && (
        <SectionCard
          title={`Échéancier des périodes passées (${pastPeriods.length} périodes)`}
          icon={<Calendar className="w-4 h-4" strokeWidth={1.5} />}
        >
          <div className="overflow-x-auto -mx-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-100 bg-gray-50">
                  <th className="text-left font-medium py-2.5 px-4">Période</th>
                  <th className="text-right font-medium py-2.5 px-4">
                    Loyers HTHC
                  </th>
                  <th className="text-right font-medium py-2.5 px-4">
                    Loyers parking HTHC
                  </th>
                  <th className="text-right font-medium py-2.5 px-4">
                    Loyer total HTHC
                  </th>
                </tr>
              </thead>
              <tbody>
                {pastPeriods.map((period: RentSchedulePeriod, idx: number) => {
                  const periodLabel =
                    period.periodType === "month"
                      ? `${period.year}-${String(period.month).padStart(2, "0")}`
                      : `${period.quarter}T${period.year}`

                  const totalRent = period.officeRentHT + period.parkingRentHT

                  return (
                    <tr
                      key={idx}
                      className="border-b border-gray-50 hover:bg-gray-50"
                    >
                      <td className="py-2.5 px-4 font-medium text-gray-900">
                        {periodLabel}
                      </td>
                      <td className="py-2.5 px-4 text-right text-gray-700">
                        {formatCurrency(period.officeRentHT)}
                      </td>
                      <td className="py-2.5 px-4 text-right text-gray-700">
                        {formatCurrency(period.parkingRentHT)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-medium text-emerald-600">
                        {formatCurrency(totalRent)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                  <td className="py-2.5 px-4 text-gray-900">Total</td>
                  <td className="py-2.5 px-4 text-right text-gray-900">
                    {formatCurrency(paidOfficeRentHT)}
                  </td>
                  <td className="py-2.5 px-4 text-right text-gray-900">
                    {formatCurrency(paidParkingRentHT)}
                  </td>
                  <td className="py-2.5 px-4 text-right text-emerald-600">
                    {formatCurrency(paidOfficeRentHT + paidParkingRentHT)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </SectionCard>
      )}

      {pastPeriods.length === 0 && hasSchedule && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-700">
          Aucune période passée. Le bail commence dans le futur ou
          aujourd&apos;hui.
        </div>
      )}

      {!hasSchedule && (
        <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-xs text-gray-600">
          Échéancier non disponible
        </div>
      )}
    </div>
  )
}

interface SectionCardProps {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  highlight?: boolean
}

function SectionCard({ title, icon, children, highlight }: SectionCardProps) {
  return (
    <div
      className={`bg-white rounded-md border overflow-hidden ${
        highlight
          ? "border-emerald-500/30 shadow-sm ring-1 ring-emerald-500/10"
          : "border-gray-200"
      }`}
    >
      <div
        className={`px-4 py-2.5 border-b flex items-center gap-2 ${
          highlight
            ? "bg-emerald-50 border-emerald-200"
            : "bg-gray-50/50 border-gray-100"
        }`}
      >
        <span className="text-emerald-600">{icon}</span>
        <h3
          className={`text-xs font-semibold uppercase tracking-wide ${
            highlight ? "text-gray-800" : "text-gray-700"
          }`}
        >
          {title}
        </h3>
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  )
}

interface DataRowProps {
  label: string
  value: string | number | boolean | null | undefined
  type?: "text" | "date" | "currency"
  highlight?: boolean
}

function DataRow({ label, value, type = "text", highlight }: DataRowProps) {
  let displayValue: string

  if (value === null || value === undefined || value === "") {
    displayValue = "—"
  } else if (type === "date" && value) {
    try {
      displayValue = new Date(String(value)).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    } catch {
      displayValue = cleanLatex(String(value))
    }
  } else if (type === "currency" && typeof value === "number") {
    displayValue = formatCurrency(value) || "—"
  } else {
    displayValue = cleanLatex(String(value))
  }

  const isEmpty = displayValue === "—"

  return (
    <div className="flex items-start justify-between py-1.5 gap-4 hover:bg-gray-50/50 -mx-2 px-2 rounded">
      <span className="text-xs text-gray-600 flex-shrink-0">{label}</span>
      <span
        className={`text-xs text-right font-medium ${
          isEmpty
            ? "text-gray-300"
            : highlight
              ? "text-emerald-600 text-sm"
              : "text-gray-900"
        }`}
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
  if (freq === "annual") return "Annuel"
  return freq || "—"
}

function formatIndexFrequency(freq: string | null | undefined): string {
  if (freq === "annual") return "Annuelle"
  if (freq === "quarterly") return "Trimestrielle"
  if (freq === "other") return "Autre"
  return freq || "—"
}
