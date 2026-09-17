// frontend/src/wizard/steps/Step1.js
// ⚠️  Place this file at: src/wizard/steps/Step1.js
import React, { useState, useEffect, useRef, useCallback } from "react";
import API from "../../services/api"; // resolves to src/services/api
// NEW — Smart Part Number Auto-Suggestion (sourced from Shipment History,
// separate from the existing part_master autocomplete below). See:
//   ./useShipmentPartHistory.js   — builds the suggestion index
//   ./SmartPartSuggestPopup.js    — renders the popup UI
import useShipmentPartHistory from "./useShipmentPartHistory";
import SmartPartSuggestPopup from "./SmartPartSuggestPopup";

// ✅ Inline sanitizer (see ShipmentsList.js for full comments)
function sanitizeSearchInput(value) {
  if (value === undefined || value === null) return "";
  let str = String(value);
  str = str.replace(/[\u200B\u200C\u200D\u2060\uFEFF\u180E]/g, "");
  str = str.replace(/[\u0009-\u000D\u0020\u0085\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/g, " ");
  return str.replace(/\s+/g, " ").trim();
}
const INCOTERMS = ["DAP", "EXW", "CIF", "CIP", "CFR", "CPT", "DAT", "DDP", "FAS", "FCA", "FOB"];

function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const S = `
  /* Scoped box-sizing — no wildcard * that leaks outside .erp-step1 */
  .erp-step1, .erp-step1 div, .erp-step1 span, .erp-step1 input,
  .erp-step1 select, .erp-step1 textarea, .erp-step1 button,
  .erp-step1 label, .erp-step1 ul, .erp-step1 li { box-sizing: border-box; }

  /* ══════════════════════════════════════════════════════════════════
     COMPACT LAYOUT PASS (CSS-only)
     - Rows switch from fixed-column CSS grid to a wrapping flex row so
       short fields (dates, Incoterm, Mode, box/qty/weight numbers) can
       sit several-to-a-row, while long fields (Customer, Supplier,
       Part Description, Remarks/Email) keep a wider share of the row.
     - No JSX, class names, field names, handlers or markup were changed —
       these rules key off the existing structure via :has() so every
       existing element still works exactly as before.
     ══════════════════════════════════════════════════════════════════ */

  .erp-step1 .card { background: white; border: 1px solid #E2E8F0; border-radius: 7px; padding: 6px 10px; margin-bottom: 5px; }

  /* Part Details + Customer & Shipping Details side by side on desktop.
     align-items: stretch makes both .card boxes match the height of
     whichever is taller (Part Details grows as parts are added), so
     the two columns always line up visually instead of leaving a gap
     next to the shorter one. */
  .erp-step1 .two-col-row {
    display: flex;
    align-items: stretch;
    gap: 8px;
    margin-bottom: 5px;
  }
  .erp-step1 .two-col-row > .card { margin-bottom: 0; min-width: 0; display: flex; flex-direction: column; }
  .erp-step1 .two-col-row__part { flex: 1.4 1 0; }
  .erp-step1 .two-col-row__customer { flex: 1 1 0; }
  .erp-step1 .two-col-row__tracking { flex: 1.5 1 0; }
  .erp-step1 .two-col-row__email { flex: 1 1 0; }
  .erp-step1 .card-hdr { display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px; padding-bottom: 3px; border-bottom: 1px solid #F1F5F9; }
  .erp-step1 .card-title { font-size: 10.5px; font-weight: 700; color: #1E293B; text-transform: uppercase; letter-spacing: 0.3px; display: flex; align-items: center; gap: 5px; }
  .erp-step1 .badge { background: #EFF6FF; color: #2563EB; font-size: 9px; font-weight: 700; padding: 1px 6px; border-radius: 8px; }

  /* Row containers — was CSS grid with fixed 2/3 equal columns, now a
     wrapping flex row. Each .f decides its own width below, so short
     fields bunch together and long fields stretch, instead of every
     field in a row being forced to the same width. */
  .erp-step1 .g2,
  .erp-step1 .g3,
  .erp-step1 .g3-last,
  .erp-step1 .g2-last,
  .erp-step1 .g-email,
  .erp-step1 .totals {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 5px 7px;
    margin-bottom: 5px;
  }
  .erp-step1 .g3-last,
  .erp-step1 .g2-last { margin-bottom: 0; }
  .erp-step1 .g-full { margin-bottom: 5px; }

  /* Default field width — used by longer-value fields (Customer,
     Supplier, Part Description, FF, Invoice No, SB No, BL No,
     Container No, POL) unless narrowed by a rule below. */
  .erp-step1 .f {
    display: flex;
    flex-direction: column;
    gap: 1px;
    flex: 1 1 170px;
    min-width: 130px;
  }
  .erp-step1 .f label { font-size: 9.5px; font-weight: 600; color: #475569; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.3; }
  .erp-step1 .f label em { color: #EF4444; font-style: normal; }
  .erp-step1 .f input, .erp-step1 .f select, .erp-step1 .f textarea {
    height: 25px; border: 1px solid #CBD5E1; border-radius: 5px;
    padding: 0 7px; font-size: 11px; color: #1E293B; background: white;
    outline: none; width: 100%; transition: border-color 0.12s, box-shadow 0.12s;
  }
  .erp-step1 .f select { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%2364748B' d='M0 0l5 6 5-6z'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 7px center; padding-right: 20px; }
  .erp-step1 .f input:focus, .erp-step1 .f select:focus, .erp-step1 .f textarea:focus { border-color: #2563EB; box-shadow: 0 0 0 2px rgba(37,99,235,0.1); }
  .erp-step1 .f input.ro { background: #F8FAFC; color: #64748B; cursor: default; }
  .erp-step1 .f input.ro:focus { border-color: #CBD5E1; box-shadow: none; }
  .erp-step1 .f input.calc { background: #EFF6FF; border-color: #BFDBFE; color: #1D4ED8; font-weight: 600; cursor: default; }
  .erp-step1 .f input.calc:focus { border-color: #BFDBFE; box-shadow: none; }
  .erp-step1 .f textarea { height: 36px; padding: 4px 7px; resize: none; font-size: 11px; }
  .erp-step1 .f input::placeholder, .erp-step1 .f textarea::placeholder { color: #9CA3AF; font-size: 9.5px; }

  /* ── Short-value fields → compact, fixed-ish width so several fit per row ── */
  /* Date pickers only need room for dd/mm/yyyy — not a full-width column */
  .erp-step1 .f:has(input[type="date"]) { flex: 0 1 118px; min-width: 104px; }

  /* Incoterm / Mode dropdowns — short option text */
  .erp-step1 .f:has(select[name="incoterm"]),
  .erp-step1 .f:has(select[name="mode"]) { flex: 0 1 100px; min-width: 88px; }

  /* Part-row short numeric/text fields: Box Size, No. of Boxes, Quantity,
     Net Wt/Unit, Total Net Wt (calc), Gross Wt */
  .erp-step1 .f:has(input[name="part_box_size"]),
  .erp-step1 .f:has(input[name="part_no_of_boxes"]),
  .erp-step1 .f:has(input[name="part_qty"]),
  .erp-step1 .f:has(input[name="part_net_unit"]),
  .erp-step1 .f:has(input[name="part_total_net_wt"]),
  .erp-step1 .f:has(input[name="part_gross"]) { flex: 0 1 100px; min-width: 88px; }

  /* Recipient email keeps room to read the address; Send button stays auto-width */
  .erp-step1 .f:has(input[type="email"]) { flex: 1 1 220px; }

  /* Long-value fields explicitly get more room so they don't get
     squeezed just because they sit next to compact fields in the row */
  .erp-step1 .f:has(input[name="customer"]),
  .erp-step1 .f:has(input[name="supplier_name"]),
  .erp-step1 .f:has(select[name="supplier_name"]),
  .erp-step1 .f:has(input[name="part_desc"]),
  .erp-step1 .f:has(input[name="pol"]),
  .erp-step1 .f:has(textarea) { flex: 1 1 200px; min-width: 160px; }
  .erp-step1 .f:has(textarea) { width: 100%; flex-basis: 100%; }

  .erp-step1 .part-card { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 5px; padding: 5px 8px; margin-bottom: 5px; }
  .erp-step1 .part-hdr { display: flex; align-items: center; justify-content: space-between; margin-bottom: 3px; }
  .erp-step1 .part-lbl { font-size: 9.5px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.4px; }
  .erp-step1 .btn-rm { background: none; border: none; color: #94A3B8; font-size: 13px; cursor: pointer; padding: 1px 4px; border-radius: 3px; }
  .erp-step1 .btn-rm:hover { background: #FEE2E2; color: #EF4444; }

  /* Totals summary — keep as an even 3-up row of stat cards */
  .erp-step1 .totals { gap: 6px; }
  .erp-step1 .tot-cell { flex: 1 1 140px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 5px; padding: 5px 9px; }
  .erp-step1 .tot-lbl { font-size: 9px; font-weight: 600; color: #64748B; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 1px; }
  .erp-step1 .tot-val { font-size: 13px; font-weight: 700; color: #0F172A; }
  .erp-step1 .tot-unit { font-size: 9px; color: #94A3B8; }

  .erp-step1 .btn-add { background: #EFF6FF; color: #2563EB; border: 1px solid #BFDBFE; height: 21px; padding: 0 8px; border-radius: 5px; font-size: 10px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 3px; }
  .erp-step1 .btn-add:hover { background: #DBEAFE; }
  .erp-step1 .btn-next { height: 27px; padding: 0 14px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; border: none; background: #2563EB; color: white; display: inline-flex; align-items: center; gap: 5px; }
  .erp-step1 .btn-next:hover { background: #1D4ED8; }
  .erp-step1 .btn-send { background: #059669; color: white; border: none; height: 25px; padding: 0 11px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; white-space: nowrap; flex: 0 0 auto; align-self: flex-end; }
  .erp-step1 .btn-send:hover { background: #047857; }
  .erp-step1 .file-row { border: 1px dashed #CBD5E1; border-radius: 5px; padding: 4px 8px; display: flex; align-items: center; gap: 5px; font-size: 10.5px; color: #64748B; background: #FAFAFA; margin-bottom: 5px; cursor: pointer; }
  .erp-step1 .img-row { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 4px; margin-bottom: 5px; }
  .erp-step1 .img-thumb { width: 52px; height: 38px; object-fit: cover; border-radius: 5px; border: 1px solid #E2E8F0; }
  .erp-step1 .ac-dropdown { position: absolute; top: 100%; left: 0; right: 0; z-index: 100; background: #fff; border: 1px solid #CBD5E1; border-radius: 6px; max-height: 200px; overflow-y: auto; margin: 0; padding: 0; list-style: none; box-shadow: 0 4px 12px rgba(0,0,0,0.12); }
  .erp-step1 .ac-item { padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #F1F5F9; font-size: 12px; }
  .erp-step1 .ac-item:hover { background: #F5F5F5; }
  .erp-step1 .autofill-tag { font-size: 10px; color: #10B981; margin-left: 5px; }
  .erp-step1 .multi-sup-tag { font-size: 10px; color: #F59E0B; }

  /* Fallback for browsers without :has() support (older WebViews):
     rows still wrap sensibly via the default flex-basis on .f above,
     just without the extra narrowing of short fields. Layout still
     works, it's simply slightly less compact. */

  @media (max-width: 900px) {
    .erp-step1 .two-col-row { flex-direction: column; }
    .erp-step1 .two-col-row__part,
    .erp-step1 .two-col-row__customer,
    .erp-step1 .two-col-row__tracking,
    .erp-step1 .two-col-row__email { flex: 1 1 100%; }
  }

  @media (max-width: 700px) {
    .erp-step1 .g2, .erp-step1 .g3, .erp-step1 .g3-last,
    .erp-step1 .g2-last, .erp-step1 .totals, .erp-step1 .g-email {
      flex-direction: column;
    }
    .erp-step1 .f,
    .erp-step1 .f:has(input[type="date"]),
    .erp-step1 .f:has(select[name="incoterm"]),
    .erp-step1 .f:has(select[name="mode"]),
    .erp-step1 .f:has(input[name="part_box_size"]),
    .erp-step1 .f:has(input[name="part_no_of_boxes"]),
    .erp-step1 .f:has(input[name="part_qty"]),
    .erp-step1 .f:has(input[name="part_net_unit"]),
    .erp-step1 .f:has(input[name="part_total_net_wt"]),
    .erp-step1 .f:has(input[name="part_gross"]),
    .erp-step1 .f:has(input[type="email"]),
    .erp-step1 .tot-cell {
      flex: 1 1 100% !important;
      width: 100%;
      min-width: 0;
    }
    .erp-step1 .btn-send { align-self: stretch; }
  }
`;

export default function Step1({ initial = {}, onNext, onUpdate = () => {} }) {

  // ── Field-name normalizer ─────────────────────────────────────────────────
  // The database may store parts with slightly different key names than what
  // the form uses. This maps every known alias → the canonical form key so
  // ALL fields prefill correctly regardless of backend naming convention.
  // Converts ISO date strings ("2026-06-14T00:00:00.000Z") to "YYYY-MM-DD"
  // so <input type="date"> renders correctly. Returns "" for null/undefined.
  function toDateInput(val) {
    if (!val) return "";
    if (typeof val === "string" && val.includes("T")) return val.split("T")[0];
    if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
    return "";
  }

  function normalizePart(p) {
    if (!p) return p;
    return {
      // canonical key            // accept any of these aliases from DB
      part_no:          p.part_no          ?? p.partNo          ?? p.part_number  ?? p.partNumber  ?? "",
      part_desc:        p.part_desc        ?? p.partDesc        ?? p.part_description ?? p.description ?? "",
      part_qty:         p.part_qty         ?? p.partQty         ?? p.qty          ?? p.quantity     ?? 0,
      part_net_unit:    p.part_net_unit    ?? p.net_wt_per_unit ?? p.partNetUnit  ?? p.net_wt_unit  ?? p.netWt ?? p.net_weight_unit ?? p.net_wt ?? 0,
      part_gross:       p.part_gross       ?? p.partGross       ?? p.gross_wt     ?? p.grossWt      ?? p.gross_weight ?? 0,
      part_total_net_wt:p.part_total_net_wt?? p.partTotalNetWt ?? p.total_net_wt  ?? p.totalNetWt   ?? 0,
      part_box_size:    p.part_box_size    ?? p.partBoxSize     ?? p.box_size     ?? p.boxSize      ?? "",
      part_no_of_boxes: p.part_no_of_boxes ?? p.partNoOfBoxes  ?? p.no_of_boxes  ?? p.noOfBoxes    ?? p.boxes ?? 0,
    };
  }

  // Normalize a whole-form object from DB (top-level field aliases)
  function normalizeForm(raw) {
    if (!raw || Object.keys(raw).length === 0) return raw;
    return {
      ...raw,
      // top-level aliases
      enquiry_no:          raw.enquiry_no      ?? raw.enquiryNo      ?? raw.enquiry_number ?? "",
      invoice_no:          raw.invoice_no      ?? raw.invoiceNo      ?? "",
      invoice_date:        toDateInput(raw.invoice_date    ?? raw.invoiceDate    ?? ""),
      ff:                  raw.ff              ?? raw.freight_forwarder ?? "",
      incoterm:            raw.incoterm        ?? raw.inco_term      ?? "",
      mode:                raw.mode            ?? "Sea",
      customer:            raw.customer        ?? raw.customer_name  ?? "",
      supplier_name:       raw.supplier_name   ?? raw.supplier       ?? "",
      sb_no:               raw.sb_no           ?? raw.sbNo           ?? raw.shipping_bill_no ?? "",
      sb_date:             toDateInput(raw.sb_date         ?? raw.sbDate         ?? raw.shipping_bill_date),
      etd:                 toDateInput(raw.etd             ?? ""),
      supplier_etd:        toDateInput(raw.supplier_etd    ?? raw.supplierEtd    ?? ""),
      final_delivery_date: toDateInput(raw.final_delivery_date ?? raw.finalDeliveryDate ?? raw.eta ?? ""),
      bl_no:               raw.bl_no           ?? raw.blNo           ?? raw.bl_number ?? "",
      container_no:        raw.container_no    ?? raw.containerNo    ?? raw.container_number ?? "",
      pol:                 raw.pol             ?? raw.port_of_loading ?? "",
      notify_email:        raw.notify_email    ?? raw.notifyEmail    ?? raw.email ?? "",
      email_message:       raw.email_message   ?? raw.emailMessage   ?? raw.message ?? "",
      total_net_wt:        raw.total_net_wt    ?? raw.totalNetWt     ?? 0,
      total_gross_wt:      raw.total_gross_wt  ?? raw.totalGrossWt   ?? 0,
      total_no_of_boxes:   raw.total_no_of_boxes ?? raw.totalNoOfBoxes ?? 0,
      label_urls:          raw.label_urls      ?? raw.labelUrls      ?? [],
      // normalize each part
      parts: Array.isArray(raw.parts) && raw.parts.length > 0
        ? raw.parts.map(normalizePart)
        : undefined,
    };
  }

  // ── Step1 state ──────────────────────────────────────────────────────────
  // Initialise with a lazy function so we capture initial correctly on first render
  const [form, setForm] = useState(() => {
    const normalized = normalizeForm(initial) || {};
    const initParts =
      Array.isArray(normalized.parts) && normalized.parts.length > 0
        ? normalized.parts
        : [{
            part_no: "", part_desc: "", part_qty: 0, part_net_unit: 0,
            part_gross: 0, part_total_net_wt: 0, part_box_size: "", part_no_of_boxes: 0,
          }];
    return {
      enquiry_no: "",
      ff: "",
      invoice_no: "",
      invoice_date: "",
      incoterm: "",
      mode: "Sea",
      customer: "",
      supplier_name: "",
      sb_no: "",
      sb_date: "",
      dispatch_date: "",
      total_net_wt: 0,
      total_gross_wt: 0,
      total_no_of_boxes: 0,
      label_files: [],
      label_urls: [],
      etd: "",
      supplier_etd: "",
      final_delivery_date: "",
      bl_no: "",
      container_no: "",
      pol: "",
      notify_email: "",
      email_message: "",
      ...normalized,             // overwrite with all saved + normalized values
      parts: initParts,          // always resolved parts array
    };
  });

  const [partAC, setPartAC] = useState(() => {
    const normalizedParts = Array.isArray(initial.parts) && initial.parts.length > 0
      ? initial.parts.map(normalizePart)
      : [{}];
    return normalizedParts.map((p) => ({
      query: p.part_no || "",    // pre-fill query so part_no shows on load
      suggestions: [],
      loading: false,
      showDropdown: false,
    }));
  });

  const [partSuppliers, setPartSuppliers] = useState(() => {
    const normalizedParts = Array.isArray(initial.parts) && initial.parts.length > 0
      ? initial.parts.map(normalizePart)
      : [{}];
    return normalizedParts.map(() => []);
  });

  const dropdownRefs = useRef([]);
  const lastInitialRef = useRef(null);

  // ── NEW: Smart Part Number Suggestions (Shipment History source) ────────
  // Fully separate from partAC/partSuppliers above — the existing
  // part_master autocomplete is left completely untouched.
  const shipmentHistory = useShipmentPartHistory();
  const [smartAC, setSmartAC] = useState(() =>
    (Array.isArray(initial.parts) && initial.parts.length > 0 ? initial.parts : [{}]).map(() => ({
      results: [],
      activeIndex: -1,
      show: false,
    }))
  );
  const smartDebounceRefs = useRef([]);
  const smartDropdownRefs = useRef([]);

  // ── PREFILL FIX: sync incoming initial data into form (edit mode) ────────
  useEffect(() => {
    if (!initial || Object.keys(initial).length === 0) return;
    if (lastInitialRef.current === initial) return;
    lastInitialRef.current = initial;

    // Run through normalizer to handle any DB field name differences
    const normalized = normalizeForm(initial) || {};

    const incomingParts =
      Array.isArray(normalized.parts) && normalized.parts.length > 0
        ? normalized.parts
        : [{
            part_no: "", part_desc: "", part_qty: 0, part_net_unit: 0,
            part_gross: 0, part_total_net_wt: 0, part_box_size: "", part_no_of_boxes: 0,
          }];

    // Build full prefilled form in one shot — avoids stale spread
    const prefilled = {
      enquiry_no: "",
      ff: "",
      invoice_no: "",
      invoice_date: "",
      incoterm: "",
      mode: "Sea",
      customer: "",
      supplier_name: "",
      sb_no: "",
      sb_date: "",
      dispatch_date: "",
      total_net_wt: 0,
      total_gross_wt: 0,
      total_no_of_boxes: 0,
      label_files: [],
      label_urls: [],
      etd: "",
      supplier_etd: "",
      final_delivery_date: "",
      bl_no: "",
      container_no: "",
      pol: "",
      notify_email: "",
      email_message: "",
      ...normalized,
      parts: incomingParts,
    };

    setForm(prefilled);

    // Sync partAC — query pre-filled so part_no shows in input immediately
    setPartAC(
      incomingParts.map((p) => ({
        query: p.part_no || "",
        suggestions: [],
        loading: false,
        showDropdown: false,
      }))
    );

    setPartSuppliers(incomingParts.map(() => []));

    // NEW — keep the smart-suggestion popup state array aligned with parts
    setSmartAC(incomingParts.map(() => ({ results: [], activeIndex: -1, show: false })));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?._id ?? initial?.enquiry_no ?? JSON.stringify(initial)]);
  // ↑ Depend on a stable ID/key, not the object reference.
  //   This prevents re-firing every time Wizard merges onUpdate into data.

  // ── Close dropdowns on outside click ────────────────────────────────────
  useEffect(() => {
    function handleClick(e) {
      dropdownRefs.current.forEach((ref, i) => {
        if (ref && !ref.contains(e.target)) {
          setPartAC((prev) => {
            const next = [...prev];
            next[i] = { ...next[i], showDropdown: false };
            return next;
          });
        }
      });
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // NEW — Close the Smart (Shipment History) suggestion popup on outside click.
  // Independent of the effect above; does not alter its behavior.
  useEffect(() => {
    function handleSmartClick(e) {
      smartDropdownRefs.current.forEach((ref, i) => {
        if (ref && !ref.contains(e.target)) {
          setSmartAC((prev) => {
            if (!prev[i] || !prev[i].show) return prev;
            const next = [...prev];
            next[i] = { ...next[i], show: false };
            return next;
          });
        }
      });
    }
    document.addEventListener("mousedown", handleSmartClick);
    return () => document.removeEventListener("mousedown", handleSmartClick);
  }, []);

  // ── Auto-fetch enquiry number on Create mode only ───────────────────────
  // Skip entirely if initial already has an enquiry_no (edit mode)
  useEffect(() => {
    if (initial?.enquiry_no) return;           // edit mode — keep saved value
    if (form.enquiry_no) return;               // already set
    API.get("/shipment/enquiry-number")
      .then((res) => {
        if (res.data?.enquiryNo) {
          setForm((prev) => ({ ...prev, enquiry_no: res.data.enquiryNo }));
        }
      })
      .catch((err) => console.error("Failed to fetch enquiry number:", err));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Totals Calculation ───────────────────────────────────────────────────
  // Recalculates only when parts array contents actually change (stable JSON key)
  const partsKey = JSON.stringify(
    form.parts.map((p) => ({
      q: p.part_qty, n: p.part_net_unit, g: p.part_gross, b: p.part_no_of_boxes,
      bs: p.part_box_size, // ✅ FIX — Box Size was missing from this fingerprint, so
      // editing it never re-fired the sync effect below and onUpdate() was never
      // called with the new value. Parent Wizard "data" (what gets PATCHed to the
      // backend on Update) kept the OLD box_size forever. Adding it here makes the
      // effect fire on Box Size edits too, so the new value reaches the server.
    }))
  );

  useEffect(() => {
    let aggregateNet = 0, aggregateGross = 0, aggregateBoxes = 0, aggregateQty = 0;
    form.parts.forEach((p) => {
      aggregateNet   += Number(p.part_qty || 0) * Number(p.part_net_unit || 0);
      aggregateGross += Number(p.part_gross || 0);
      aggregateBoxes += Number(p.part_no_of_boxes || 0);
      aggregateQty   += Number(p.part_qty || 0);
    });

    // Only call onUpdate here — do NOT call setForm (would cause loop)
    // The totals are derived values; pass them directly to parent
    onUpdate({
      ...form,
      total_qty: aggregateQty,
      total_net_wt: aggregateNet.toFixed(2),
      total_gross_wt: aggregateGross.toFixed(2),
      total_no_of_boxes: aggregateBoxes,
    });

    // Update totals in local form too, but only the total fields — not the whole form
    setForm((prev) => ({
      ...prev,
      total_qty: aggregateQty,
      total_net_wt: aggregateNet.toFixed(2),
      total_gross_wt: aggregateGross.toFixed(2),
      total_no_of_boxes: aggregateBoxes,
    }));
  }, [partsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Part autocomplete search ─────────────────────────────────────────────
  const searchPartNumber = useCallback(async (index, query) => {
    const cleanedQuery = sanitizeSearchInput(query);
    if (cleanedQuery.length < 2) {
      setPartAC((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], suggestions: [], showDropdown: false };
        return next;
      });
      return;
    }
    setPartAC((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], loading: true };
      return next;
    });
    try {
      const res = await API.get(`/parts/search?q=${encodeURIComponent(query)}`);
      setPartAC((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], suggestions: res.data || [], loading: false, showDropdown: true };
        return next;
      });
    } catch (err) {
      console.error("Part search error:", err);
      setPartAC((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], loading: false, showDropdown: false };
        return next;
      });
    }
  }, []);

  // ── NEW: Smart (Shipment History) suggestion search — debounced 250ms ───
  const runSmartSearch = useCallback(
    (index, query) => {
      if (!query || query.trim().length === 0) {
        setSmartAC((prev) => {
          const next = [...prev];
          next[index] = { results: [], activeIndex: -1, show: false };
          return next;
        });
        return;
      }
      const results = shipmentHistory.search(query);
      setSmartAC((prev) => {
        const next = [...prev];
        next[index] = { results, activeIndex: results.length ? 0 : -1, show: results.length > 0 };
        return next;
      });
    },
    [shipmentHistory]
  );

  const scheduleSmartSearch = useCallback(
    (index, query) => {
      if (smartDebounceRefs.current[index]) {
        clearTimeout(smartDebounceRefs.current[index]);
      }
      smartDebounceRefs.current[index] = setTimeout(() => {
        runSmartSearch(index, query);
      }, 250);
    },
    [runSmartSearch]
  );

  // NEW — Auto-fill the current row ONLY from a Shipment-History suggestion.
  // Never touches other part rows; every field remains editable afterward
  // since these are plain controlled inputs (no readOnly is added here).
  const selectSmartSuggestion = useCallback(
    (index, r) => {
      setForm((prev) => {
        const updatedParts = [...prev.parts];
        const qty = r.part_qty !== "" && r.part_qty !== undefined ? Number(r.part_qty) : updatedParts[index].part_qty;
        const netUnit =
          r.part_net_unit !== "" && r.part_net_unit !== undefined
            ? Number(r.part_net_unit)
            : updatedParts[index].part_net_unit;
        updatedParts[index] = {
          ...updatedParts[index],
          part_no: r.part_no ?? updatedParts[index].part_no,
          part_desc: r.part_desc ?? updatedParts[index].part_desc,
          part_qty: qty,
          part_box_size: r.part_box_size || updatedParts[index].part_box_size,
          part_no_of_boxes:
            r.part_no_of_boxes !== "" && r.part_no_of_boxes !== undefined
              ? r.part_no_of_boxes
              : updatedParts[index].part_no_of_boxes,
          part_net_unit: netUnit,
          part_gross:
            r.part_gross !== "" && r.part_gross !== undefined ? r.part_gross : updatedParts[index].part_gross,
          part_total_net_wt: (Number(qty || 0) * Number(netUnit || 0)).toFixed(2),
        };
        return { ...prev, parts: updatedParts };
      });

      // keep the existing part_master autocomplete's own query text in sync
      // so the input displays the selected part number (does not alter its logic)
      setPartAC((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], query: r.part_no, showDropdown: false, suggestions: [] };
        return next;
      });

      setSmartAC((prev) => {
        const next = [...prev];
        next[index] = { results: [], activeIndex: -1, show: false };
        return next;
      });
    },
    []
  );

  // NEW — Keyboard navigation for the Smart suggestion popup: ↑ ↓ Enter Esc.
  // Only acts when the smart popup is open; otherwise does nothing, so it
  // never interferes with normal typing or the existing dropdown's own
  // (mouse-only) interaction.
  const handlePartNoKeyDown = (index, e) => {
    const smart = smartAC[index];
    if (!smart || !smart.show || smart.results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSmartAC((prev) => {
        const next = [...prev];
        const cur = next[index];
        next[index] = { ...cur, activeIndex: (cur.activeIndex + 1) % cur.results.length };
        return next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSmartAC((prev) => {
        const next = [...prev];
        const cur = next[index];
        next[index] = { ...cur, activeIndex: (cur.activeIndex - 1 + cur.results.length) % cur.results.length };
        return next;
      });
    } else if (e.key === "Enter") {
      if (smart.activeIndex >= 0 && smart.results[smart.activeIndex]) {
        e.preventDefault();
        selectSmartSuggestion(index, smart.results[smart.activeIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setSmartAC((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], show: false };
        return next;
      });
    }
  };

  // ── Select suggestion from autocomplete dropdown ─────────────────────────
  const selectPartSuggestion = useCallback(
    (index, suggestion) => {
      const { part_number, part_description, customer_name, suppliers } = suggestion;
      const updatedParts = [...form.parts];
      updatedParts[index] = { ...updatedParts[index], part_no: part_number, part_desc: part_description };
      const updatedForm = { ...form, parts: updatedParts, customer: customer_name || form.customer };
      const newPartSuppliers = [...partSuppliers];
      newPartSuppliers[index] = suppliers || [];
      if (suppliers && suppliers.length === 1) updatedForm.supplier_name = suppliers[0];
      setForm(updatedForm);
      setPartSuppliers(newPartSuppliers);
      setPartAC((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], query: part_number, showDropdown: false, suggestions: [] };
        return next;
      });
    },
    [form, partSuppliers]
  );

  // ── Part field change ────────────────────────────────────────────────────
  const handlePartChange = (index, e) => {
    const { name, value } = e.target;
    const updatedParts = [...form.parts];
    updatedParts[index] = { ...updatedParts[index], [name]: value };
    if (name === "part_qty" || name === "part_net_unit") {
      const qty     = name === "part_qty"      ? Number(value) : Number(updatedParts[index].part_qty || 0);
      const netUnit = name === "part_net_unit" ? Number(value) : Number(updatedParts[index].part_net_unit || 0);
      updatedParts[index].part_total_net_wt = (qty * netUnit).toFixed(2);
    }
    setForm((prev) => ({ ...prev, parts: updatedParts }));
  };

  // ── Part number input (drives Smart/Shipment-History suggestions only) ──
  const handlePartNoInput = (index, e) => {
    const value = e.target.value;
    setPartAC((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], query: value };
      return next;
    });
    const updatedParts = [...form.parts];
    updatedParts[index] = { ...updatedParts[index], part_no: value };
    setForm((prev) => ({ ...prev, parts: updatedParts }));
    scheduleSmartSearch(index, value); // Shipment History suggestions
  };

  // ── Part description input (drives the existing part_master autocomplete) ─
  const handlePartDescInput = (index, e) => {
    const value = e.target.value;
    const updatedParts = [...form.parts];
    updatedParts[index] = { ...updatedParts[index], part_desc: value };
    setForm((prev) => ({ ...prev, parts: updatedParts }));
    searchPartNumber(index, value); // existing part_master search — untouched
  };

  const addPart = () => {
    setForm((prev) => ({
      ...prev,
      parts: [...prev.parts, { part_no: "", part_desc: "", part_qty: 0, part_net_unit: 0, part_gross: 0, part_total_net_wt: 0, part_box_size: "", part_no_of_boxes: 0 }],
    }));
    setPartAC((prev) => [...prev, { query: "", suggestions: [], loading: false, showDropdown: false }]);
    setPartSuppliers((prev) => [...prev, []]);
    setSmartAC((prev) => [...prev, { results: [], activeIndex: -1, show: false }]); // NEW
  };

  const removePart = (index) => {
    setForm((prev) => ({ ...prev, parts: prev.parts.filter((_, i) => i !== index) }));
    setPartAC((prev) => prev.filter((_, i) => i !== index));
    setPartSuppliers((prev) => prev.filter((_, i) => i !== index));
    setSmartAC((prev) => prev.filter((_, i) => i !== index)); // NEW
  };

  // ── Generic top-level field change ──────────────────────────────────────
  // Only call setForm — parent sync happens via the partsKey useEffect above.
  // Calling onUpdate here AND in useEffect caused double-updates and loops.
  const change = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      // sync non-parts fields to parent immediately
      onUpdate(next);
      return next;
    });
  };

  // ── Step2: Send tracking email ───────────────────────────────────────────
  function sendMail() {
    if (!form.notify_email) {
      alert("Please enter recipient email");
      return;
    }
    API.post("/notification/send-tracking-email", {
      to: form.notify_email,
      subject: "Shipment Tracking Update",
      bl_no: form.bl_no,
      container_no: form.container_no,
      etd: form.etd,
      final_delivery_date: form.final_delivery_date,
      message: `
Shipment Tracking Details

BL No: ${form.bl_no}
Container No: ${form.container_no}
ETD: ${form.etd}
Final Delivery : ${form.final_delivery_date}
POL: ${form.pol}

Message:
${form.email_message || ""}
      `,
    })
      .then(() => alert("Email sent successfully ✅"))
      .catch(() => alert("Failed to send email ❌"));
  }

  // ── Step2: File upload ───────────────────────────────────────────────────
  async function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    setForm((f) => ({ ...f, label_files: files }));
    onUpdate({ ...form, label_files: files });
    const fd = new FormData();
    files.forEach((file) => fd.append("files", file));
    try {
      const res = await API.post("/files/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setForm((f) => ({ ...f, label_urls: res.data }));
      onUpdate({ ...form, label_urls: res.data });
    } catch (err) {
      console.error("Upload failed", err);
    }
  }

  const allSuppliersForForm = [...new Set(partSuppliers.flat().filter(Boolean))];

  return (
    <div className="erp-step1">
      <style>{S}</style>

      {/* ══ SHIPMENT DETAILS ══ */}
      <div className="card">
        <div className="card-hdr">
          <div className="card-title">Shipment Details <span className="badge">STEP 1</span></div>
        </div>

        <div className="g2">
          <div className="f">
            <label>Enquiry No <em>*</em></label>
            <input value={form.enquiry_no} readOnly className="ro" />
          </div>
          <div className="f">
            <label>FF / Freight Forwarder</label>
            <input name="ff" value={form.ff} onChange={change} placeholder="Freight Forwarder" />
          </div>
        </div>

        <div className="g2-last">
          <div className="f">
            <label>Invoice No <em>*</em></label>
            <input name="invoice_no" value={form.invoice_no} onChange={change} placeholder="Invoice number" />
          </div>
          <div className="f">
            <label>Invoice Date <em>*</em></label>
            <input type="date" name="invoice_date" value={form.invoice_date} onChange={change} />
          </div>
          <div className="f">
            <label>Incoterm</label>
            <select name="incoterm" value={form.incoterm} onChange={change}>
              <option value="">Select Incoterm</option>
              {INCOTERMS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="f">
            <label>Mode</label>
            <select name="mode" value={form.mode} onChange={change}>
              <option>Sea</option>
              <option>Air</option>
              <option>Road</option>
              <option>Rail</option>
            </select>
          </div>
        </div>
      </div>

      {/* ══ PART DETAILS + CUSTOMER & SHIPPING DETAILS — side by side ══ */}
      <div className="two-col-row">
      <div className="card two-col-row__part">
        <div className="card-hdr">
          <div className="card-title">Part Details</div>
          <button className="btn-add" type="button" onClick={addPart}>+ Add Part</button>
        </div>

        {form.parts.map((part, index) => {
          const ac = partAC[index] || { query: "", suggestions: [], loading: false, showDropdown: false };
          const smart = smartAC[index] || { results: [], activeIndex: -1, show: false }; // NEW

          return (
            <div className="part-card" key={index}>
              <div className="part-hdr">
                <span className="part-lbl">Part {index + 1}</span>
                {form.parts.length > 1 && (
                  <button className="btn-rm" type="button" onClick={() => removePart(index)}>✕</button>
                )}
              </div>

              {/* Part No + Part Desc */}
              <div className="g2">
                <div className="f" style={{ position: "relative" }}>
                  <label>Part Number <em>*</em></label>
                  <input
                    name="part_no"
                    value={ac.query !== "" ? ac.query : (part.part_no || "")}
                    onChange={(e) => handlePartNoInput(index, e)}
                    onKeyDown={(e) => handlePartNoKeyDown(index, e)}
                    placeholder="Type to search recent shipments…"
                    autoComplete="off"
                  />

                  {/* Smart (Shipment History) suggestion popup — drives
                      Part Number only. The existing part_master dropdown
                      has moved to the Part Description field below. */}
                  {smart.show && smart.results.length > 0 && (
                    <div ref={(el) => (smartDropdownRefs.current[index] = el)}>
                      <SmartPartSuggestPopup
                        results={smart.results}
                        activeIndex={smart.activeIndex}
                        top={38}
                        onHover={(i) =>
                          setSmartAC((prev) => {
                            const next = [...prev];
                            next[index] = { ...next[index], activeIndex: i };
                            return next;
                          })
                        }
                        onSelect={(r) => selectSmartSuggestion(index, r)}
                      />
                    </div>
                  )}
                </div>

                <div className="f" style={{ position: "relative" }} ref={(el) => (dropdownRefs.current[index] = el)}>
                  <label>
                    Part Description
                    {part.part_desc && part.part_no && <span className="autofill-tag">✓ Auto-filled</span>}
                  </label>
                  <input
                    name="part_desc"
                    value={part.part_desc}
                    onChange={(e) => handlePartDescInput(index, e)}
                    placeholder="Type to search part master…"
                    style={part.part_desc && part.part_no ? { background: "#F0FFF4" } : {}}
                    autoComplete="off"
                  />
                  {ac.loading && (
                    <span style={{ position: "absolute", right: 10, top: 34, fontSize: 11, color: "#94A3B8" }}>
                      Searching…
                    </span>
                  )}
                  {ac.showDropdown && ac.suggestions.length > 0 && (
                    <ul className="ac-dropdown">
                      {ac.suggestions.map((s) => (
                        <li key={s.part_number} className="ac-item" onMouseDown={() => selectPartSuggestion(index, s)}>
                          <strong>{s.part_number}</strong>
                          {s.part_description && (
                            <span style={{ color: "#64748B", marginLeft: 8, fontSize: 11 }}>{s.part_description}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>


              {/* Box Size, No. of Boxes, Quantity */}
              <div className="g3">
                <div className="f">
                  <label>Box Size</label>
                  <input name="part_box_size" value={part.part_box_size} onChange={(e) => handlePartChange(index, e)} placeholder="e.g. 10x10x12" />
                </div>
                <div className="f">
                  <label>No. of Boxes</label>
                  <input type="number" name="part_no_of_boxes" value={part.part_no_of_boxes} onChange={(e) => handlePartChange(index, e)} min="0" />
                </div>
                <div className="f">
                  <label>Quantity</label>
                  <input type="number" name="part_qty" value={part.part_qty} onChange={(e) => handlePartChange(index, e)} min="0" />
                </div>
              </div>

              {/* Net Wt/Unit, Total Net Wt (auto), Gross Wt */}
              <div className="g3-last">
                <div className="f">
                  <label>Net Wt / Unit (Kg)</label>
                  <input type="number" name="part_net_unit" value={part.part_net_unit} onChange={(e) => handlePartChange(index, e)} min="0" step="0.01" />
                </div>
                <div className="f">
                  <label>Total Net Wt (Kg) <span style={{ color: "#94A3B8", fontWeight: 400, fontSize: 9 }}>Qty×Wt</span></label>
                  <input className="calc" type="number" name="part_total_net_wt" value={part.part_total_net_wt} readOnly />
                </div>
                <div className="f">
                  <label>Gross Wt (Kg)</label>
                  <input type="number" name="part_gross" value={part.part_gross} onChange={(e) => handlePartChange(index, e)} min="0" step="0.01" />
                </div>
              </div>

              {/* ✅ NEW — per-part "Add Part" button, same handler/behavior as the header button */}
              <div className="g2-last" style={{ justifyContent: "flex-end", display: "flex" }}>
                <button className="btn-add" type="button" onClick={addPart}>+ Add Part</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ══ CUSTOMER & SHIPPING DETAILS ══ */}
      <div className="card two-col-row__customer">
        <div className="card-hdr">
          <div className="card-title">Customer &amp; Shipping Details</div>
        </div>

        <div className="g2">
          <div className="f">
            <label>
              Customer Name
              {form.customer && <span className="autofill-tag">✓ Auto-filled</span>}
            </label>
            <input
              name="customer"
              value={form.customer}
              onChange={change}
              placeholder="Auto-filled on part selection"
              style={form.customer ? { background: "#F0FFF4" } : {}}
            />
          </div>

          <div className="f">
            <label>Supplier Name</label>
            {allSuppliersForForm.length > 1 ? (
              <select name="supplier_name" value={form.supplier_name} onChange={change}>
                <option value="">Select Supplier</option>
                {allSuppliersForForm.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            ) : (
              <input
                name="supplier_name"
                value={form.supplier_name}
                onChange={change}
                placeholder="Auto-filled or type manually"
                style={allSuppliersForForm.length === 1 ? { background: "#F0FFF4" } : {}}
              />
            )}
            {allSuppliersForForm.length === 1 && <span className="autofill-tag">✓ Auto-filled</span>}
            {allSuppliersForForm.length > 1 && <span className="multi-sup-tag">Multiple suppliers — please select one</span>}
          </div>
        </div>

        <div className="g2-last">
          <div className="f">
            <label>SB No</label>
            <input name="sb_no" value={form.sb_no} onChange={change} placeholder="Shipping Bill Number" />
          </div>
          <div className="f">
            <label>SB Date</label>
            <input type="date" name="sb_date" value={form.sb_date} onChange={change} />
          </div>
        </div>
      </div>
      </div>

      {/* ══ TRACKING DETAILS + SEND TRACKING EMAIL — side by side ══ */}
      <div className="two-col-row">
      <div className="card two-col-row__tracking">
        <div className="card-hdr">
          <div className="card-title">Tracking Details <span className="badge">STEP 2</span></div>
        </div>

        {/* File Upload */}
        <label className="file-row">
          <span>📎</span>
          <span>Upload Label Photos — Choose files or drag &amp; drop</span>
          <input type="file" accept="image/*" multiple onChange={handleFiles} style={{ display: "none" }} />
        </label>
        {form.label_urls?.length > 0 && (
          <div className="img-row">
            {form.label_urls.map((u, i) => (
              <img key={i} src={u.url || u} className="img-thumb" alt="label" />
            ))}
          </div>
        )}

        <div className="g2">
          <div className="f">
            <label>ETD (Estimated Time of Departure)</label>
            <input type="date" name="etd" value={form.etd} onChange={change} />
          </div>
          <div className="f">
            <label>Supplier ETD</label>
            <input type="date" name="supplier_etd" value={form.supplier_etd} onChange={change} />
          </div>
          <div className="f">
            <label>Final Delivery</label>
            <input type="date" name="final_delivery_date" value={form.final_delivery_date} onChange={change} />
          </div>
        </div>

        <div className="g2">
          <div className="f">
            <label>BL No</label>
            <input name="bl_no" value={form.bl_no} onChange={change} placeholder="Bill of Lading No" />
          </div>
          <div className="f">
            <label>Container No</label>
            <input name="container_no" value={form.container_no} onChange={change} placeholder="Container Number" />
          </div>
        </div>

        <div className="g-full">
          <div className="f">
            <label>POL (Port of Loading)</label>
            <input type="text" name="pol" value={form.pol} onChange={change} placeholder="Enter Port of Loading" />
          </div>
        </div>
      </div>

      {/* ══ SEND TRACKING EMAIL (merged from Step2) ══ */}
      <div className="card two-col-row__email">
        <div className="card-hdr">
          <div className="card-title">📧 Send Tracking Email</div>
        </div>

        <div className="g-email">
          <div className="f">
            <label>Recipient Email</label>
            <input type="email" name="notify_email" value={form.notify_email} onChange={change} placeholder="Recipient Email" />
          </div>
          <button className="btn-send" type="button" onClick={sendMail}>
            Send Email
          </button>
        </div>

        <div className="f">
          <label>Optional message</label>
          <textarea name="email_message" value={form.email_message} onChange={change} placeholder="Optional message" />
        </div>
      </div>
      </div>

      {/* ══ WHOLE SHIPMENT TOTALS ══ */}
      <div className="card">
        <div className="card-hdr">
          <div className="card-title">Whole Shipment Totals</div>
          <span style={{ fontSize: 10, color: "#94A3B8" }}>Auto-calculated</span>
        </div>
        <div className="totals">
          <div className="tot-cell">
            <div className="tot-lbl">Total Net Weight (Kg)</div>
            <div className="tot-val">{Number(form.total_net_wt).toFixed(2)}</div>
            <div className="tot-unit">Kilograms</div>
          </div>
          <div className="tot-cell">
            <div className="tot-lbl">Total Gross Weight (Kg)</div>
            <div className="tot-val">{Number(form.total_gross_wt).toFixed(2)}</div>
            <div className="tot-unit">Kilograms</div>
          </div>
          <div className="tot-cell">
            <div className="tot-lbl">Total No. of Boxes</div>
            <div className="tot-val">{form.total_no_of_boxes}</div>
            <div className="tot-unit">Cartons</div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 2, marginBottom: 4 }}>
        <button className="btn-next" type="button" onClick={onNext}>
          Save &amp; Next →
        </button>
      </div>
    </div>
  );
}
