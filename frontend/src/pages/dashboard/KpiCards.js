// frontend/src/pages/dashboard/KpiCards.js
import React from "react";

const ICONS = {
  box: <path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8" />,
  transit: <path d="M3 16h13l4-6h-4l-2-4H8L6 10H3v6zM7.5 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM16.5 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />,
  check: <path d="M20 6L9 17l-5-5" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>,
  wallet: <><path d="M20 12V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h13a2 2 0 002-2v-5h-6a2 2 0 010-4h6z" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="0.8" fill="currentColor" /></>,
  gauge: <><path d="M12 21a9 9 0 100-18 9 9 0 000 18z" /><path d="M12 12l4-4M8 12h8" /></>,
  cash: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="3" /></>,
};

function Icon({ name, color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </svg>
  );
}

function KpiCard({ icon, iconColor, iconBg, label, value, sub, unavailable }) {
  return (
    <div className="kpi-card">
      <div className="kpi-icon" style={{ background: iconBg }}>
        <Icon name={icon} color={iconColor} />
      </div>
      <div className="kpi-body">
        <div className={`kpi-value${unavailable ? " kpi-value-muted" : ""}`}>
          {unavailable ? "No data" : value}
        </div>
        <div className="kpi-label">{label}</div>
        {sub && <div className="kpi-sub">{sub}</div>}
      </div>
    </div>
  );
}

export default function KpiCards({ kpis }) {
  return (
    <div className="kpi-grid">
      <KpiCard icon="box" iconColor="#2563EB" iconBg="#EFF6FF" label="Total Shipments" value={kpis.total} sub={`${kpis.total} record${kpis.total === 1 ? "" : "s"} in view`} />
      <KpiCard icon="transit" iconColor="#1E40AF" iconBg="#DBEAFE" label="In Transit" value={kpis.inTransit} />
      <KpiCard icon="check" iconColor="#065F46" iconBg="#D1FAE5" label="Delivered" value={kpis.delivered} />
      <KpiCard icon="clock" iconColor="#92400E" iconBg="#FEF9C3" label="Pending / Delayed" value={kpis.pendingOrDelayed} sub={`${kpis.pendingCount} pending · ${kpis.delayedCount} delayed`} />
      <KpiCard icon="wallet" iconColor="#94A3B8" iconBg="#F1F5F9" label="Unpaid / Payment Pending" unavailable sub="Payment status isn't captured in the Shipment module yet" />
      <KpiCard icon="target" iconColor="#0F766E" iconBg="#CCFBF1" label="On-Time Delivery %" value={kpis.onTimePct !== null ? `${kpis.onTimePct}%` : null} unavailable={kpis.onTimePct === null} sub={kpis.onTimePct !== null ? "Delivered ÷ (Delivered + Delayed)" : "No delivered or delayed shipments yet"} />
      <KpiCard icon="gauge" iconColor="#6D28D9" iconBg="#EDE9FE" label="Avg Transit Time" value={kpis.avgTransitDays !== null ? `${kpis.avgTransitDays} days` : null} unavailable={kpis.avgTransitDays === null} sub={kpis.avgTransitDays !== null ? "ETD → Delivery date, averaged" : "No shipment has both ETD and delivery date"} />
      <KpiCard icon="cash" iconColor="#94A3B8" iconBg="#F1F5F9" label="Total Shipment Value" unavailable sub="Shipment value isn't captured in the Shipment module yet" />
    </div>
  );
}
