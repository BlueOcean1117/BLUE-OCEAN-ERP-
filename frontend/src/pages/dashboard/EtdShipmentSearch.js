// frontend/src/pages/dashboard/EtdShipmentSearch.js
//
// NEW — Feature 2 from the Dashboard Enhancement brief: "Shipment Search
// by ETD Date". Purely additive: its own section, its own data fetch
// (GET /shipment/search-by-etd), no changes to any existing Dashboard
// section or component.

import React, { useState, useCallback } from "react";
import API from "../../services/api";
import { useNavigate } from "react-router-dom";

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
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

const EMPTY_FILTERS = {
  mode: "single", // "single" | "range"
  date: "",
  fromDate: "",
  toDate: "",
  customer: "",
  supplier: "",
  partNo: "",
  status: "",
  deliveryStatus: "",
};

export default function EtdShipmentSearch() {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_FILTERS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const runSearch = useCallback((f, pg) => {
    if (f.mode === "single" && !f.date) return;
    if (f.mode === "range" && !f.fromDate && !f.toDate) return;

    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (f.mode === "single") {
      params.set("date", f.date);
    } else {
      if (f.fromDate) params.set("fromDate", f.fromDate);
      if (f.toDate) params.set("toDate", f.toDate);
    }
    if (f.customer) params.set("customer", f.customer);
    if (f.supplier) params.set("supplier", f.supplier);
    if (f.partNo) params.set("partNo", f.partNo);
    if (f.status) params.set("status", f.status);
    if (f.deliveryStatus) params.set("deliveryStatus", f.deliveryStatus);
    params.set("page", pg);
    params.set("pageSize", pageSize);

    API.get(`/shipment/search-by-etd?${params.toString()}`)
      .then((res) => {
        setResult(res.data);
        setPage(pg);
      })
      .catch((err) => {
        console.error("ETD search failed", err);
        setError(err?.response?.data?.message || "Failed to search shipments by ETD.");
        setResult(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    runSearch(form, 1);
  };

  const totalPages = result ? Math.max(1, Math.ceil(result.total / pageSize)) : 1;

  return (
    <div className="etd-section">
      <div className="section-hdr">Shipment Search by ETD Date</div>

      <div className="pna-search-card">
        <form className="etd-form" onSubmit={handleSubmit}>
          <div className="etd-mode-toggle">
            <button type="button" className={form.mode === "single" ? "etd-mode active" : "etd-mode"} onClick={() => set({ mode: "single" })}>
              Single ETD Date
            </button>
            <button type="button" className={form.mode === "range" ? "etd-mode active" : "etd-mode"} onClick={() => set({ mode: "range" })}>
              Date Range
            </button>
          </div>

          <div className="etd-fields">
            {form.mode === "single" ? (
              <input type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} required />
            ) : (
              <>
                <input type="date" value={form.fromDate} onChange={(e) => set({ fromDate: e.target.value })} title="From Date" />
                <span>–</span>
                <input type="date" value={form.toDate} onChange={(e) => set({ toDate: e.target.value })} title="To Date" />
              </>
            )}

            <input placeholder="Customer" value={form.customer} onChange={(e) => set({ customer: e.target.value })} />
            <input placeholder="Supplier" value={form.supplier} onChange={(e) => set({ supplier: e.target.value })} />
            <input placeholder="Part Number" value={form.partNo} onChange={(e) => set({ partNo: e.target.value })} />

            <select value={form.status} onChange={(e) => set({ status: e.target.value })}>
              <option value="">All shipment statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            <select value={form.deliveryStatus} onChange={(e) => set({ deliveryStatus: e.target.value })}>
              <option value="">All delivery statuses</option>
              <option value="IN_PROCESS">In Process</option>
              <option value="IN_TRANSIT">In Transit</option>
              <option value="DELIVERED">Delivered</option>
              <option value="DELAYED">Delayed</option>
            </select>

            <button type="submit" className="db-btn db-btn-primary" disabled={loading}>
              {loading ? "Searching…" : "Search"}
            </button>
          </div>
        </form>
      </div>

      {error && <div className="ldash-error">{error}</div>}

      {!error && !loading && !result && (
        <div className="pna-empty">Pick an ETD date or date range above to search shipments.</div>
      )}

      {!loading && result && (
        <>
          <div className="kpi-grid">
            <div className="pna-stat"><div className="pna-stat-value">{result.summary.totalShipments}</div><div className="pna-stat-label">Total Shipments</div></div>
            <div className="pna-stat"><div className="pna-stat-value">{result.summary.completedShipments}</div><div className="pna-stat-label">Completed Shipments</div></div>
            <div className="pna-stat"><div className="pna-stat-value">{result.summary.inTransit}</div><div className="pna-stat-label">In Transit</div></div>
            <div className="pna-stat"><div className="pna-stat-value">{result.summary.pending}</div><div className="pna-stat-label">Pending</div></div>
            <div className="pna-stat"><div className="pna-stat-value">{result.summary.delayed}</div><div className="pna-stat-label">Delayed</div></div>
            <div className="pna-stat"><div className="pna-stat-value">{result.summary.delivered}</div><div className="pna-stat-label">Delivered</div></div>
            <div className="pna-stat"><div className="pna-stat-value">{result.summary.totalQuantity}</div><div className="pna-stat-label">Total Quantity</div></div>
            <div className="pna-stat"><div className="pna-stat-value">{result.summary.totalCustomers}</div><div className="pna-stat-label">Total Customers</div></div>
            <div className="pna-stat"><div className="pna-stat-value">{result.summary.totalSuppliers}</div><div className="pna-stat-label">Total Suppliers</div></div>
          </div>

          <div className="op-table-card pna-history">
            <div className="op-table-hdr">
              <h4>Shipments — Oldest ETD to Newest</h4>
              <span className="op-table-count">{result.total}</span>
            </div>
            {result.rows.length === 0 ? (
              <div className="op-table-empty">No shipments match this ETD search.</div>
            ) : (
              <div className="op-table-scroll">
                <table className="op-table">
                  <thead>
                    <tr>
                      <th>ETD</th><th>ETA</th><th>QMREL</th><th>Customer</th><th>Supplier</th>
                      <th>Part No(s)</th><th>Quantity</th><th>Invoice No</th><th>BL No</th>
                      <th>Shipment Status</th><th>Delivery Status</th><th>Final Delivery Date</th><th>Transit Days</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((r) => (
                      <tr key={r.id}>
                        <td>{fmtDate(r.etd)}</td>
                        <td>{fmtDate(r.eta)}</td>
                        <td>{r.qmrel || "—"}</td>
                        <td>{r.customer || "—"}</td>
                        <td>{r.supplier || "—"}</td>
                        <td>{r.partNos.length ? r.partNos.join(", ") : "—"}</td>
                        <td>{r.quantity}</td>
                        <td>{r.invoiceNo || "—"}</td>
                        <td>{r.blNo || "—"}</td>
                        <td>{r.shipmentStatus}</td>
                        <td><StatusBadge status={r.deliveryStatus} /></td>
                        <td>{fmtDate(r.finalDeliveryDate)}</td>
                        <td>{r.transitDays != null ? r.transitDays : "—"}</td>
                        <td><button className="op-table-action" onClick={() => navigate(`/logistics/${r.id}`)}>View</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {result.total > pageSize && (
              <div className="pagination">
                <button disabled={page === 1 || loading} onClick={() => runSearch(form, page - 1)}>⬅ Prev</button>
                <span>Page <strong>{page}</strong> of {totalPages}</span>
                <button disabled={page >= totalPages || loading} onClick={() => runSearch(form, page + 1)}>Next ➡</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
