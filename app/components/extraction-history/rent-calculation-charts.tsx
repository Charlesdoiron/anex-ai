"use client"

import { useMemo } from "react"
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  ReferenceLine,
  Area,
  ComposedChart,
} from "recharts"
import { TrendingUp, Wallet, PiggyBank, Percent, Building2 } from "lucide-react"
import type {
  ComputeLeaseRentScheduleResult,
  RentSchedulePeriod,
  YearlyTotalSummary,
} from "@/app/lib/lease/types"

interface RentCalculationChartsProps {
  schedule: ComputeLeaseRentScheduleResult
  baseIndexValue: number
}

export default function RentCalculationCharts({
  schedule,
  baseIndexValue,
}: RentCalculationChartsProps) {
  const { chartData, kpis, yearlyData, hasParking } = useMemo(() => {
    const periods = schedule.schedule
    const yearlyTotals = schedule.summary.yearlyTotals

    // Build chart data from periods
    const chartData = periods.map((period: RentSchedulePeriod) => {
      const label =
        period.periodType === "month"
          ? `${String(period.month).padStart(2, "0")}/${period.year}`
          : `T${period.quarter} ${period.year}`

      return {
        label,
        year: period.year,
        quarter: period.quarter,
        month: period.month,
        netRent: Math.round(period.netRentHT * 100) / 100,
        index: period.indexValue,
        indexFactor: period.indexFactor,
        officeRent: Math.round(period.officeRentHT * 100) / 100,
        parkingRent: Math.round(period.parkingRentHT * 100) / 100,
      }
    })

    // Yearly data for bar chart
    const yearlyData = yearlyTotals.map((year: YearlyTotalSummary) => ({
      year: String(year.year),
      baseRent: Math.round(year.baseRentHT * 100) / 100,
      charges: Math.round(year.chargesHT * 100) / 100,
      netRent: Math.round(year.netRentHT * 100) / 100,
    }))

    // Calculate KPIs
    const firstPeriod = periods[0]
    const lastPeriod = periods[periods.length - 1]
    const totalRent = periods.reduce(
      (sum: number, p: RentSchedulePeriod) => sum + p.netRentHT,
      0
    )
    const rentIncrease = firstPeriod
      ? ((lastPeriod!.netRentHT - firstPeriod.netRentHT) /
          firstPeriod.netRentHT) *
        100
      : 0
    const indexEvolution = firstPeriod
      ? ((lastPeriod!.indexValue - firstPeriod.indexValue) /
          firstPeriod.indexValue) *
        100
      : 0

    // Check if parking is present
    const hasParking = periods.some(
      (p: RentSchedulePeriod) => p.parkingRentHT > 0
    )

    // Calculate rent breakdown for first period
    const officeTotal = periods.reduce(
      (sum: number, p: RentSchedulePeriod) => sum + p.officeRentHT,
      0
    )
    const parkingTotal = periods.reduce(
      (sum: number, p: RentSchedulePeriod) => sum + p.parkingRentHT,
      0
    )
    const officePercent =
      officeTotal + parkingTotal > 0
        ? (officeTotal / (officeTotal + parkingTotal)) * 100
        : 100
    const parkingPercent = 100 - officePercent

    const kpis = {
      totalRent,
      rentIncrease,
      indexEvolution,
      tcam: schedule.summary.tcam || 0,
      deposit: schedule.summary.depositHT,
      periodsCount: periods.length,
      officePercent,
      parkingPercent,
      officeTotal,
      parkingTotal,
    }

    return { chartData, kpis, yearlyData, hasParking }
  }, [schedule])

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={<Wallet className="w-4 h-4" />}
          label="Loyer cumulé"
          value={formatCurrency(kpis.totalRent)}
          sublabel={`sur ${kpis.periodsCount} périodes`}
          accent="emerald"
        />
        <KpiCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Évolution loyer"
          value={`+${kpis.rentIncrease.toFixed(1)}%`}
          sublabel="du 1er au dernier"
          accent="emerald"
          trend={kpis.rentIncrease > 0 ? "up" : "neutral"}
        />
        <KpiCard
          icon={<Percent className="w-4 h-4" />}
          label="TCAM"
          value={`${(kpis.tcam * 100).toFixed(2)}%`}
          sublabel="croissance annuelle moy."
          accent="slate"
        />
        <KpiCard
          icon={<PiggyBank className="w-4 h-4" />}
          label="Dépôt de garantie"
          value={kpis.deposit > 0 ? formatCurrency(kpis.deposit) : "—"}
          sublabel="HT initial"
          accent="slate"
        />
      </div>

      {/* Rent Evolution Chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
        <h4 className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-gray-400" />
          Évolution du loyer et de l&apos;indice INSEE
        </h4>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 5, right: 45, left: 0, bottom: 5 }}
            >
              <defs>
                <linearGradient id="rentGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.08} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f3f4f6"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9, fill: "#9ca3af" }}
                tickLine={false}
                axisLine={{ stroke: "#e5e7eb" }}
                interval="preserveStartEnd"
              />
              <YAxis
                yAxisId="rent"
                orientation="left"
                tick={{ fontSize: 9, fill: "#9ca3af" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                domain={["dataMin - 500", "dataMax + 500"]}
                width={35}
              />
              <YAxis
                yAxisId="index"
                orientation="right"
                tick={{ fontSize: 9, fill: "#9ca3af" }}
                tickLine={false}
                axisLine={false}
                domain={["dataMin - 1", "dataMax + 1"]}
                width={40}
              />
              <Tooltip content={<RentTooltip />} />
              <ReferenceLine
                yAxisId="index"
                y={baseIndexValue}
                stroke="#d1d5db"
                strokeDasharray="5 5"
                strokeOpacity={0.6}
              />
              <Area
                yAxisId="rent"
                type="monotone"
                dataKey="netRent"
                fill="url(#rentGradient)"
                stroke="none"
              />
              <Line
                yAxisId="rent"
                type="monotone"
                dataKey="netRent"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "#10b981", strokeWidth: 0 }}
                name="Loyer net HT"
              />
              <Line
                yAxisId="index"
                type="monotone"
                dataKey="index"
                stroke="#94a3b8"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                dot={false}
                activeDot={{ r: 3, fill: "#64748b", strokeWidth: 0 }}
                name="Indice INSEE"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-6 mt-2 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 bg-emerald-500 rounded-full" />
            <span className="text-[10px] text-gray-500">Loyer net HT</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-4 h-0.5 bg-slate-400 rounded-full"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(90deg, #94a3b8 0, #94a3b8 3px, transparent 3px, transparent 5px)",
              }}
            />
            <span className="text-[10px] text-gray-500">Indice INSEE</span>
          </div>
        </div>
      </div>

      {/* Yearly Comparison Bar Chart */}
      {yearlyData.length > 1 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <h4 className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <BarChartIcon className="w-3.5 h-3.5 text-gray-400" />
            Comparaison annuelle
          </h4>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={yearlyData}
                margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f3f4f6"
                  vertical={false}
                />
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 10, fill: "#6b7280", fontWeight: 500 }}
                  tickLine={false}
                  axisLine={{ stroke: "#e5e7eb" }}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "#9ca3af" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  width={35}
                />
                <Tooltip content={<YearlyTooltip />} />
                <Bar
                  dataKey="netRent"
                  fill="#10b981"
                  radius={[3, 3, 0, 0]}
                  name="Loyer net HT"
                  maxBarSize={50}
                  opacity={0.85}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Rent Composition - Only show if parking is present */}
      {hasParking && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <h4 className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5 text-gray-400" />
            Répartition des loyers
          </h4>
          <div className="flex items-center gap-4">
            {/* Visual bar */}
            <div className="flex-1 h-6 rounded overflow-hidden flex bg-gray-100">
              <div
                className="bg-emerald-500/80 flex items-center justify-center transition-all"
                style={{ width: `${kpis.officePercent}%` }}
              >
                {kpis.officePercent > 20 && (
                  <span className="text-[10px] font-medium text-white/90">
                    {kpis.officePercent.toFixed(0)}%
                  </span>
                )}
              </div>
              <div
                className="bg-slate-400/70 flex items-center justify-center transition-all"
                style={{ width: `${kpis.parkingPercent}%` }}
              >
                {kpis.parkingPercent > 20 && (
                  <span className="text-[10px] font-medium text-white/90">
                    {kpis.parkingPercent.toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between mt-3 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-sm bg-emerald-500/80" />
              <span className="text-gray-500">Bureaux</span>
              <span className="font-medium text-gray-700">
                {formatCurrency(kpis.officeTotal)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-sm bg-slate-400/70" />
              <span className="text-gray-500">Parking</span>
              <span className="font-medium text-gray-700">
                {formatCurrency(kpis.parkingTotal)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// KPI Card Component
interface KpiCardProps {
  icon: React.ReactNode
  label: string
  value: string
  sublabel: string
  accent?: "emerald" | "slate"
  trend?: "up" | "down" | "neutral"
}

function KpiCard({
  icon,
  label,
  value,
  sublabel,
  accent = "slate",
  trend,
}: KpiCardProps) {
  const isHighlight = accent === "emerald"

  return (
    <div className="bg-white rounded-lg p-3.5 border border-gray-200 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className={isHighlight ? "text-emerald-600" : "text-gray-400"}>
          {icon}
        </div>
        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div
        className={`text-xl font-semibold leading-none ${isHighlight ? "text-gray-900" : "text-gray-700"}`}
      >
        {value}
        {trend === "up" && (
          <span className="ml-1.5 text-xs font-medium text-emerald-500">↑</span>
        )}
        {trend === "down" && (
          <span className="ml-1.5 text-xs font-medium text-red-500">↓</span>
        )}
      </div>
      <div className="text-[10px] text-gray-400 mt-1">{sublabel}</div>
    </div>
  )
}

// Custom Tooltips
interface TooltipPayload {
  label: string
  netRent: number
  index: number
  officeRent: number
  parkingRent: number
}

function RentTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { payload: TooltipPayload }[]
  label?: string
}) {
  if (!active || !payload || !payload.length) return null

  const data = payload[0]?.payload
  if (!data) return null

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-md shadow-xl px-3 py-2.5 text-xs">
      <div className="font-medium text-gray-200 mb-2">{label}</div>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-6">
          <span className="text-gray-400">Loyer net HT</span>
          <span className="font-semibold text-emerald-400">
            {formatCurrency(data.netRent)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-gray-400">Indice INSEE</span>
          <span className="font-medium text-gray-300">
            {data.index.toFixed(2)}
          </span>
        </div>
        {data.parkingRent > 0 && (
          <>
            <hr className="border-gray-700 my-1.5" />
            <div className="flex items-center justify-between gap-6">
              <span className="text-gray-500">Bureaux</span>
              <span className="text-gray-400">
                {formatCurrency(data.officeRent)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-6">
              <span className="text-gray-500">Parking</span>
              <span className="text-gray-400">
                {formatCurrency(data.parkingRent)}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

interface YearlyTooltipPayload {
  year: string
  netRent: number
  baseRent: number
  charges: number
}

function YearlyTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { payload: YearlyTooltipPayload }[]
}) {
  if (!active || !payload || !payload.length) return null

  const data = payload[0]?.payload
  if (!data) return null

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-md shadow-xl px-3 py-2.5 text-xs">
      <div className="font-medium text-gray-200 mb-2">Année {data.year}</div>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-6">
          <span className="text-gray-400">Loyer net HT</span>
          <span className="font-semibold text-emerald-400">
            {formatCurrency(data.netRent)}
          </span>
        </div>
        {data.charges > 0 && (
          <div className="flex items-center justify-between gap-6">
            <span className="text-gray-500">Charges</span>
            <span className="text-gray-400">
              {formatCurrency(data.charges)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// Helper
function formatCurrency(value: number): string {
  return `${value.toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })} €`
}

// Simple bar chart icon (lucide doesn't have BarChart2 with this style)
function BarChartIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="12" width="4" height="9" rx="1" />
      <rect x="10" y="6" width="4" height="15" rx="1" />
      <rect x="17" y="3" width="4" height="18" rx="1" />
    </svg>
  )
}
