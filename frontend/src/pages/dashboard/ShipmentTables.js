// frontend/src/pages/dashboard/ShipmentTables.js
import React from "react";
import { useNavigate } from "react-router-dom";
import { STATUS_META } from "./useDashboardData";

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function partsLabel(partNos) {
  if (!partNos || partNos.length === 0) return "—";
  if (partNos.length === 1) return partNos[0];
  return `${partNos[0]} +${partNos.length - 1}`;
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.IN_PROCESS;
  return (
    <span className="status-pill" style={{ background: meta.bg, color: meta.color, borderColor: meta.border }}>
      {meta.label}
    </span>
  );
}

export function ShipmentTable({ title, rows, emptyMessage, accentColor }) {
  const navigate = useNavigate();
  return (
    <div className="op-table-card">
      <div className="op-table-hdr">
        <h4>{title}</h4>
        <span className="op-table-count" style={{ color: accentColor }}>{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <div className="op-table-empty">{emptyMessage}</div>
      ) : (
        <div className="op-table-scroll">
          <table className="op-table">
            <thead>
              <tr>
                <th>Shipment No</th>
                <th>Customer</th>
                <th>BL No</th>
                <th>PO No</th>
                <th>Part No</th>
                <th>Status</th>
                <th>ETA</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td className="op-table-ref">{s.ref || "—"}</td>
                  <td>{s.customer || "—"}</td>
                  <td>{s.blNo || "—"}</td>
                  <td className="op-table-muted">{s.poNo ?? "—"}</td>
                  <td>{partsLabel(s.partNos)}</td>
                  <td><StatusBadge status={s.status} /></td>
                  <td>{fmtDate(s.deliveryDate || s.etd)}</td>
                  <td>
                    <button className="op-table-action" onClick={() => navigate(`/logistics/${s.id}`)}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function UntrackedTable({ title, note }) {
  return (
    <div className="op-table-card">
      <div className="op-table-hdr">
        <h4>{title}</h4>
        <span className="op-table-count op-table-count-muted">—</span>
      </div>
      <div className="op-table-empty op-table-empty-untracked">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
          <circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" strokeLinecap="round" />
        </svg>
        <span>{note}</span>
      </div>
    </div>
  );
}
