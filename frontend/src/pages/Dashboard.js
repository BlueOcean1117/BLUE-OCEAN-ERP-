import React, { useEffect, useState } from "react";
import API from "../services/api";
import "./Dashboard.css";

import { Bar, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";

/* Chart.js registration */
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
);

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    API.get("/shipment/dashboard")
      .then((res) => {
        setSummary(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load dashboard data");
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="dashboard-loading">Loading dashboard...</p>;
  if (error) return <p className="dashboard-error">{error}</p>;

  /* ---------- CHART OPTIONS ---------- */
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          boxWidth: 14,
        },
      },
    },
  };

  /* ---------- CHART DATA ---------- */

  const modeChartData = {
    labels: summary.modeWise.map((m) => m.mode),
    datasets: [
      {
        label: "Shipments by Mode",
        data: summary.modeWise.map((m) => Number(m.count)),
        backgroundColor: ["#4CAF50", "#2196F3", "#FF9800"],
        borderRadius: 8,
      },
    ],
  };

  const statusChartData = {
    labels: summary.statusWise.map((s) => s.status),
    datasets: [
      {
        label: "Shipments by Status",
        data: summary.statusWise.map((s) => Number(s.count)),
        backgroundColor: ["#673AB7", "#009688", "#E91E63"],
      },
    ],
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="dashboard-header">
        <h2 className="dashboard-title">Logistics Dashboard</h2>
        <p className="dashboard-subtitle">
          Real-time insights into your shipment operations
        </p>
      </div>

      {/* Stats */}
      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-icon">📦</div>
          <div className="stat-content">
            <h3>{summary.totalShipments}</h3>
            <p>Total Shipments</p>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="dashboard-charts">
        <div className="chart-card">
          <h4>Shipments by Mode</h4>
          <div className="chart-container">
            <Bar data={modeChartData} options={chartOptions} />
          </div>
        </div>

        <div className="chart-card">
          <h4>Shipments by Status</h4>
          <div className="chart-container">
            <Pie data={statusChartData} options={chartOptions} />
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="dashboard-details">
        <div className="detail-card">
          <h4>Mode Breakdown</h4>
          <ul className="detail-list">
            {summary.modeWise.map((m) => (
              <li key={m.mode} className="detail-item">
                <span className="detail-label">{m.mode}</span>
                <span className="detail-value">{m.count}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="detail-card">
          <h4>Status Breakdown</h4>
          <ul className="detail-list">
            {summary.statusWise.map((s) => (
              <li key={s.status} className="detail-item">
                <span className="detail-label">{s.status}</span>
                <span className="detail-value">{s.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
