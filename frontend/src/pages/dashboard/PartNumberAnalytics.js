// frontend/src/pages/dashboard/PartNumberAnalytics.js
//
// NEW — Feature 1 from the Dashboard Enhancement brief: "Part Number
// Analytics". Purely additive: this is its own section, its own data
// fetch (GET /shipment/part-analytics/:partNo), and does not alter any
// existing Dashboard section, component, or styling.
//
// All figures come straight from the Shipment List records that contain
// the searched part number — nothing here is hardcoded. Two labeling
// notes carried over from the backend (see shipment.controller.js):
//   • "Shipped" = has left the supplier (In Transit or Delivered).
//   • "Total Parts Sold" reuses the ordered-quantity total, since the app
//     doesn't have a separate sales/order-value figure.

import React, { useState, useCallback } from "react";
import API from "../../services/api";
import { useNavigate } from "react-router-dom";
import {
  StatusDonutChart,
  QtyBarChart,
  MonthlyBarChart,
  PerformanceBarChart,
} from "./DashboardCharts";

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function StatCard({ label, value, sub }) {
  return (
    <div className="pna-stat">
      <div className="pna-stat-value">{value}</div>
      <div className="pna-stat-label">{label}</div>
      {sub && <div className="pna-stat-sub">{sub}</div>}
    </div>
  );
}

function StatusBadge({ status }) {
  const meta = {
    IN_PROCESS: { label: "In Process", bg: "#FEF9C3", color: "#92400E", border: "#FDE68A" },
    IN_TRANSIT: { label: "In Transit", bg: "#DBEAFE", color: "#1E40AF", border: "#BFDBFE" },
    DELIVERED: { label: "Delivered", bg: "#D1FAE5", color: "#065F46", border: "#6EE7B7" },
    DELAYED: { label: "Delayed", bg: "#FEE2E2", color: "#991B1B", border: "#FCA5A5" },
  }[status] || { label: status || "—", bg: "#F1F5F9", color: "#475569", border: "#E2E8F0" };
  return (
    <span className="status-pill" style={{ background: meta.bg, color: meta.color, borderColor: meta.border }}>
      {meta.label}
    </span>
  );
}

export default function PartNumberAnalytics() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [searchedFor, setSearchedFor] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  const runSearch = useCallback((partNo) => {
    const term = partNo.trim();
    if (!term) return;
    setLoading(true);
    setError("");
    setData(null);
    API.get(`/shipment/part-analytics/${encodeURIComponent(term)}`)
      .then((res) => {
        setData(res.data);
        setSearchedFor(term);
      })
      .catch((err) => {
        console.error("Part analytics fetch failed", err);
        setError("Failed to load part number analytics. Please try again.");
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    runSearch(query);
  };

  return (
    <div className="pna-section">
      <div className="section-hdr">Part Number Analytics</div>

      <div className="pna-search-card">
        <form className="pna-search-row" onSubmit={handleSubmit}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            placeholder="Search by Part Number…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="db-btn db-btn-primary" disabled={loading || !query.trim()}>
            {loading ? "Searching…" : "Search"}
          </button>
        </form>
      </div>

      {error && <div className="ldash-error">{error}</div>}

      {!error && !loading && !data && (
        <div className="pna-empty">Search a part number above to see its full shipment analytics.</div>
      )}

      {!loading && data && data.found === false && (
        <div className="pna-empty">No shipments found for part number "{searchedFor}".</div>
      )}

      {!loading && data && data.found && (
        <>
          {/* Basic Details */}
          <div className="pna-card">
            <h4>Basic Details</h4>
            <div className="pna-basic-grid">
              <div><span className="pna-k">Part Number</span><span className="pna-v">{data.basicDetails.partNo}</span></div>
              <div><span className="pna-k">Customer(s)</span><span className="pna-v">{data.basicDetails.customers.join(", ") || "—"}</span></div>
              <div><span className="pna-k">Supplier(s)</span><span className="pna-v">{data.basicDetails.suppliers.join(", ") || "—"}</span></div>
              <div><span className="pna-k">QMREL Number(s)</span><span className="pna-v">{data.basicDetails.qmrelNumbers.join(", ") || "—"}</span></div>
              <div><span className="pna-k">Total Qty Ordered</span><span className="pna-v">{data.basicDetails.totalQuantityOrdered}</span></div>
              <div><span className="pna-k">Total Qty Shipped</span><span className="pna-v">{data.basicDetails.totalQuantityShipped}</span></div>
              <div><span className="pna-k">Total Qty Pending</span><span className="pna-v">{data.basicDetails.totalQuantityPending}</span></div>
              <div><span className="pna-k">Shipments Completed</span><span className="pna-v">{data.basicDetails.shipmentsCompleted}</span></div>
              <div><span className="pna-k">Shipments In Progress</span><span className="pna-v">{data.basicDetails.shipmentsInProgress}</span></div>
              <div><span className="pna-k">Cancelled Shipments</span><span className="pna-v">{data.basicDetails.shipmentsCancelled}</span></div>
              <div><span className="pna-k">Pending Shipments</span><span className="pna-v">{data.basicDetails.shipmentsPending}</span></div>
            </div>
          </div>

          {/* Shipment Analytics */}
          <div className="pna-stat-grid">
            <StatCard label="Total Shipments Created" value={data.shipmentAnalytics.totalShipmentsCreated} />
            <StatCard label="Total Parts Sold" value={data.shipmentAnalytics.totalPartsSold} sub="= total quantity ordered" />
            <StatCard label="Total Parts Shipped" value={data.shipmentAnalytics.totalPartsShipped} />
            <StatCard label="Remaining Quantity" value={data.shipmentAnalytics.remainingQuantity} />
            <StatCard label="% Completed" value={`${data.shipmentAnalytics.percentCompleted}%`} />
            <StatCard
              label="Shipment Success Rate"
              value={data.shipmentAnalytics.successRate != null ? `${data.shipmentAnalytics.successRate}%` : "No data"}
              sub={data.shipmentAnalytics.successRate != null ? "Completed ÷ (Completed + Delayed)" : "No finalized shipments yet"}
            />
            <StatCard
              label="Avg Delivery Time"
              value={data.shipmentAnalytics.avgDeliveryTimeDays != null ? `${data.shipmentAnalytics.avgDeliveryTimeDays} days` : "No data"}
            />
            <StatCard label="Total Transit Time" value={`${data.shipmentAnalytics.totalTransitTimeDays} days`} />
          </div>

          {/* Progress Tracking */}
          <div className="pna-card">
            <h4>Progress Tracking — Total Quantity: {data.progress.totalQuantity}</h4>
            <div className="pna-progress-track">
              <div className="pna-progress-seg" style={{ width: `${data.progress.completedPct}%`, background: "#065F46" }} title={`Completed ${data.progress.completedQty} (${data.progress.completedPct}%)`} />
              <div className="pna-progress-seg" style={{ width: `${data.progress.inProgressPct}%`, background: "#1E40AF" }} title={`In Progress ${data.progress.inProgressQty} (${data.progress.inProgressPct}%)`} />
              <div className="pna-progress-seg" style={{ width: `${data.progress.pendingPct}%`, background: "#92400E" }} title={`Pending ${data.progress.pendingQty} (${data.progress.pendingPct}%)`} />
            </div>
            <div className="pna-progress-legend">
              <span><i style={{ background: "#065F46" }} /> Completed: {data.progress.completedQty} ({data.progress.completedPct}%)</span>
              <span><i style={{ background: "#1E40AF" }} /> In Progress: {data.progress.inProgressQty} ({data.progress.inProgressPct}%)</span>
              <span><i style={{ background: "#92400E" }} /> Pending: {data.progress.pendingQty} ({data.progress.pendingPct}%)</span>
            </div>
          </div>

          {/* Shipment Status Summary cards */}
          <div className="kpi-grid pna-summary-grid">
            <StatCard label="Total Shipments" value={data.statusSummary.totalShipments} />
            <StatCard label="Total Parts Ordered" value={data.statusSummary.totalPartsOrdered} />
            <StatCard label="Total Parts Delivered" value={data.statusSummary.totalPartsDelivered} />
            <StatCard label="Total Pending Quantity" value={data.statusSummary.totalPendingQuantity} />
            <StatCard label="Total Delayed Shipments" value={data.statusSummary.totalDelayedShipments} />
            <StatCard label="Total Completed Shipments" value={data.statusSummary.totalCompletedShipments} />
          </div>

          {/* Timeline */}
          <div className="pna-card">
            <h4>Timeline</h4>
            <div className="pna-basic-grid">
              <div><span className="pna-k">First Shipment Date</span><span className="pna-v">{fmtDate(data.timeline.firstShipmentDate)}</span></div>
              <div><span className="pna-k">Latest Shipment Date</span><span className="pna-v">{fmtDate(data.timeline.latestShipmentDate)}</span></div>
              <div><span className="pna-k">Expected Delivery Date</span><span className="pna-v">{data.timeline.expectedDeliveryDate ? fmtDate(data.timeline.expectedDeliveryDate) : "No upcoming date"}</span></div>
              <div><span className="pna-k">Avg Shipment Duration</span><span className="pna-v">{data.timeline.avgShipmentDurationDays != null ? `${data.timeline.avgShipmentDurationDays} days` : "No data"}</span></div>
            </div>
          </div>

          {/* Charts */}
          <div className="charts-grid">
            <div className="chart-card">
              <div className="chart-card-hdr"><h4>Monthly Shipment Graph</h4></div>
              <div className="chart-card-body" style={{ height: 220 }}>
                <MonthlyBarChart data={data.charts.monthlyShipments} />
              </div>
            </div>
            <div className="chart-card">
              <div className="chart-card-hdr"><h4>Quantity Shipped Graph</h4></div>
              <div className="chart-card-body" style={{ height: 220 }}>
                <QtyBarChart data={data.charts.quantityShipped} valueKey="qty" color="#0EA5E9" emptyMessage="No shipped quantity yet" />
              </div>
            </div>
            <div className="chart-card">
              <div className="chart-card-hdr"><h4>Pending Quantity Graph</h4></div>
              <div className="chart-card-body" style={{ height: 220 }}>
                <QtyBarChart data={data.charts.quantityPending} valueKey="qty" color="#D97706" emptyMessage="No pending quantity" />
              </div>
            </div>
            <div className="chart-card">
              <div className="chart-card-hdr"><h4>Shipment Status Pie Chart</h4></div>
              <div className="chart-card-body" style={{ height: 220 }}>
                <StatusDonutChart data={data.charts.statusPie} />
              </div>
            </div>
            <div className="chart-card">
              <div className="chart-card-hdr"><h4>Delivery Performance Chart</h4></div>
              <div className="chart-card-body" style={{ height: 220 }}>
                <PerformanceBarChart data={data.charts.deliveryPerformance} colors={["#065F46", "#991B1B"]} />
              </div>
            </div>
          </div>

          {/* Shipment History Table */}
          <div className="op-table-card pna-history">
            <div className="op-table-hdr">
              <h4>Shipment History — Part {data.partNo}</h4>
              <span className="op-table-count">{data.history.length}</span>
            </div>
            <div className="op-table-scroll">
              <table className="op-table">
                <thead>
                  <tr>
                    <th>Part Number</th><th>Customer</th><th>Supplier</th><th>QMREL</th>
                    <th>ETD</th><th>ETA</th><th>Invoice No</th><th>BL No</th>
                    <th>Quantity</th><th>Shipment Status</th><th>Delivery Status</th><th>Transit Days</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.history.map((r) => (
                    <tr key={r.id}>
                      <td>{r.partNo}</td>
                      <td>{r.customer || "—"}</td>
                      <td>{r.supplier || "—"}</td>
                      <td>{r.qmrel || "—"}</td>
                      <td>{fmtDate(r.etd)}</td>
                      <td>{fmtDate(r.eta)}</td>
                      <td>{r.invoiceNo || "—"}</td>
                      <td>{r.blNo || "—"}</td>
                      <td>{r.quantity}</td>
                      <td>{r.shipmentStatus}</td>
                      <td><StatusBadge status={r.deliveryStatus} /></td>
                      <td>{r.transitDays != null ? r.transitDays : "—"}</td>
                      <td><button className="op-table-action" onClick={() => navigate(`/logistics/${r.id}`)}>View</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
