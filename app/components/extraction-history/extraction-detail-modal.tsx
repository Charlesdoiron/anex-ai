"use client"

import {
  X,
  Download,
  FileText,
  Building2,
  Users,
  MapPin,
  Calendar,
  Coins,
  TrendingUp,
  Shield,
  Wrench,
  File,
} from "lucide-react"
import type {
  LeaseExtractionResult,
  ExtractedValue,
} from "@/app/lib/extraction/types"
import { exportExtractionToExcel } from "@/app/components/extraction/utils/excel-export"
import { exportExtractionToPDF } from "@/app/components/extraction/utils/pdf-export"
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

function getValue<T>(field: ExtractedValue<T> | undefined | null): T | null {
  if (!field) return null
  if (typeof field !== "object") return field as T
  if (!("value" in field)) return null
  if ("confidence" in field && field.confidence === "missing") return null
  return field.value
}

interface ExtractionDetailModalProps {
  extraction: LeaseExtractionResult | null
  onClose: () => void
}

export default function ExtractionDetailModal({
  extraction,
  onClose,
}: ExtractionDetailModalProps) {
  const [isVisible, setIsVisible] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (extraction) {
      document.body.style.overflow = "hidden"
      requestAnimationFrame(() => setIsVisible(true))
    } else {
      setIsVisible(false)
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [extraction])

  const handleClose = useCallback(() => {
    setIsVisible(false)
    setTimeout(onClose, 200)
  }, [onClose])

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        handleClose()
      }
    }
    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [handleClose])

  if (!extraction) return null

  async function handleDownloadExcel() {
    if (!extraction) return
    try {
      await exportExtractionToExcel(extraction)
    } catch (error) {
      console.error("Error exporting to Excel:", error)
    }
  }

  function handleDownloadPDF() {
    if (!extraction) return
    try {
      exportExtractionToPDF(extraction)
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
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-md bg-brand-green/10 flex items-center justify-center text-brand-green flex-shrink-0">
                  <FileText className="w-4 h-4" strokeWidth={1.5} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-gray-900 truncate">
                    {extraction.fileName?.replace(/\.pdf$/i, "") || "Document"}
                  </h2>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(extraction.extractionDate).toLocaleDateString(
                        "fr-FR",
                        { day: "numeric", month: "short", year: "numeric" }
                      )}
                    </span>
                    {extraction.pageCount && (
                      <span>{extraction.pageCount} pages</span>
                    )}
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
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-brand-green text-white rounded-md hover:bg-brand-green/90 transition-colors"
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
            <ExtractionContent extraction={extraction} />
          </div>
        </div>
      </div>
    </div>
  )
}

function getRegimeValue(
  regime: LeaseExtractionResult["regime"] | undefined
): string | null {
  if (!regime) return null
  if ("regime" in regime && regime.regime) {
    return getValue(regime.regime)
  }
  if ("value" in regime) {
    return getValue(regime as unknown as ExtractedValue<string>)
  }
  return null
}

function formatArrayValue(value: unknown): string | null {
  if (!value) return null
  if (Array.isArray(value)) {
    return value.length > 0 ? cleanLatex(value.join(", ")) : null
  }
  return cleanLatex(String(value))
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
          ? "border-brand-green/30 shadow-sm ring-1 ring-brand-green/10"
          : "border-gray-200"
      }`}
    >
      <div
        className={`px-4 py-2.5 border-b flex items-center gap-2 ${
          highlight
            ? "bg-brand-green/5 border-brand-green/20"
            : "bg-gray-50/50 border-gray-100"
        }`}
      >
        <span className="text-brand-green">{icon}</span>
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
    displayValue = `${value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
  } else if (typeof value === "boolean") {
    displayValue = value ? "Oui" : "Non"
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
              ? "text-brand-green text-sm"
              : "text-gray-900"
        }`}
      >
        {displayValue}
      </span>
    </div>
  )
}

function ExtractionContent({
  extraction,
}: {
  extraction: LeaseExtractionResult
}) {
  const iconClass = "w-4 h-4"
  const iconStroke = 1.5

  // Get franchise and measures
  const franchiseMonths =
    getValue(extraction.supportMeasures?.rentFreePeriodMonths) ?? 0
  const franchiseAmount =
    getValue(extraction.supportMeasures?.rentFreePeriodAmount) ?? 0
  const measuresDescription = getValue(
    extraction.supportMeasures?.otherMeasuresDescription
  )

  // Get surfaces (using available fields)
  const totalSurface = getValue(extraction.premises?.surfaceArea)

  return (
    <div className="space-y-4">
      {/* Données de base */}
      <SectionCard
        title="Données de base"
        icon={<Building2 className={iconClass} strokeWidth={iconStroke} />}
      >
        <div className="space-y-2">
          <DataRow
            label="Régime juridique"
            value={getRegimeValue(extraction.regime)}
          />
          <DataRow
            label="Bailleur"
            value={getValue(extraction.parties?.landlord?.name)}
          />
          <DataRow
            label="Preneur"
            value={getValue(extraction.parties?.tenant?.name)}
          />
          <DataRow
            label="Adresse de l'actif"
            value={getValue(extraction.premises?.address)}
          />
        </div>
      </SectionCard>

      {/* Surfaces */}
      <SectionCard
        title="Surfaces"
        icon={<MapPin className={iconClass} strokeWidth={iconStroke} />}
      >
        <div className="space-y-2">
          <DataRow
            label="Surface totale"
            value={totalSurface ? `${totalSurface} m²` : null}
          />
          <DataRow
            label="Places de parking"
            value={
              getValue(extraction.premises?.parkingSpaces)
                ? `${getValue(extraction.premises?.parkingSpaces)} unités`
                : null
            }
          />
          <DataRow
            label="Étage(s) des locaux"
            value={formatArrayValue(getValue(extraction.premises?.floors))}
          />
        </div>
      </SectionCard>

      {/* Durée et dates clés */}
      <SectionCard
        title="Durée et dates clés"
        icon={<Calendar className={iconClass} strokeWidth={iconStroke} />}
      >
        <div className="space-y-2">
          <DataRow
            label="Durée du bail"
            value={
              getValue(extraction.calendar?.duration)
                ? `${getValue(extraction.calendar?.duration)} années`
                : null
            }
          />
          <DataRow
            label="Date signature"
            value={getValue(extraction.calendar?.signatureDate)}
            type="date"
          />
          <DataRow
            label="Date d'effet"
            value={getValue(extraction.calendar?.effectiveDate)}
            type="date"
          />
          <DataRow
            label="Prochaine faculté de résiliation/congé"
            value={getValue(extraction.calendar?.nextTriennialDate)}
            type="date"
          />
          <DataRow
            label="Préavis"
            value={getValue(extraction.calendar?.noticePeriod)}
          />
        </div>
      </SectionCard>

      {/* Données financières */}
      <SectionCard
        title="Données financières"
        icon={<Coins className={iconClass} strokeWidth={iconStroke} />}
        highlight
      >
        <div className="space-y-2">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Loyers bureaux
          </div>
          <DataRow
            label="Loyer de base annuel HTHC"
            value={getValue(extraction.rent?.annualRentExclTaxExclCharges)}
            type="currency"
          />
          <DataRow
            label="Loyer de base trimestriel HTHC"
            value={getValue(extraction.rent?.quarterlyRentExclTaxExclCharges)}
            type="currency"
          />
          <DataRow
            label="Loyer HTHC / m² / an"
            value={getValue(
              extraction.rent?.annualRentPerSqmExclTaxExclCharges
            )}
            type="currency"
          />

          <div className="pt-3 pb-1 border-t border-gray-100">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Loyers parking
            </div>
          </div>
          <DataRow
            label="Loyer de base parking annuel HTHC"
            value={getValue(extraction.rent?.annualParkingRentExclCharges)}
            type="currency"
          />
          <DataRow
            label="Loyer de base parking trimestriel HTHC"
            value={getValue(extraction.rent?.quarterlyParkingRentExclCharges)}
            type="currency"
          />
          <DataRow
            label="Loyer parking HTHC / unité / an"
            value={getValue(
              extraction.rent?.annualParkingRentPerUnitExclCharges
            )}
            type="currency"
          />

          <div className="pt-3 pb-1 border-t border-gray-100">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Charges et taxes
            </div>
          </div>
          <DataRow
            label="Provisions pour charges annuelles HT"
            value={getValue(extraction.charges?.annualChargesProvisionExclTax)}
            type="currency"
          />
          <DataRow
            label="Provisions pour charges trimestrielles HT"
            value={getValue(
              extraction.charges?.quarterlyChargesProvisionExclTax
            )}
            type="currency"
          />
          <DataRow
            label="Provisions pour charges HT/m²/an"
            value={getValue(
              extraction.charges?.annualChargesProvisionPerSqmExclTax
            )}
            type="currency"
          />
          <DataRow
            label="Provisions pour taxes annuelles"
            value={getValue(extraction.taxes?.propertyTaxAmount)}
            type="currency"
          />
          <DataRow
            label="Provisions pour taxes trimestrielles"
            value={
              getValue(extraction.taxes?.propertyTaxAmount)
                ? getValue(extraction.taxes?.propertyTaxAmount)! / 4
                : null
            }
            type="currency"
          />
          <DataRow
            label="Provisions pour taxes HT/m²/an"
            value={
              getValue(extraction.taxes?.propertyTaxAmount) && totalSurface
                ? getValue(extraction.taxes?.propertyTaxAmount)! / totalSurface
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
                ? `${franchiseMonths} mois${
                    franchiseAmount > 0
                      ? ` + ${franchiseAmount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € HT`
                      : ""
                  }`
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
              getValue(extraction.indexation?.indexationType)
                ? `${getValue(extraction.indexation?.indexationType)}${
                    getValue(extraction.indexation?.referenceQuarter)
                      ? ` - ${getValue(extraction.indexation?.referenceQuarter)}`
                      : ""
                  }`
                : null
            }
          />
          <DataRow
            label="Périodicité de l'indexation"
            value={
              getValue(extraction.indexation?.indexationFrequency) === "annual"
                ? "Annuelle"
                : getValue(extraction.indexation?.indexationFrequency) ===
                    "quarterly"
                  ? "Trimestrielle"
                  : getValue(extraction.indexation?.indexationFrequency)
            }
          />
          <DataRow
            label="Soumission TVA"
            value={
              getValue(extraction.rent?.isSubjectToVAT)
                ? "Oui 20%"
                : getValue(extraction.rent?.isSubjectToVAT) === false
                  ? "Non"
                  : null
            }
          />
        </div>
      </SectionCard>

      {/* Sûretés */}
      <SectionCard
        title="Sûretés"
        icon={<Shield className={iconClass} strokeWidth={iconStroke} />}
      >
        <div className="space-y-2">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Dépôt de garantie
          </div>
          <DataRow
            label="Montant du dépôt de garantie"
            value={getValue(extraction.securities?.securityDepositAmount)}
            type="currency"
          />

          <div className="pt-3 pb-1 border-t border-gray-100">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Autres sûretés
            </div>
          </div>
          <DataRow
            label="Autres types de sûretés"
            value={
              getValue(extraction.securities?.otherSecurities)
                ? formatArrayValue(
                    getValue(extraction.securities?.otherSecurities)
                  )
                : "Non"
            }
          />
        </div>
      </SectionCard>

      {/* Autres */}
      <SectionCard
        title="Autres"
        icon={<Shield className={iconClass} strokeWidth={iconStroke} />}
      >
        <div className="space-y-2">
          <DataRow
            label="Assurance - non-recours réciproque"
            value={getValue(extraction.insurance?.hasWaiverOfRecourse)}
          />
        </div>
      </SectionCard>

      {/* Travaux */}
      <SectionCard
        title="Travaux et restitution"
        icon={<Wrench className={iconClass} strokeWidth={iconStroke} />}
      >
        <div className="space-y-2">
          <DataRow
            label="Travaux à la charge du bailleur"
            value={formatArrayValue(
              getValue(extraction.maintenance?.landlordWorksList)
            )}
          />
          <DataRow
            label="Travaux à la charge du preneur"
            value={formatArrayValue(
              getValue(extraction.maintenance?.tenantWorksList)
            )}
          />
          <DataRow
            label="Condition de remise en état / restitution"
            value={getValue(extraction.restitution?.restitutionConditions)}
          />
        </div>
      </SectionCard>

      {/* Annexes */}
      <SectionCard
        title="Annexes"
        icon={<File className={iconClass} strokeWidth={iconStroke} />}
      >
        <div className="space-y-2">
          {(() => {
            // Collect all annexes
            const annexesList: { name: string; present: boolean | null }[] = []

            // Environmental annexes
            const hasDPE = getValue(extraction.environmentalAnnexes?.hasDPE)
            if (hasDPE !== null && hasDPE !== undefined)
              annexesList.push({ name: "DPE", present: hasDPE as boolean })

            const hasAsbestos = getValue(
              extraction.environmentalAnnexes?.hasAsbestosDiagnostic
            )
            if (hasAsbestos !== null && hasAsbestos !== undefined)
              annexesList.push({
                name: "Diagnostic amiante",
                present: hasAsbestos as boolean,
              })

            const hasEnvironmentalAnnex = getValue(
              extraction.environmentalAnnexes?.hasEnvironmentalAnnex
            )
            if (
              hasEnvironmentalAnnex !== null &&
              hasEnvironmentalAnnex !== undefined
            )
              annexesList.push({
                name: "Annexe environnementale",
                present: hasEnvironmentalAnnex as boolean,
              })

            const hasRiskStatement = getValue(
              extraction.environmentalAnnexes?.hasRiskAndPollutionStatement
            )
            if (hasRiskStatement !== null && hasRiskStatement !== undefined)
              annexesList.push({
                name: "Etat des risques et pollutions",
                present: hasRiskStatement as boolean,
              })

            // Other annexes
            const hasInternalRegulations = getValue(
              extraction.otherAnnexes?.hasInternalRegulations
            )
            if (
              hasInternalRegulations !== null &&
              hasInternalRegulations !== undefined
            )
              annexesList.push({
                name: "Règlement intérieur",
                present: hasInternalRegulations as boolean,
              })

            const hasPremisesPlan = getValue(
              extraction.otherAnnexes?.hasPremisesPlan
            )
            if (hasPremisesPlan !== null && hasPremisesPlan !== undefined)
              annexesList.push({
                name: "Plan des locaux",
                present: hasPremisesPlan as boolean,
              })

            const hasChargesInventory = getValue(
              extraction.otherAnnexes?.hasChargesInventory
            )
            if (
              hasChargesInventory !== null &&
              hasChargesInventory !== undefined
            )
              annexesList.push({
                name: "Inventaire des charges",
                present: hasChargesInventory as boolean,
              })

            const hasAnnualChargesSummary = getValue(
              extraction.otherAnnexes?.hasAnnualChargesSummary
            )
            if (
              hasAnnualChargesSummary !== null &&
              hasAnnualChargesSummary !== undefined
            )
              annexesList.push({
                name: "Etat récapitulatif annuel des charges",
                present: hasAnnualChargesSummary as boolean,
              })

            const hasThreeYearBudget = getValue(
              extraction.otherAnnexes?.hasThreeYearWorksBudget
            )
            if (hasThreeYearBudget !== null && hasThreeYearBudget !== undefined)
              annexesList.push({
                name: "Budget prévisionnel des travaux",
                present: hasThreeYearBudget as boolean,
              })

            const hasPastWorksSummary = getValue(
              extraction.otherAnnexes?.hasPastWorksSummary
            )
            if (
              hasPastWorksSummary !== null &&
              hasPastWorksSummary !== undefined
            )
              annexesList.push({
                name: "Etat récapitulatif des travaux passés",
                present: hasPastWorksSummary as boolean,
              })

            // Summary lines for present/absent annexes
            const presentAnnexes = annexesList
              .filter((a) => a.present === true)
              .map((a) => a.name)
            const absentAnnexes = annexesList
              .filter((a) => a.present === false)
              .map((a) => a.name)

            return (
              <>
                <DataRow
                  label="Présent"
                  value={
                    presentAnnexes.length > 0
                      ? presentAnnexes.join(", ")
                      : "Aucune"
                  }
                />
                <DataRow
                  label="Absent"
                  value={
                    absentAnnexes.length > 0
                      ? absentAnnexes.join(", ")
                      : "Aucune"
                  }
                />

                <div className="pt-3 pb-1 border-t border-gray-100">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Détails
                  </div>
                </div>

                <DataRow
                  label="Règlement intérieur"
                  value={hasInternalRegulations}
                />
                <DataRow label="Plan des locaux" value={hasPremisesPlan} />
                <DataRow
                  label="État des lieux charges"
                  value={hasChargesInventory}
                />
              </>
            )
          })()}
        </div>
      </SectionCard>
    </div>
  )
}
