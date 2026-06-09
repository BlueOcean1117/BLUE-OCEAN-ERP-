// frontend/src/wizard/steps/Step4.js
import React from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";

function toExportRows(data) {
  return Object.entries(data || {}).map(([key, value]) => ({
    Field: key,
    Value:
      value && typeof value === "object"
        ? JSON.stringify(value)
        : String(value ?? ""),
  }));
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

  return (
    <div>
      <h3>Step 3 — Review & Save</h3>

      <div className="card">
        <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(data, null, 2)}</pre>
      </div>

      <div style={{ marginTop: 12 }} className="grid-2">
        <button className="btn" onClick={onPrev}>Back</button>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={exportExcel}>Export Excel</button>
          <button className="btn" onClick={exportPDF}>Export PDF</button>
          <button className="btn primary" onClick={handleSave}>Save Shipment</button>
        </div>
      </div>
    </div>
  );
}
