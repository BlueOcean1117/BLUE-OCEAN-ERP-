// frontend/src/wizard/steps/Step4.js
import React from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";

const S = `
  .erp-step4 * { box-sizing: border-box; }
  .erp-step4 .card { background: white; border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px 14px; margin-bottom: 8px; }
  .erp-step4 .card-hdr { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid #F1F5F9; }
  .erp-step4 .card-title { font-size: 11px; font-weight: 700; color: #1E293B; text-transform: uppercase; letter-spacing: 0.4px; display: flex; align-items: center; gap: 6px; }
  .erp-step4 .badge { background: #EFF6FF; color: #2563EB; font-size: 9px; font-weight: 700; padding: 1px 6px; border-radius: 8px; }
  .erp-step4 .info-banner { background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 6px; padding: 8px 12px; margin-bottom: 8px; font-size: 11px; color: #1E40AF; font-weight: 500; }
  .erp-step4 .review-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; }
  .erp-step4 .review-cell { padding: 8px 10px; background: #F8FAFC; border-radius: 6px; border: 1px solid #E2E8F0; }
  .erp-step4 .review-cell-lbl { font-size: 10px; color: #94A3B8; margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.4px; }
  .erp-step4 .review-cell-val { font-size: 13px; font-weight: 600; color: #1E293B; word-break: break-all; }
  .erp-step4 .divider { height: 1px; background: #F1F5F9; margin: 8px 0; }
  .erp-step4 .totals { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 8px; }
  .erp-step4 .tot-cell { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 8px 12px; }
  .erp-step4 .tot-lbl { font-size: 10px; font-weight: 600; color: #64748B; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 2px; }
  .erp-step4 .tot-val { font-size: 16px; font-weight: 700; color: #0F172A; }
  .erp-step4 .tot-unit { font-size: 10px; color: #94A3B8; }
  .erp-step4 .parts-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 6px; }
  .erp-step4 .parts-table th { background: #1E293B; color: white; padding: 7px 10px; text-align: left; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }
  .erp-step4 .parts-table td { padding: 7px 10px; border-bottom: 1px solid #F1F5F9; color: #374151; }
  .erp-step4 .parts-table tr:last-child td { border-bottom: none; }
  .erp-step4 .parts-table tr:nth-child(even) td { background: #F8FAFC; }
  .erp-step4 .step-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 4px; margin-bottom: 8px; }
  .erp-step4 .btn-back { height: 34px; padding: 0 14px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; background: white; color: #374151; border: 1px solid #D1D5DB; }
  .erp-step4 .btn-back:hover { background: #F9FAFB; }
  .erp-step4 .action-btns { display: flex; gap: 8px; }
  .erp-step4 .btn { height: 34px; padding: 0 14px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; border: none; display: inline-flex; align-items: center; gap: 5px; }
  .erp-step4 .btn-outline { background: white; color: #374151; border: 1px solid #D1D5DB; }
  .erp-step4 .btn-outline:hover { background: #F9FAFB; }
  .erp-step4 .btn-save { background: #059669; color: white; }
  .erp-step4 .btn-save:hover { background: #047857; }
  @media (max-width: 700px) {
    .erp-step4 .review-grid, .erp-step4 .totals { grid-template-columns: 1fr !important; }
    .erp-step4 .step-footer { flex-direction: column; gap: 8px; align-items: stretch; }
    .erp-step4 .action-btns { flex-wrap: wrap; }
  }
`;

function toExportRows(data) {
  return Object.entries(data || {}).map(([key, value]) => ({
    Field: key,
    Value:
      value && typeof value === "object"
        ? JSON.stringify(value)
        : String(value ?? ""),
  }));
}

// Helper to safely display a value in the review grid
function displayVal(val) {
  if (val === null || val === undefined || val === "") return "—";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

export default function Step4({ data = {}, onPrev, onSave }) {
  async function handleSave() {
    if (onSave) await onSave();
  }

  function exportExcel() {
    const rows = toExportRows(data);
    const sheet = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Shipment Review");
    XLSX.writeFile(wb, `shipment-review-${data.enquiry_no || "draft"}.xlsx`);
  }

  function exportPDF() {
    const doc = new jsPDF("p", "pt", "a4");
    const rows = toExportRows(data).map((row) => [row.Field, row.Value]);

    doc.setFontSize(14);
    doc.text("Shipment Review", 40, 40);

    doc.autoTable({
      startY: 56,
      head: [["Field", "Value"]],
      body: rows,
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [30, 41, 59] },
      margin: { left: 40, right: 40 },
    });

    doc.save(`shipment-review-${data.enquiry_no || "draft"}.pdf`);
  }

  // Summary fields to show in the review grid
  const summaryFields = [
    ["Enquiry No", data.enquiry_no],
    ["Invoice No", data.invoice_no],
    ["Invoice Date", data.invoice_date],
    ["Mode", data.mode],
    ["Incoterm", data.incoterm],
    ["FF", data.ff],
    ["ETD", data.etd],
    ["Final Delivery", data.final_delivery_date],
    ["BL No", data.bl_no],
    ["Container No", data.container_no],
    ["POL", data.pol],
    ["Customer", data.customer],
    ["Supplier", data.supplier_name],
    ["SB No", data.sb_no],
    ["SB Date", data.sb_date],
    ["Total Parts", data.parts ? `${data.parts.length} part(s)` : "—"],
  ];

  const parts = Array.isArray(data.parts) ? data.parts : [];

  return (
    <div className="erp-step4">
      <style>{S}</style>

      {/* ── REVIEW CARD ── */}
      <div className="card">
        <div className="card-hdr">
          <div className="card-title">Review &amp; Save <span className="badge">STEP 3</span></div>
        </div>

        <div className="info-banner">
          ✅ Review the details below and click Save Shipment to finalize.
        </div>

        {/* Summary grid */}
        <div className="review-grid">
          {summaryFields.map(([label, val]) => (
            <div className="review-cell" key={label}>
              <div className="review-cell-lbl">{label}</div>
              <div className="review-cell-val">{displayVal(val)}</div>
            </div>
          ))}
        </div>

        <div className="divider" />

        {/* Totals */}
        <div className="totals">
          <div className="tot-cell">
            <div className="tot-lbl">Total Net Weight (Kg)</div>
            <div className="tot-val">{Number(data.total_net_wt || 0).toFixed(2)}</div>
            <div className="tot-unit">Kilograms</div>
          </div>
          <div className="tot-cell">
            <div className="tot-lbl">Total Gross Weight (Kg)</div>
            <div className="tot-val">{Number(data.total_gross_wt || 0).toFixed(2)}</div>
            <div className="tot-unit">Kilograms</div>
          </div>
          <div className="tot-cell">
            <div className="tot-lbl">Total No. of Boxes</div>
            <div className="tot-val">{data.total_no_of_boxes || 0}</div>
            <div className="tot-unit">Cartons</div>
          </div>
        </div>
      </div>

      {/* ── PARTS TABLE ── */}
      {parts.length > 0 && (
        <div className="card">
          <div className="card-hdr">
            <div className="card-title">Part Details</div>
            <span style={{ fontSize: 10, color: "#94A3B8" }}>{parts.length} part(s)</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="parts-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Part No</th>
                  <th>Description</th>
                  <th>Box Size</th>
                  <th>Boxes</th>
                  <th>Qty</th>
                  <th>Net Wt/Unit</th>
                  <th>Total Net Wt</th>
                  <th>Gross Wt</th>
                </tr>
              </thead>
              <tbody>
                {parts.map((p, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{p.part_no || "—"}</td>
                    <td>{p.part_desc || "—"}</td>
                    <td>{p.part_box_size || "—"}</td>
                    <td>{p.part_no_of_boxes ?? "—"}</td>
                    <td>{p.part_qty ?? "—"}</td>
                    <td>{p.part_net_unit ?? "—"}</td>
                    <td>{p.part_total_net_wt ?? "—"}</td>
                    <td>{p.part_gross ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── FOOTER ACTIONS ── */}
      <div className="step-footer">
        <button className="btn-back" type="button" onClick={onPrev}>
          ← Back
        </button>
        <div className="action-btns">
          <button className="btn btn-outline" type="button" onClick={exportExcel}>
            ⬇ Export Excel
          </button>
          <button className="btn btn-outline" type="button" onClick={exportPDF}>
            ⬇ Export PDF
          </button>
          <button className="btn btn-save" type="button" onClick={handleSave}>
            ✓ Save Shipment
          </button>
        </div>
      </div>
    </div>
  );
}
