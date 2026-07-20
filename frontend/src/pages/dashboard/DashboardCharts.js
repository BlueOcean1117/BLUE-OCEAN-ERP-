// frontend/src/pages/dashboard/DashboardCharts.js
//
// Chart components for the Logistics Dashboard. Built on chart.js /
// react-chartjs-2 (already a project dependency — see the original
// Dashboard.js). Every chart takes already-computed real data from
// useDashboardData.js; none of them contain sample/mock series.

import React from "react";
import { Doughnut, Bar, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

const NAVY = "#0F172A";
const SLATE = "#64748B";
const GRID = "#EEF2F7";

export function EmptyChartState({ message = "No data available" }) {
  return (
    <div className="chart-empty">
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={SLATE} strokeWidth="1.5">
        <path d="M4 19V5m0 14h16M8 15l3-3 2 2 4-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>{message}</span>
    </div>
  );
}

export function StatusDonutChart({ data }) {
  const withCounts = data.filter((d) => d.count > 0);
  if (withCounts.length === 0) return <EmptyChartState message="No shipments to summarize yet" />;

  const chartData = {
    labels: withCounts.map((d) => d.label),
    datasets: [
      {
        data: withCounts.map((d) => d.count),
        backgroundColor: withCounts.map((d) => d.color),
        borderWidth: 2,
        borderColor: "#fff",
      },
    ],
  };
  return (
    <Doughnut
      data={chartData}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        cutout: "68%",
        plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 11 }, color: SLATE } } },
      }}
    />
  );
}

export function MonthlyBarChart({ data }) {
  if (!data || data.length === 0) return <EmptyChartState message="No dated shipments yet" />;
  const chartData = {
    labels: data.map((d) => d.month),
    datasets: [
      {
        label: "Shipments",
        data: data.map((d) => d.count),
        backgroundColor: "#3B82F6",
        borderRadius: 6,
        maxBarThickness: 34,
      },
    ],
  };
  return (
    <Bar
      data={chartData}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: SLATE, font: { size: 11 } } },
          y: { beginAtZero: true, grid: { color: GRID }, ticks: { color: SLATE, precision: 0 } },
        },
      }}
    />
  );
}

export function DeliveryTrendLineChart({ data }) {
  if (!data || data.length === 0) return <EmptyChartState message="No delivered shipments yet" />;
  const chartData = {
    labels: data.map((d) => d.month),
    datasets: [
      {
        label: "Delivered",
        data: data.map((d) => d.count),
        borderColor: "#059669",
        backgroundColor: "rgba(5,150,105,0.12)",
        fill: true,
        tension: 0.35,
        pointRadius: 3,
        pointBackgroundColor: "#059669",
      },
    ],
  };
  return (
    <Line
      data={chartData}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: SLATE, font: { size: 11 } } },
          y: { beginAtZero: true, grid: { color: GRID }, ticks: { color: SLATE, precision: 0 } },
        },
      }}
    />
  );
}

export function HorizontalBarChart({ data, color = "#3B82F6", emptyMessage = "No data available" }) {
  if (!data || data.length === 0) return <EmptyChartState message={emptyMessage} />;
  const chartData = {
    labels: data.map((d) => d.label),
    datasets: [
      {
        data: data.map((d) => d.count),
        backgroundColor: color,
        borderRadius: 6,
        maxBarThickness: 22,
      },
    ],
  };
  return (
    <Bar
      data={chartData}
      options={{
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, grid: { color: GRID }, ticks: { color: SLATE, precision: 0 } },
          y: { grid: { display: false }, ticks: { color: NAVY, font: { size: 11.5 } } },
        },
      }}
    />
  );
}

// ── Additions for Part Number Analytics (new — existing charts above are
// untouched). Generic enough to reuse the same visual language. ───────────
export function QtyBarChart({ data, valueKey = "qty", color = "#0EA5E9", emptyMessage = "No data available" }) {
  if (!data || data.length === 0) return <EmptyChartState message={emptyMessage} />;
  const chartData = {
    labels: data.map((d) => d.month),
    datasets: [
      {
        label: "Quantity",
        data: data.map((d) => d[valueKey] || 0),
        backgroundColor: color,
        borderRadius: 6,
        maxBarThickness: 34,
      },
    ],
  };
  return (
    <Bar
      data={chartData}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: SLATE, font: { size: 11 } } },
          y: { beginAtZero: true, grid: { color: GRID }, ticks: { color: SLATE, precision: 0 } },
        },
      }}
    />
  );
}

export function PerformanceBarChart({ data, colors = ["#065F46", "#991B1B"], emptyMessage = "No data available" }) {
  const withCounts = (data || []).filter((d) => d.count > 0);
  if (withCounts.length === 0) return <EmptyChartState message={emptyMessage} />;
  const chartData = {
    labels: (data || []).map((d) => d.label),
    datasets: [
      {
        data: (data || []).map((d) => d.count),
        backgroundColor: (data || []).map((_, i) => colors[i % colors.length]),
        borderRadius: 6,
        maxBarThickness: 40,
      },
    ],
  };
  return (
    <Bar
      data={chartData}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: SLATE, font: { size: 11 } } },
          y: { beginAtZero: true, grid: { color: GRID }, ticks: { color: SLATE, precision: 0 } },
        },
      }}
    />
  );
}

// Status-wise progress / completion bars (not a chart.js chart — a scannable
// linear breakdown, deliberately distinct from the donut above).
export function StatusProgressBars({ distribution }) {
  const total = distribution.reduce((sum, d) => sum + d.count, 0);
  if (total === 0) return <EmptyChartState message="No shipments to summarize yet" />;
  return (
    <div className="progress-stack">
      {distribution.map((d) => {
        const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
        return (
          <div className="progress-row" key={d.key}>
            <div className="progress-row-hdr">
              <span className="progress-dot" style={{ background: d.color }} />
              <span className="progress-label">{d.label}</span>
              <span className="progress-value">{d.count} · {pct}%</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${pct}%`, background: d.color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
