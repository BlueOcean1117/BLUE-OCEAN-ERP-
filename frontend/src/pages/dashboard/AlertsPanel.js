// frontend/src/pages/dashboard/AlertsPanel.js
import React from "react";

function AlertItem({ tone, count, tracked, title, subtitle }) {
  return (
    <div className={`alert-item alert-${tone}${tracked ? "" : " alert-untracked"}`}>
      <div className="alert-count">{tracked ? count : "—"}</div>
      <div className="alert-body">
        <div className="alert-title">{title}</div>
        <div className="alert-subtitle">{tracked ? subtitle : "No data available — not yet captured in the Shipment module"}</div>
      </div>
    </div>
  );
}

export default function AlertsPanel({ alerts }) {
  return (
    <div className="alerts-grid">
      <AlertItem tone="red" tracked={alerts.delayed.tracked} count={alerts.delayed.count} title="Delayed Shipments" subtitle="Flagged with Delayed status" />
      <AlertItem tone="amber" tracked={alerts.missingDocs.tracked} count={alerts.missingDocs.count} title="Missing BL or Invoice" subtitle="Shipments missing BL No. and/or Invoice No." />
      <AlertItem tone="amber" tracked={alerts.missingEtd.tracked} count={alerts.missingEtd.count} title="Missing ETD" subtitle="Shipments with no ETD set" />
      <AlertItem tone="gray" tracked={alerts.pendingApprovals.tracked} title="Pending Approvals" />
      <AlertItem tone="gray" tracked={alerts.unpaid.tracked} title="Unpaid Shipments" />
      <AlertItem tone="gray" tracked={alerts.overdue.tracked} title="Overdue Deliveries" />
    </div>
  );
}
