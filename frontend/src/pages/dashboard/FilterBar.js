// frontend/src/pages/dashboard/FilterBar.js
import React from "react";
import { STATUS_META } from "./useDashboardData";

function Select({ value, onChange, options, allLabel }) {
  return (
    <select className="db-select" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="ALL">{allLabel}</option>
      {options.map((o) => {
        const val = typeof o === "string" ? o : o.value;
        const label = typeof o === "string" ? o : o.label;
        return <option key={val} value={val}>{label}</option>;
      })}
    </select>
  );
}

export default function FilterBar({
  filters,
  setFilters,
  filterOptions,
  onRefresh,
  onExport,
  loading,
  lastFetched,
}) {
  const set = (patch) => setFilters((prev) => ({ ...prev, ...patch }));

  return (
    <div className="db-header">
      <div className="db-header-top">
        <div>
          <h1 className="db-title">Logistics Dashboard</h1>
          <p className="db-subtitle">
            Live overview from the Shipment List
            {lastFetched && <> · updated {lastFetched.toLocaleTimeString()}</>}
          </p>
        </div>
        <div className="db-header-actions">
          <button className="db-btn" onClick={onRefresh} disabled={loading}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6M1 20v-6h6" /><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
            </svg>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button className="db-btn db-btn-primary" onClick={onExport}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><path d="M7 10l5 5 5-5M12 15V3" />
            </svg>
            Export
          </button>
        </div>
      </div>

      <div className="db-filters">
        <div className="db-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            placeholder="Search shipment no, customer, BL, invoice, part no…"
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
          />
        </div>

        <Select value={filters.status} onChange={(v) => set({ status: v })} allLabel="All statuses" options={Object.entries(STATUS_META).map(([value, m]) => ({ value, label: m.label }))} />
        <Select value={filters.customer} onChange={(v) => set({ customer: v })} allLabel="All customers" options={filterOptions.customers} />
        <Select value={filters.supplier} onChange={(v) => set({ supplier: v })} allLabel="All suppliers" options={filterOptions.suppliers} />
        <Select value={filters.origin} onChange={(v) => set({ origin: v })} allLabel="All origins (POL)" options={filterOptions.origins} />
        <Select value={filters.mode} onChange={(v) => set({ mode: v })} allLabel="All shipment types" options={filterOptions.modes} />

        <div className="db-date-range">
          <input type="date" value={filters.dateFrom} onChange={(e) => set({ dateFrom: e.target.value })} title="From (created date)" />
          <span>–</span>
          <input type="date" value={filters.dateTo} onChange={(e) => set({ dateTo: e.target.value })} title="To (created date)" />
        </div>

        {(filters.search || filters.status !== "ALL" || filters.customer !== "ALL" || filters.supplier !== "ALL" || filters.origin !== "ALL" || filters.mode !== "ALL" || filters.dateFrom || filters.dateTo) && (
          <button
            className="db-clear-filters"
            onClick={() => set({ search: "", status: "ALL", customer: "ALL", supplier: "ALL", origin: "ALL", mode: "ALL", dateFrom: "", dateTo: "" })}
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
