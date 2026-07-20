import React, { useCallback } from "react";
import * as XLSX from "xlsx";
import "./Dashboard.css";

import useDashboardData from "./dashboard/useDashboardData";
import FilterBar from "./dashboard/FilterBar";
import KpiCards from "./dashboard/KpiCards";
import DetailCards from "./dashboard/DetailCards";
import AlertsPanel from "./dashboard/AlertsPanel";
import { ShipmentTable, UntrackedTable } from "./dashboard/ShipmentTables";
import {
  StatusDonutChart,
  MonthlyBarChart,
  DeliveryTrendLineChart,
  HorizontalBarChart,
  StatusProgressBars,
} from "./dashboard/DashboardCharts";
import PartNumberAnalytics from "./dashboard/PartNumberAnalytics";
import EtdShipmentSearch from "./dashboard/EtdShipmentSearch";

function ChartCard({ title, subtitle, children, height = 240 }) {
  return (
    <div className="chart-card">
      <div className="chart-card-hdr">
        <h4>{title}</h4>
        {subtitle && <span className="chart-card-sub">{subtitle}</span>}
      </div>
      <div className="chart-card-body" style={{ height }}>
        {children}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const {
    loading,
    error,
    lastFetched,
    refresh,
    filters,
    setFilters,
    filterOptions,
    filteredCount,
    totalCount,
    kpis,
    charts,
    detailCards,
    tables,
    alerts,
    filteredShipments,
  } = useDashboardData();

  const handleExport = useCallback(() => {
    const rows = filteredShipments.map((s) => ({
      "Shipment No": s.ref || "N/A",
      "Customer": s.customer || "N/A",
      "Supplier": s.supplier || "N/A",
      "BL No": s.blNo || "N/A",
      "Invoice No": s.invoiceNo || "N/A",
      "PO No": "N/A",
      "Part No(s)": s.partNos.join(", ") || "N/A",
      "Origin (POL)": s.origin || "N/A",
      "ETD": s.etd ? new Date(s.etd).toLocaleDateString() : "N/A",
      "Delivery Date": s.deliveryDate ? new Date(s.deliveryDate).toLocaleDateString() : "N/A",
      "Status": s.status,
      "Payment Status": "No data available",
      "Total Shipment Value": "No data available",
    }));
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ "No data": "No shipments match the current filters" }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Logistics Dashboard");
    XLSX.writeFile(wb, `logistics-dashboard-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }, [filteredShipments]);

  return (
    <div className="ldash">
      <FilterBar
        filters={filters}
        setFilters={setFilters}
        filterOptions={filterOptions}
        onRefresh={refresh}
        onExport={handleExport}
        loading={loading}
        lastFetched={lastFetched}
      />

      {error && (
        <div className="ldash-error">
          {error} <button onClick={refresh}>Retry</button>
        </div>
      )}

      {loading && !error ? (
        <div className="ldash-loading">Loading live shipment data…</div>
      ) : (
        <>
          {filteredCount !== totalCount && (
            <div className="ldash-filter-note">
              Showing <strong>{filteredCount}</strong> of {totalCount} shipments based on current filters.
            </div>
          )}

          {/* 2 — KPI summary */}
          <KpiCards kpis={kpis} />

          {/* 3 — Visual analytics */}
          <div className="section-hdr">Analytics</div>
          <div className="charts-grid">
            <ChartCard title="Shipment Status Distribution" subtitle="Current snapshot">
              <StatusDonutChart data={charts.statusDistribution} />
            </ChartCard>
            <ChartCard title="Monthly Shipment Count" subtitle="By date created">
              <MonthlyBarChart data={charts.monthlyShipments} />
            </ChartCard>
            <ChartCard title="Delivery Trend" subtitle="Delivered shipments over time">
              <DeliveryTrendLineChart data={charts.deliveryTrend} />
            </ChartCard>
            <ChartCard title="Status-wise Completion" subtitle="Share of total shipments">
              <StatusProgressBars distribution={charts.statusDistribution} />
            </ChartCard>
            <ChartCard title="Delay Analysis" subtitle="Delayed shipments by supplier">
              <HorizontalBarChart data={charts.delayBySupplier} color="#DC2626" emptyMessage="No delayed shipments — nothing to analyze" />
            </ChartCard>
            <ChartCard title="Top Customers" subtitle="By shipment count">
              <HorizontalBarChart data={charts.topCustomers} color="#7C3AED" />
            </ChartCard>
          </div>

          {/* 4 — Operational insights */}
          <div className="section-hdr">Operational Insights</div>
          <div className="tables-grid">
            <ShipmentTable title="Recent Shipments" rows={tables.recent} emptyMessage="No shipments recorded yet" accentColor="#2563EB" />
            <ShipmentTable title="Pending Shipments" rows={tables.pending} emptyMessage="No pending shipments" accentColor="#92400E" />
            <ShipmentTable title="Delayed Shipments" rows={tables.delayed} emptyMessage="No delayed shipments" accentColor="#991B1B" />
            <UntrackedTable title="Payment Pending Shipments" note="Payment status isn't captured in the Shipment module yet" />
          </div>

          {/* 5 — Detail cards */}
          <div className="section-hdr">Breakdowns</div>
          <DetailCards detailCards={detailCards} />

          {/* 6 — Alerts / exceptions */}
          <div className="section-hdr">Alerts &amp; Exceptions</div>
          <AlertsPanel alerts={alerts} />

          {/* 7 — NEW: Part Number Analytics (Feature 1) */}
          <PartNumberAnalytics />

          {/* 8 — NEW: Shipment Search by ETD Date (Feature 2) */}
          <EtdShipmentSearch />
        </>
      )}
    </div>
  );
}
