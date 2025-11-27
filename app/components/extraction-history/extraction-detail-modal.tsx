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
import type { LeaseExtractionResult } from "@/app/lib/extraction/types"
import { exportExtractionToExcel } from "@/app/components/extraction/utils/excel-export"
import { useEffect, useState, useRef } from "react"

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

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        handleClose()
      }
    }
    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [])

  function handleClose() {
    setIsVisible(false)
    setTimeout(onClose, 200)
  }

  if (!extraction) return null

  function handleDownload() {
    if (!extraction) return
    try {
      exportExtractionToExcel(extraction)
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

function extractValue(field: unknown): unknown {
  if (field && typeof field === "object" && "value" in field) {
    return (field as { value: unknown }).value
  }
  return field
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
        <span className="text-brand-green">{icon}</span>
        <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
          {title}
        </h3>
      </div>
      <div className="px-4 py-2 divide-y divide-gray-50">{children}</div>
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

  return (
    <div className="space-y-3">
      {/* Régime */}
      {extraction.regime && (
        <SectionCard
          title="Régime du bail"
          icon={<Building2 className={iconClass} strokeWidth={iconStroke} />}
        >
          <FieldRow
            label="Type"
            value={
              extractValue(
                (extraction.regime as { regime?: unknown })?.regime ||
                  extraction.regime
              ) as string
            }
          />
        </SectionCard>
      )}

      {/* Parties */}
      <SectionCard
        title="Parties au contrat"
        icon={<Users className={iconClass} strokeWidth={iconStroke} />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 pt-1">
              Bailleur
            </div>
            <FieldRow
              label="Nom"
              value={extractValue(extraction.parties?.landlord?.name) as string}
            />
            <FieldRow
              label="SIREN"
              value={
                extractValue(extraction.parties?.landlord?.siren) as string
              }
            />
            <FieldRow
              label="Adresse"
              value={
                extractValue(extraction.parties?.landlord?.address) as string
              }
            />
            <FieldRow
              label="Email"
              value={
                extractValue(extraction.parties?.landlord?.email) as string
              }
            />
            <FieldRow
              label="Téléphone"
              value={
                extractValue(extraction.parties?.landlord?.phone) as string
              }
            />
          </div>
          <div>
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 pt-1">
              Preneur
            </div>
            <FieldRow
              label="Nom"
              value={extractValue(extraction.parties?.tenant?.name) as string}
            />
            <FieldRow
              label="SIREN"
              value={extractValue(extraction.parties?.tenant?.siren) as string}
            />
            <FieldRow
              label="Adresse"
              value={
                extractValue(extraction.parties?.tenant?.address) as string
              }
            />
            <FieldRow
              label="Email"
              value={extractValue(extraction.parties?.tenant?.email) as string}
            />
            <FieldRow
              label="Téléphone"
              value={extractValue(extraction.parties?.tenant?.phone) as string}
            />
          </div>
        </div>
      </SectionCard>

      {/* Locaux */}
      <SectionCard
        title="Locaux"
        icon={<MapPin className={iconClass} strokeWidth={iconStroke} />}
      >
        <FieldRow
          label="Destination"
          value={extractValue(extraction.premises?.purpose) as string}
        />
        <FieldRow
          label="Désignation"
          value={extractValue(extraction.premises?.designation) as string}
        />
        <FieldRow
          label="Adresse"
          value={extractValue(extraction.premises?.address) as string}
        />
        <FieldRow
          label="Surface"
          value={
            extractValue(extraction.premises?.surfaceArea)
              ? `${extractValue(extraction.premises?.surfaceArea)} m²`
              : null
          }
        />
        <FieldRow
          label="Étages"
          value={
            Array.isArray(extractValue(extraction.premises?.floors))
              ? (extractValue(extraction.premises?.floors) as string[]).join(
                  ", "
                )
              : (extractValue(extraction.premises?.floors) as string)
          }
        />
        <FieldRow
          label="Parking"
          value={
            extractValue(extraction.premises?.parkingSpaces)
              ? `${extractValue(extraction.premises?.parkingSpaces)} places`
              : null
          }
        />
      </SectionCard>

      {/* Calendrier */}
      <SectionCard
        title="Dates et durée"
        icon={<Clock className={iconClass} strokeWidth={iconStroke} />}
      >
        <FieldRow
          label="Signature"
          value={extractValue(extraction.calendar?.signatureDate) as string}
          type="date"
        />
        <FieldRow
          label="Prise d'effet"
          value={extractValue(extraction.calendar?.effectiveDate) as string}
          type="date"
        />
        <FieldRow
          label="Fin du bail"
          value={extractValue(extraction.calendar?.endDate) as string}
          type="date"
        />
        <FieldRow
          label="Durée"
          value={
            extractValue(extraction.calendar?.duration)
              ? `${extractValue(extraction.calendar?.duration)} ans`
              : null
          }
        />
        <FieldRow
          label="Préavis"
          value={extractValue(extraction.calendar?.noticePeriod) as string}
        />
      </SectionCard>

      {/* Loyer */}
      <SectionCard
        title="Loyer"
        icon={<Coins className={iconClass} strokeWidth={iconStroke} />}
      >
        <FieldRow
          label="Loyer annuel HT/HC"
          value={
            extractValue(
              extraction.rent?.annualRentExclTaxExclCharges
            ) as number
          }
          type="currency"
        />
        <FieldRow
          label="Loyer trimestriel HT/HC"
          value={
            extractValue(
              extraction.rent?.quarterlyRentExclTaxExclCharges
            ) as number
          }
          type="currency"
        />
        <FieldRow
          label="Loyer au m² / an"
          value={
            extractValue(
              extraction.rent?.annualRentPerSqmExclTaxExclCharges
            ) as number
          }
          type="currency"
        />
        <FieldRow
          label="TVA applicable"
          value={extractValue(extraction.rent?.isSubjectToVAT) as boolean}
          type="boolean"
        />
        <FieldRow
          label="Fréquence"
          value={extractValue(extraction.rent?.paymentFrequency) as string}
        />
      </SectionCard>

      {/* Indexation */}
      <SectionCard
        title="Indexation"
        icon={<TrendingUp className={iconClass} strokeWidth={iconStroke} />}
      >
        <FieldRow
          label="Type d'indice"
          value={extractValue(extraction.indexation?.indexationType) as string}
        />
        <FieldRow
          label="Trimestre de référence"
          value={
            extractValue(extraction.indexation?.referenceQuarter) as string
          }
        />
        <FieldRow
          label="Première indexation"
          value={
            extractValue(extraction.indexation?.firstIndexationDate) as string
          }
          type="date"
        />
        <FieldRow
          label="Fréquence"
          value={
            extractValue(extraction.indexation?.indexationFrequency) as string
          }
        />
      </SectionCard>

      {/* Charges */}
      <SectionCard
        title="Charges"
        icon={<Receipt className={iconClass} strokeWidth={iconStroke} />}
      >
        <FieldRow
          label="Provision annuelle HT"
          value={
            extractValue(
              extraction.charges?.annualChargesProvisionExclTax
            ) as number
          }
          type="currency"
        />
        <FieldRow
          label="Provision trimestrielle HT"
          value={
            extractValue(
              extraction.charges?.quarterlyChargesProvisionExclTax
            ) as number
          }
          type="currency"
        />
        <FieldRow
          label="Honoraires de gestion (preneur)"
          value={
            extractValue(extraction.charges?.managementFeesOnTenant) as boolean
          }
          type="boolean"
        />
      </SectionCard>

      {/* Garanties */}
      <SectionCard
        title="Garanties"
        icon={<Shield className={iconClass} strokeWidth={iconStroke} />}
      >
        <FieldRow
          label="Dépôt de garantie"
          value={
            extractValue(extraction.securities?.securityDepositAmount) as number
          }
          type="currency"
        />
        <FieldRow
          label="Autres sûretés"
          value={
            Array.isArray(extractValue(extraction.securities?.otherSecurities))
              ? (
                  extractValue(
                    extraction.securities?.otherSecurities
                  ) as string[]
                ).join(", ")
              : (extractValue(extraction.securities?.otherSecurities) as string)
          }
        />
      </SectionCard>
    </div>
  )
}
