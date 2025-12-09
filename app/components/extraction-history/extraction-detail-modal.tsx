"use client"

import {
  X,
  Download,
  FileText,
  Calendar,
  Building2,
  Users,
  MapPin,
  Clock,
  Coins,
  TrendingUp,
  Receipt,
  Shield,
} from "lucide-react"
import type {
  LeaseExtractionResult,
  ExtractedValue,
} from "@/app/lib/extraction/types"
import { exportExtractionToExcel } from "@/app/components/extraction/utils/excel-export"
import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Extract the value from an ExtractedValue object
 * Matches the logic used in excel-export.ts for consistency
 */
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

  async function handleDownload() {
    if (!extraction) return
    try {
      await exportExtractionToExcel(extraction)
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
        className={`relative w-full max-w-3xl mx-4 my-8 transition-all duration-300 ${
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
                  onClick={handleDownload}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-brand-green text-white rounded-md hover:bg-brand-green/90 transition-colors"
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
            <ExtractionContent extraction={extraction} />
          </div>
        </div>
      </div>
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
    displayValue = value.toLocaleString("fr-FR") + " €"
  } else {
    displayValue = String(value)
  }

  const isEmpty = displayValue === "—"

  return (
    <div className="flex items-start justify-between py-2 gap-4">
      <span className="text-xs text-gray-500 flex-shrink-0">{label}</span>
      <span
        className={`text-xs text-right ${isEmpty ? "text-gray-300" : "text-gray-800"}`}
      >
        {displayValue}
      </span>
    </div>
  )
}

/**
 * Get regime value - handles both { regime: { value } } and { value } structures
 */
function getRegimeValue(
  regime: LeaseExtractionResult["regime"] | undefined
): string | null {
  if (!regime) return null
  // New structure: { regime: { value, confidence } }
  if ("regime" in regime && regime.regime) {
    return getValue(regime.regime)
  }
  // Old structure: { value, confidence } directly
  if ("value" in regime) {
    return getValue(regime as unknown as ExtractedValue<string>)
  }
  return null
}

/**
 * Format array or string value for display
 */
function formatArrayValue(value: unknown): string | null {
  if (!value) return null
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : null
  }
  return String(value)
}

interface SectionCardProps {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  highlight?: boolean
}

interface KpiFieldProps {
  label: string
  value: number | null
  primary?: boolean
}

function KpiField({ label, value, primary }: KpiFieldProps) {
  const displayValue =
    value !== null && value !== undefined
      ? `${value.toLocaleString("fr-FR")} €`
      : "—"

  const isEmpty = value === null || value === undefined

  return (
    <div className="py-2">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div
        className={`font-semibold ${
          primary ? "text-lg text-brand-green" : "text-base text-gray-900"
        } ${isEmpty ? "text-gray-300" : ""}`}
      >
        {displayValue}
      </div>
    </div>
  )
}

interface PartyMainInfoProps {
  name: string | null
  siren: string | null
}

function PartyMainInfo({ name, siren }: PartyMainInfoProps) {
  return (
    <div>
      <div className="text-sm font-semibold text-gray-900 mb-0.5">
        {name || "—"}
      </div>
      {siren && <div className="text-xs text-gray-600">SIREN: {siren}</div>}
    </div>
  )
}

interface ContactFieldProps {
  icon: string
  value: string | null
}

function ContactField({ icon, value }: ContactFieldProps) {
  if (!value) return null

  return (
    <div className="flex items-start gap-1.5 text-xs text-gray-600">
      <span className="text-[10px] mt-0.5">{icon}</span>
      <span className="break-all">{value}</span>
    </div>
  )
}

function SectionCard({
  title,
  icon,
  children,
  highlight,
}: SectionCardProps & { highlight?: boolean }) {
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
        <span className={highlight ? "text-brand-green" : "text-brand-green"}>
          {icon}
        </span>
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

function ExtractionContent({
  extraction,
}: {
  extraction: LeaseExtractionResult
}) {
  const iconClass = "w-3.5 h-3.5"
  const iconStroke = 1.5

  // Calculate total annual cost
  const annualRent = getValue(extraction.rent?.annualRentExclTaxExclCharges)
  const annualCharges = getValue(
    extraction.charges?.annualChargesProvisionExclTax
  )
  const totalAnnual = (annualRent || 0) + (annualCharges || 0)

  return (
    <div className="space-y-3">
      {/* 1. SYNTHÈSE FINANCIÈRE - KPIs en tête */}
      <SectionCard
        title="Synthèse financière"
        icon={<Coins className={iconClass} strokeWidth={iconStroke} />}
        highlight
      >
        <div className="grid grid-cols-2 gap-4">
          <KpiField label="Loyer annuel HT/HC" value={annualRent} primary />
          <KpiField
            label="Loyer au m² / an"
            value={getValue(
              extraction.rent?.annualRentPerSqmExclTaxExclCharges
            )}
          />
          <KpiField label="Charges annuelles HT" value={annualCharges} />
          <KpiField
            label="Total annuel"
            value={totalAnnual > 0 ? totalAnnual : null}
            primary
          />
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100">
          <FieldRow
            label="Dépôt de garantie"
            value={getValue(extraction.securities?.securityDepositAmount)}
            type="currency"
          />
        </div>
      </SectionCard>

      {/* 2. DATES CLÉS */}
      <SectionCard
        title="Dates clés"
        icon={<Clock className={iconClass} strokeWidth={iconStroke} />}
      >
        <div className="grid grid-cols-2 gap-x-6">
          <FieldRow
            label="Prise d'effet"
            value={getValue(extraction.calendar?.effectiveDate)}
            type="date"
          />
          <FieldRow
            label="Fin du bail"
            value={getValue(extraction.calendar?.endDate)}
            type="date"
          />
          <FieldRow
            label="Durée"
            value={
              getValue(extraction.calendar?.duration)
                ? `${getValue(extraction.calendar?.duration)} ans`
                : null
            }
          />
          <FieldRow
            label="Prochaine échéance triennale"
            value={getValue(extraction.calendar?.nextTriennialDate)}
            type="date"
          />
        </div>
      </SectionCard>

      {/* 3. INDEXATION */}
      <SectionCard
        title="Indexation"
        icon={<TrendingUp className={iconClass} strokeWidth={iconStroke} />}
      >
        <div className="grid grid-cols-2 gap-x-6">
          <FieldRow
            label="Type d'indice"
            value={getValue(extraction.indexation?.indexationType)}
          />
          <FieldRow
            label="Trimestre de référence"
            value={getValue(extraction.indexation?.referenceQuarter)}
          />
          <FieldRow
            label="Première indexation"
            value={getValue(extraction.indexation?.firstIndexationDate)}
            type="date"
          />
          <FieldRow
            label="Fréquence"
            value={getValue(extraction.indexation?.indexationFrequency)}
          />
        </div>
      </SectionCard>

      {/* 4. PARTIES */}
      <SectionCard
        title="Parties au contrat"
        icon={<Users className={iconClass} strokeWidth={iconStroke} />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Bailleur
            </div>
            <div className="space-y-2">
              <PartyMainInfo
                name={getValue(extraction.parties?.landlord?.name)}
                siren={getValue(extraction.parties?.landlord?.siren)}
              />
              <div className="pt-2 border-t border-gray-50 space-y-1.5">
                <ContactField
                  icon="📧"
                  value={getValue(extraction.parties?.landlord?.email)}
                />
                <ContactField
                  icon="📞"
                  value={getValue(extraction.parties?.landlord?.phone)}
                />
                <ContactField
                  icon="📍"
                  value={getValue(extraction.parties?.landlord?.address)}
                />
              </div>
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Preneur
            </div>
            <div className="space-y-2">
              <PartyMainInfo
                name={getValue(extraction.parties?.tenant?.name)}
                siren={getValue(extraction.parties?.tenant?.siren)}
              />
              <div className="pt-2 border-t border-gray-50 space-y-1.5">
                <ContactField
                  icon="📧"
                  value={getValue(extraction.parties?.tenant?.email)}
                />
                <ContactField
                  icon="📞"
                  value={getValue(extraction.parties?.tenant?.phone)}
                />
                <ContactField
                  icon="📍"
                  value={getValue(extraction.parties?.tenant?.address)}
                />
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* 5. LOCAUX */}
      <SectionCard
        title="Locaux"
        icon={<MapPin className={iconClass} strokeWidth={iconStroke} />}
      >
        <div className="grid grid-cols-2 gap-x-6">
          <FieldRow
            label="Adresse"
            value={getValue(extraction.premises?.address)}
          />
          <FieldRow
            label="Surface"
            value={
              getValue(extraction.premises?.surfaceArea)
                ? `${getValue(extraction.premises?.surfaceArea)} m²`
                : null
            }
          />
          <FieldRow
            label="Destination"
            value={getValue(extraction.premises?.purpose)}
          />
          <FieldRow
            label="Parking"
            value={
              getValue(extraction.premises?.parkingSpaces)
                ? `${getValue(extraction.premises?.parkingSpaces)} places`
                : null
            }
          />
          <FieldRow
            label="Désignation"
            value={getValue(extraction.premises?.designation)}
          />
          <FieldRow
            label="Étages"
            value={formatArrayValue(getValue(extraction.premises?.floors))}
          />
        </div>
      </SectionCard>

      {/* 6. DÉTAILS FINANCIERS */}
      <SectionCard
        title="Détails financiers complémentaires"
        icon={<Receipt className={iconClass} strokeWidth={iconStroke} />}
      >
        <div className="grid grid-cols-2 gap-x-6">
          <FieldRow
            label="Loyer trimestriel HT/HC"
            value={getValue(extraction.rent?.quarterlyRentExclTaxExclCharges)}
            type="currency"
          />
          <FieldRow
            label="Provision charges trimestrielle HT"
            value={getValue(
              extraction.charges?.quarterlyChargesProvisionExclTax
            )}
            type="currency"
          />
          <FieldRow
            label="TVA applicable"
            value={getValue(extraction.rent?.isSubjectToVAT)}
            type="boolean"
          />
          <FieldRow
            label="Fréquence de paiement"
            value={getValue(extraction.rent?.paymentFrequency)}
          />
          <FieldRow
            label="Honoraires de gestion (preneur)"
            value={getValue(extraction.charges?.managementFeesOnTenant)}
            type="boolean"
          />
          <FieldRow
            label="Autres sûretés"
            value={formatArrayValue(
              getValue(extraction.securities?.otherSecurities)
            )}
          />
        </div>
      </SectionCard>

      {/* 7. RÉGIME (si présent) */}
      {extraction.regime && (
        <SectionCard
          title="Régime du bail"
          icon={<Building2 className={iconClass} strokeWidth={iconStroke} />}
        >
          <FieldRow label="Type" value={getRegimeValue(extraction.regime)} />
        </SectionCard>
      )}
    </div>
  )
}
