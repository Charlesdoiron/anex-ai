"use client"

import { useState } from "react"
import type {
  LeaseExtractionResult,
  ExtractedValue,
  ConfidenceLevel,
} from "@/app/lib/extraction/types"

interface ExtractionPanelProps {
  extraction: LeaseExtractionResult
}

interface FieldDisplayProps {
  label: string
  value: ExtractedValue<any> | any
  type?: "text" | "number" | "boolean" | "date" | "array" | "object"
}

function safeNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const parsed = parseFloat(value.replace(/[^\d.-]/g, ""))
    return isNaN(parsed) ? null : parsed
  }
  if (typeof value === "object" && value !== null && "value" in value) {
    return safeNumber((value as { value: unknown }).value)
  }
  return null
}

function safeDisplayValue(value: unknown): string {
  if (value === null || value === undefined) return "–"
  if (typeof value === "string") return value
  if (typeof value === "number") return String(value)
  if (typeof value === "boolean") return value ? "Oui" : "Non"
  if (typeof value === "object" && value !== null && "value" in value) {
    return safeDisplayValue((value as { value: unknown }).value)
  }
  if (typeof value === "object") return "–"
  return String(value)
}

function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  const styles = {
    high: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    medium:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    low: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    missing: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  }

  const labels = {
    high: "Élevé",
    medium: "Moyen",
    low: "Faible",
    missing: "Absent",
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[level]}`}
    >
      {labels[level]}
    </span>
  )
}

function FieldDisplay({ label, value, type = "text" }: FieldDisplayProps) {
  if (value === null || value === undefined) {
    return (
      <div className="py-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
          </span>
          <ConfidenceBadge level="missing" />
        </div>
        <p className="text-sm text-gray-400 dark:text-gray-600 italic">
          Non disponible
        </p>
      </div>
    )
  }

  const isExtractedValue = typeof value === "object" && "confidence" in value

  if (isExtractedValue) {
    const extractedValue = value as ExtractedValue<any>
    const displayValue = extractedValue.value

    if (
      displayValue === null ||
      displayValue === undefined ||
      extractedValue.confidence === "missing"
    ) {
      return (
        <div className="py-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {label}
            </span>
            <ConfidenceBadge level={extractedValue.confidence} />
          </div>
          <p className="text-sm text-gray-400 dark:text-gray-600 italic">
            Non trouvé
          </p>
        </div>
      )
    }

    let formattedValue: string

    if (type === "boolean") {
      formattedValue = displayValue ? "Oui" : "Non"
    } else if (type === "date" && displayValue) {
      try {
        const dateStr =
          typeof displayValue === "string" ? displayValue : String(displayValue)
        formattedValue = new Date(dateStr).toLocaleDateString("fr-FR")
      } catch {
        formattedValue = safeDisplayValue(displayValue)
      }
    } else if (type === "array" && Array.isArray(displayValue)) {
      formattedValue =
        displayValue.length > 0 ? displayValue.join(", ") : "Aucun"
    } else if (type === "number") {
      const num = safeNumber(displayValue)
      formattedValue = num !== null ? num.toLocaleString("fr-FR") : "–"
    } else {
      formattedValue = safeDisplayValue(displayValue)
    }

    return (
      <div className="py-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
          </span>
          <ConfidenceBadge level={extractedValue.confidence} />
        </div>
        <p className="text-sm text-gray-900 dark:text-white">
          {formattedValue}
        </p>
        {extractedValue.source && (
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            Source: {extractedValue.source}
          </p>
        )}
      </div>
    )
  }

  let formattedValue: string
  if (type === "boolean") {
    formattedValue = value ? "Oui" : "Non"
  } else if (type === "array" && Array.isArray(value)) {
    formattedValue = value.length > 0 ? value.join(", ") : "Aucun"
  } else if (type === "object") {
    formattedValue = safeDisplayValue(value)
  } else {
    formattedValue = safeDisplayValue(value)
  }

  return (
    <div className="py-2">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </span>
      <p className="text-sm text-gray-900 dark:text-white mt-1 whitespace-pre-wrap">
        {formattedValue}
      </p>
    </div>
  )
}

interface SectionProps {
  title: string
  icon: React.ReactNode
  color: string
  children: React.ReactNode
  defaultOpen?: boolean
}

function Section({
  title,
  icon,
  color,
  children,
  defaultOpen = true,
}: SectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {title}
          </h3>
        </div>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {isOpen && (
        <div className="px-6 pb-6 border-t border-gray-100 dark:border-gray-700">
          <div className="pt-4 space-y-1 divide-y divide-gray-100 dark:divide-gray-700">
            {children}
          </div>
        </div>
      )}
    </div>
  )
}

export function ExtractionPanel({ extraction }: ExtractionPanelProps) {
  const metadata = extraction.extractionMetadata

  return (
    <div className="space-y-6">
      {metadata && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <svg
                  className="w-5 h-5 text-blue-600 dark:text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {extraction.pageCount ?? "-"}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  pages
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <svg
                  className="w-5 h-5 text-green-600 dark:text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {metadata.extractedFields ?? "-"}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Extraits
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                <svg
                  className="w-5 h-5 text-yellow-600 dark:text-yellow-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {metadata.averageConfidence
                    ? Math.round(metadata.averageConfidence * 100)
                    : "-"}
                  %
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Confiance
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <svg
                  className="w-5 h-5 text-purple-600 dark:text-purple-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {metadata.processingTimeMs
                    ? (metadata.processingTimeMs / 1000).toFixed(1)
                    : "-"}
                  s
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Traitement
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {extraction.regime && (
        <Section
          title="Régime du bail"
          icon={
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          }
          color="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
        >
          <FieldDisplay
            label="Type de bail"
            value={(extraction.regime as any)?.regime || extraction.regime}
          />
        </Section>
      )}

      <Section
        title="Parties au contrat"
        icon={
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
        }
        color="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
      >
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Bailleur
            </h4>
            <div className="pl-4 space-y-1 divide-y divide-gray-100 dark:divide-gray-700">
              <FieldDisplay
                label="Nom"
                value={extraction.parties?.landlord?.name}
              />
              <FieldDisplay
                label="SIREN"
                value={extraction.parties?.landlord?.siren}
              />
              <FieldDisplay
                label="Email"
                value={extraction.parties?.landlord?.email}
              />
              <FieldDisplay
                label="Téléphone"
                value={extraction.parties?.landlord?.phone}
              />
              <FieldDisplay
                label="Adresse"
                value={extraction.parties?.landlord?.address}
              />
              <FieldDisplay
                label="SIREN"
                value={extraction.parties?.landlord?.siren}
              />
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Preneur
            </h4>
            <div className="pl-4 space-y-1 divide-y divide-gray-100 dark:divide-gray-700">
              <FieldDisplay
                label="Nom"
                value={extraction.parties?.tenant?.name}
              />
              <FieldDisplay
                label="SIREN"
                value={extraction.parties?.tenant?.siren}
              />
              <FieldDisplay
                label="Email"
                value={extraction.parties?.tenant?.email}
              />
              <FieldDisplay
                label="Téléphone"
                value={extraction.parties?.tenant?.phone}
              />
              <FieldDisplay
                label="Adresse"
                value={extraction.parties?.tenant?.address}
              />
              <FieldDisplay
                label="SIREN"
                value={extraction.parties?.tenant?.siren}
              />
            </div>
          </div>
        </div>
      </Section>

      <Section
        title="Locaux"
        icon={
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
        }
        color="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
      >
        <FieldDisplay
          label="Destination"
          value={extraction.premises?.purpose}
        />
        <FieldDisplay
          label="Désignation"
          value={extraction.premises?.designation}
        />
        <FieldDisplay label="Adresse" value={extraction.premises?.address} />
        <FieldDisplay
          label="Année de construction"
          value={extraction.premises?.buildingYear}
          type="number"
        />
        <FieldDisplay
          label="Étages"
          value={extraction.premises?.floors}
          type="array"
        />
        <FieldDisplay
          label="Surface (m²)"
          value={extraction.premises?.surfaceArea}
          type="number"
        />
        <FieldDisplay
          label="Places de parking"
          value={extraction.premises?.parkingSpaces}
          type="number"
        />
      </Section>

      <Section
        title="Calendrier et dates"
        icon={
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        }
        color="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400"
      >
        <FieldDisplay
          label="Date de signature"
          value={extraction.calendar?.signatureDate}
          type="date"
        />
        <FieldDisplay
          label="Date de prise d'effet"
          value={extraction.calendar?.effectiveDate}
          type="date"
        />
        <FieldDisplay
          label="Date de fin"
          value={extraction.calendar?.endDate}
          type="date"
        />
        <FieldDisplay
          label="Durée (années)"
          value={extraction.calendar?.duration}
          type="number"
        />
        <FieldDisplay
          label="Préavis"
          value={extraction.calendar?.noticePeriod}
        />
      </Section>

      <Section
        title="Loyer"
        icon={
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        }
        color="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
      >
        <FieldDisplay
          label="Loyer annuel HTHC"
          value={extraction.rent?.annualRentExclTaxExclCharges}
          type="number"
        />
        <FieldDisplay
          label="Loyer trimestriel HTHC"
          value={extraction.rent?.quarterlyRentExclTaxExclCharges}
          type="number"
        />
        <FieldDisplay
          label="Loyer annuel au m²"
          value={extraction.rent?.annualRentPerSqmExclTaxExclCharges}
          type="number"
        />
        <FieldDisplay
          label="Assujetti à la TVA"
          value={extraction.rent?.isSubjectToVAT}
          type="boolean"
        />
        <FieldDisplay
          label="Fréquence de paiement"
          value={extraction.rent?.paymentFrequency}
        />
      </Section>

      <Section
        title="Indexation"
        icon={
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
            />
          </svg>
        }
        color="bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400"
        defaultOpen={false}
      >
        <FieldDisplay
          label="Type d'indice"
          value={extraction.indexation?.indexationType}
        />
        <FieldDisplay
          label="Trimestre de référence"
          value={extraction.indexation?.referenceQuarter}
        />
        <FieldDisplay
          label="Date de première indexation"
          value={extraction.indexation?.firstIndexationDate}
          type="date"
        />
        <FieldDisplay
          label="Fréquence"
          value={extraction.indexation?.indexationFrequency}
        />
      </Section>

      <Section
        title="Charges et frais"
        icon={
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
        }
        color="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
        defaultOpen={false}
      >
        <FieldDisplay
          label="Provision charges annuelles HT"
          value={extraction.charges?.annualChargesProvisionExclTax}
          type="number"
        />
        <FieldDisplay
          label="Provision charges trimestrielles HT"
          value={extraction.charges?.quarterlyChargesProvisionExclTax}
          type="number"
        />
        <FieldDisplay
          label="Honoraires gestion à charge du preneur"
          value={extraction.charges?.managementFeesOnTenant}
          type="boolean"
        />
      </Section>

      <Section
        title="Taxes et impôts"
        icon={
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"
            />
          </svg>
        }
        color="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
        defaultOpen={false}
      >
        <FieldDisplay
          label="Taxe foncière et TEOM refacturées"
          value={extraction.taxes?.propertyTaxRebilled}
          type="boolean"
        />
        <FieldDisplay
          label="Montant taxe foncière"
          value={extraction.taxes?.propertyTaxAmount}
          type="number"
        />
        <FieldDisplay
          label="Montant TEOM"
          value={extraction.taxes?.teomAmount}
          type="number"
        />
        <FieldDisplay
          label="Taxe bureaux"
          value={extraction.taxes?.officeTaxAmount}
          type="number"
        />
      </Section>

      <Section
        title="Assurances"
        icon={
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
        }
        color="bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400"
        defaultOpen={false}
      >
        <FieldDisplay
          label="Prime d'assurance annuelle HT"
          value={extraction.insurance?.annualInsuranceAmountExclTax}
          type="number"
        />
        <FieldDisplay
          label="Prime refacturée"
          value={extraction.insurance?.insurancePremiumRebilled}
          type="boolean"
        />
        <FieldDisplay
          label="Renonciation à recours"
          value={extraction.insurance?.hasWaiverOfRecourse}
          type="boolean"
        />
      </Section>

      <Section
        title="Sûretés et garanties"
        icon={
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        }
        color="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
        defaultOpen={false}
      >
        <FieldDisplay
          label="Montant dépôt de garantie"
          value={extraction.securities?.securityDepositAmount}
          type="number"
        />
        <FieldDisplay
          label="Autres sûretés"
          value={extraction.securities?.otherSecurities}
          type="array"
        />
      </Section>

      <Section
        title="Autres informations"
        icon={
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        }
        color="bg-slate-100 dark:bg-slate-900/30 text-slate-600 dark:text-slate-400"
        defaultOpen={false}
      >
        <FieldDisplay
          label="Signé et paraphé"
          value={extraction.other?.isSignedAndInitialed}
          type="boolean"
        />
        <FieldDisplay
          label="Dérogations Code civil"
          value={extraction.other?.civilCodeDerogations}
          type="array"
        />
        <FieldDisplay
          label="Dérogations Code de commerce"
          value={extraction.other?.commercialCodeDerogations}
          type="array"
        />
      </Section>
    </div>
  )
}
