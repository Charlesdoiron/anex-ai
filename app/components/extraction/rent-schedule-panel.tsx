"use client"

import { useState } from "react"
import type { ComputeLeaseRentScheduleResult } from "@/app/lib/lease/types"
import * as XLSX from "xlsx"

interface RentSchedulePanelProps {
  schedule: ComputeLeaseRentScheduleResult
  fileName?: string
}

export function RentSchedulePanel({
  schedule,
  fileName,
}: RentSchedulePanelProps) {
  const [showDetails, setShowDetails] = useState(false)
  const { summary } = schedule

  function exportToExcel() {
    const workbook = XLSX.utils.book_new()

    const summaryData = [
      { Métrique: "Dépôt de garantie HT", Valeur: summary.depositHT },
      {
        Métrique: "TCAM (%)",
        Valeur: summary.tcam ? (summary.tcam * 100).toFixed(2) : "N/A",
      },
    ]
    const summarySheet = XLSX.utils.json_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Résumé")

    const yearlyData = summary.yearlyTotals.map((y) => ({
      Année: y.year,
      "Loyer de base HT": y.baseRentHT,
      "Charges HT": y.chargesHT,
      "Taxes HT": y.taxesHT,
      "Franchise HT": y.franchiseHT,
      "Incentives HT": y.incentivesHT,
      "Net HT": y.netRentHT,
    }))
    const yearlySheet = XLSX.utils.json_to_sheet(yearlyData)
    XLSX.utils.book_append_sheet(workbook, yearlySheet, "Totaux annuels")

    const scheduleData = schedule.schedule.map((p) => ({
      "Début période": p.periodStart,
      "Fin période": p.periodEnd,
      Type: p.periodType === "month" ? "Mensuel" : "Trimestriel",
      Année: p.year,
      Mois: p.month ?? "",
      Trimestre: p.quarter ?? "",
      Indice: p.indexValue,
      "Facteur indice": p.indexFactor,
      "Bureaux HT": p.officeRentHT,
      "Parkings HT": p.parkingRentHT,
      "Autres HT": p.otherCostsHT,
      "Charges HT": p.chargesHT,
      "Taxes HT": p.taxesHT,
      "Franchise HT": p.franchiseHT,
      "Incentives HT": p.incentivesHT,
      "Net HT": p.netRentHT,
    }))
    const scheduleSheet = XLSX.utils.json_to_sheet(scheduleData)
    XLSX.utils.book_append_sheet(workbook, scheduleSheet, "Échéancier détaillé")

    const baseFileName = fileName?.replace(/\.pdf$/i, "") || "bail"
    XLSX.writeFile(workbook, `${baseFileName}-echeancier.xlsx`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Échéancier des loyers
        </h3>
        <button
          onClick={exportToExcel}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          Exporter Excel
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
              <svg
                className="w-5 h-5 text-emerald-600 dark:text-emerald-400"
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
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {summary.depositHT.toLocaleString("fr-FR")} €
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Dépôt de garantie HT
              </p>
            </div>
          </div>
        </div>

        {summary.tcam !== undefined && (
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
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {(summary.tcam * 100).toFixed(2)} %
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  TCAM (taux croissance annuel moyen)
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h4 className="text-base font-semibold text-gray-900 dark:text-white">
            Totaux annuels
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                  Année
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">
                  Loyer de base
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">
                  Charges
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">
                  Taxes
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">
                  Franchise
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300 bg-emerald-50 dark:bg-emerald-900/20">
                  Net HT
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {summary.yearlyTotals.map((year) => (
                <tr
                  key={year.year}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                    {year.year}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                    {year.baseRentHT.toLocaleString("fr-FR")} €
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                    {year.chargesHT.toLocaleString("fr-FR")} €
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                    {year.taxesHT.toLocaleString("fr-FR")} €
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                    {year.franchiseHT !== 0
                      ? `${year.franchiseHT.toLocaleString("fr-FR")} €`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/10">
                    {year.netRentHT.toLocaleString("fr-FR")} €
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        >
          <h4 className="text-base font-semibold text-gray-900 dark:text-white">
            Détail par période ({schedule.schedule.length} périodes)
          </h4>
          <svg
            className={`w-5 h-5 text-gray-500 transition-transform ${showDetails ? "rotate-180" : ""}`}
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

        {showDetails && (
          <div className="border-t border-gray-200 dark:border-gray-700 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    Période
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700 dark:text-gray-300">
                    Indice
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700 dark:text-gray-300">
                    Bureaux
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700 dark:text-gray-300">
                    Parking
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700 dark:text-gray-300">
                    Charges
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700 dark:text-gray-300">
                    Taxes
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700 dark:text-gray-300 bg-emerald-50 dark:bg-emerald-900/20">
                    Net HT
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {schedule.schedule.map((period, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <td className="px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap">
                      {period.periodStart}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">
                      {period.indexValue.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">
                      {period.officeRentHT.toLocaleString("fr-FR")} €
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">
                      {period.parkingRentHT > 0
                        ? `${period.parkingRentHT.toLocaleString("fr-FR")} €`
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">
                      {period.chargesHT > 0
                        ? `${period.chargesHT.toLocaleString("fr-FR")} €`
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">
                      {period.taxesHT > 0
                        ? `${period.taxesHT.toLocaleString("fr-FR")} €`
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/10">
                      {period.netRentHT.toLocaleString("fr-FR")} €
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
