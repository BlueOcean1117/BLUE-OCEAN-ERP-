// frontend/src/wizard/steps/SmartPartSuggestPopup.js
//
// NEW FILE — "Smart Recent Part Number Suggestions" popup.
// Purely presentational: given a list of results + the active (highlighted)
// index, renders a VS-Code-autocomplete-style card list. All state
// (open/closed, active index, keyboard handling) lives in the parent
// (Step1.js) so this component has no side effects of its own.

import React from "react";

const STYLE = `
  .smart-suggest-pop {
    position: absolute;
    left: 0;
    right: 0;
    z-index: 99;
    background: #ffffff;
    border: 1px solid #E2E8F0;
    border-radius: 10px;
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
    max-height: 300px;
    overflow-y: auto;
    padding: 6px;
  }
  .smart-suggest-hdr {
    font-size: 9.5px;
    font-weight: 700;
    color: #94A3B8;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 4px 8px 6px;
  }
  .smart-suggest-item {
    padding: 7px 9px;
    border-radius: 7px;
    cursor: pointer;
    margin-bottom: 2px;
  }
  .smart-suggest-item:hover,
  .smart-suggest-item.active {
    background: #EFF6FF;
  }
  .smart-suggest-partno {
    font-size: 12.5px;
    font-weight: 700;
    color: #1E293B;
  }
  .smart-suggest-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 2px 12px;
    margin-top: 4px;
  }
  .smart-suggest-field {
    font-size: 10.5px;
    color: #64748B;
    line-height: 1.4;
  }
  .smart-suggest-field b {
    color: #334155;
    font-weight: 600;
  }
  .smart-suggest-divider {
    height: 1px;
    background: #F1F5F9;
    margin: 4px 2px;
  }
`;

function Field({ label, value }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="smart-suggest-field">
      <b>{label}:</b> {value}
    </div>
  );
}

export default function SmartPartSuggestPopup({
  results,
  activeIndex,
  onHover,
  onSelect,
  top,
}) {
  if (!results || results.length === 0) return null;

  return (
    <div className="smart-suggest-pop" style={{ top }}>
      <style>{STYLE}</style>
      <div className="smart-suggest-hdr">Recent Shipment History</div>
      {results.map((r, i) => (
        <React.Fragment key={r.part_no}>
          <div
            className={`smart-suggest-item${i === activeIndex ? " active" : ""}`}
            onMouseEnter={() => onHover(i)}
            onMouseDown={(e) => {
              e.preventDefault(); // keep input focus, avoid blur-before-click race
              onSelect(r);
            }}
          >
            <div className="smart-suggest-partno">{r.part_no}</div>
            <div className="smart-suggest-grid">
              <Field label="Description" value={r.part_desc} />
              <Field label="Qty" value={r.part_qty} />
              <Field label="Box Size" value={r.part_box_size} />
              <Field label="Net Weight" value={r.part_net_unit} />
              <Field label="Gross Weight" value={r.part_gross} />
              <Field label="No. of Boxes" value={r.part_no_of_boxes} />
              <Field label="Last Shipment" value={r.last_shipment} />
              <Field label="Supplier" value={r.supplier_name} />
              <Field label="Invoice" value={r.invoice_no} />
            </div>
          </div>
          {i < results.length - 1 && <div className="smart-suggest-divider" />}
        </React.Fragment>
      ))}
    </div>
  );
}
