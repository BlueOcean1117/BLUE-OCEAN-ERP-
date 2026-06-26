// frontend/src/wizard/steps/Step1.js
// ⚠️  Place this file at: src/wizard/steps/Step1.js
import React, { useState, useEffect, useRef, useCallback } from "react";
import API from "../../services/api"; // resolves to src/services/api

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
  .erp-step1 .card { background: white; border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px 14px; margin-bottom: 8px; }
  .erp-step1 .card-hdr { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid #F1F5F9; }
  .erp-step1 .card-title { font-size: 11px; font-weight: 700; color: #1E293B; text-transform: uppercase; letter-spacing: 0.4px; display: flex; align-items: center; gap: 6px; }
  .erp-step1 .badge { background: #EFF6FF; color: #2563EB; font-size: 9px; font-weight: 700; padding: 1px 6px; border-radius: 8px; }
  .erp-step1 .g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; }
  .erp-step1 .g3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 8px; }
  .erp-step1 .g3-last { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
  .erp-step1 .g2-last { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .erp-step1 .g-email { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: end; margin-bottom: 8px; }
  .erp-step1 .g-full { margin-bottom: 8px; }
  .erp-step1 .f { display: flex; flex-direction: column; gap: 3px; }
  .erp-step1 .f label { font-size: 10.5px; font-weight: 600; color: #475569; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .erp-step1 .f label em { color: #EF4444; font-style: normal; }
  .erp-step1 .f input, .erp-step1 .f select, .erp-step1 .f textarea {
    height: 34px; border: 1px solid #CBD5E1; border-radius: 6px;
    padding: 0 9px; font-size: 12px; color: #1E293B; background: white;
    outline: none; width: 100%; transition: border-color 0.12s, box-shadow 0.12s;
  }
  .erp-step1 .f select { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%2364748B' d='M0 0l5 6 5-6z'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 8px center; padding-right: 24px; }
  .erp-step1 .f input:focus, .erp-step1 .f select:focus, .erp-step1 .f textarea:focus { border-color: #2563EB; box-shadow: 0 0 0 2px rgba(37,99,235,0.1); }
  .erp-step1 .f input.ro { background: #F8FAFC; color: #64748B; cursor: default; }
  .erp-step1 .f input.ro:focus { border-color: #CBD5E1; box-shadow: none; }
  .erp-step1 .f input.calc { background: #EFF6FF; border-color: #BFDBFE; color: #1D4ED8; font-weight: 600; cursor: default; }
  .erp-step1 .f input.calc:focus { border-color: #BFDBFE; box-shadow: none; }
  .erp-step1 .f textarea { height: 54px; padding: 6px 9px; resize: none; font-size: 12px; }
  .erp-step1 .f input::placeholder, .erp-step1 .f textarea::placeholder { color: #9CA3AF; font-size: 11px; }
  .erp-step1 .part-card { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 9px 12px; margin-bottom: 8px; }
  .erp-step1 .part-hdr { display: flex; align-items: center; justify-content: space-between; margin-bottom: 7px; }
  .erp-step1 .part-lbl { font-size: 10px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; }
  .erp-step1 .btn-rm { background: none; border: none; color: #94A3B8; font-size: 13px; cursor: pointer; padding: 1px 4px; border-radius: 3px; }
  .erp-step1 .btn-rm:hover { background: #FEE2E2; color: #EF4444; }
  .erp-step1 .totals { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
  .erp-step1 .tot-cell { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 8px 12px; }
  .erp-step1 .tot-lbl { font-size: 10px; font-weight: 600; color: #64748B; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 2px; }
  .erp-step1 .tot-val { font-size: 16px; font-weight: 700; color: #0F172A; }
  .erp-step1 .tot-unit { font-size: 10px; color: #94A3B8; }
  .erp-step1 .btn-add { background: #EFF6FF; color: #2563EB; border: 1px solid #BFDBFE; height: 26px; padding: 0 10px; border-radius: 5px; font-size: 11px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 3px; }
  .erp-step1 .btn-add:hover { background: #DBEAFE; }
  .erp-step1 .btn-next { height: 34px; padding: 0 20px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; border: none; background: #2563EB; color: white; display: inline-flex; align-items: center; gap: 5px; }
  .erp-step1 .btn-next:hover { background: #1D4ED8; }
  .erp-step1 .btn-send { background: #059669; color: white; border: none; height: 34px; padding: 0 14px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap; }
  .erp-step1 .btn-send:hover { background: #047857; }
  .erp-step1 .file-row { border: 1px dashed #CBD5E1; border-radius: 6px; padding: 5px 10px; display: flex; align-items: center; gap: 6px; font-size: 11px; color: #64748B; background: #FAFAFA; margin-bottom: 8px; cursor: pointer; }
  .erp-step1 .img-row { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; margin-bottom: 8px; }
  .erp-step1 .img-thumb { width: 72px; height: 54px; object-fit: cover; border-radius: 6px; border: 1px solid #E2E8F0; }
  .erp-step1 .ac-dropdown { position: absolute; top: 100%; left: 0; right: 0; z-index: 100; background: #fff; border: 1px solid #CBD5E1; border-radius: 6px; max-height: 200px; overflow-y: auto; margin: 0; padding: 0; list-style: none; box-shadow: 0 4px 12px rgba(0,0,0,0.12); }
  .erp-step1 .ac-item { padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #F1F5F9; font-size: 12px; }
  .erp-step1 .ac-item:hover { background: #F5F5F5; }
  .erp-step1 .autofill-tag { font-size: 10px; color: #10B981; margin-left: 5px; }
  .erp-step1 .multi-sup-tag { font-size: 10px; color: #F59E0B; }
  @media (max-width: 700px) {
    .erp-step1 .g2, .erp-step1 .g3, .erp-step1 .g3-last, .erp-step1 .g2-last, .erp-step1 .totals, .erp-step1 .g-email { grid-template-columns: 1fr !important; }
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
    if (query.length < 2) {
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

  // ── Part number input (drives autocomplete) ──────────────────────────────
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
    searchPartNumber(index, value);
  };

  const addPart = () => {
    setForm((prev) => ({
      ...prev,
      parts: [...prev.parts, { part_no: "", part_desc: "", part_qty: 0, part_net_unit: 0, part_gross: 0, part_total_net_wt: 0, part_box_size: "", part_no_of_boxes: 0 }],
    }));
    setPartAC((prev) => [...prev, { query: "", suggestions: [], loading: false, showDropdown: false }]);
    setPartSuppliers((prev) => [...prev, []]);
  };

  const removePart = (index) => {
    setForm((prev) => ({ ...prev, parts: prev.parts.filter((_, i) => i !== index) }));
    setPartAC((prev) => prev.filter((_, i) => i !== index));
    setPartSuppliers((prev) => prev.filter((_, i) => i !== index));
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

        <div className="g2">
          <div className="f">
            <label>Invoice No <em>*</em></label>
            <input name="invoice_no" value={form.invoice_no} onChange={change} placeholder="Invoice number" />
          </div>
          <div className="f">
            <label>Invoice Date <em>*</em></label>
            <input type="date" name="invoice_date" value={form.invoice_date} onChange={change} />
          </div>
        </div>

        <div className="g2-last">
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

      {/* ══ PART DETAILS ══ */}
      <div className="card">
        <div className="card-hdr">
          <div className="card-title">Part Details</div>
          <button className="btn-add" type="button" onClick={addPart}>+ Add Part</button>
        </div>

        {form.parts.map((part, index) => {
          const ac = partAC[index] || { query: "", suggestions: [], loading: false, showDropdown: false };

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
                <div className="f" style={{ position: "relative" }} ref={(el) => (dropdownRefs.current[index] = el)}>
                  <label>Part Number <em>*</em></label>
                  <input
                    name="part_no"
                    value={ac.query !== "" ? ac.query : (part.part_no || "")}
                    onChange={(e) => handlePartNoInput(index, e)}
                    placeholder="Type to search…"
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

                <div className="f">
                  <label>
                    Part Description
                    {part.part_desc && part.part_no && <span className="autofill-tag">✓ Auto-filled</span>}
                  </label>
                  <input
                    name="part_desc"
                    value={part.part_desc}
                    onChange={(e) => handlePartChange(index, e)}
                    placeholder="Description"
                    style={part.part_desc && part.part_no ? { background: "#F0FFF4" } : {}}
                  />
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
            </div>
          );
        })}
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

      {/* ══ CUSTOMER & SHIPPING DETAILS ══ */}
      <div className="card">
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

      {/* ══ TRACKING DETAILS (merged from Step2) ══ */}
      <div className="card">
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
      <div className="card">
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

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4, marginBottom: 8 }}>
        <button className="btn-next" type="button" onClick={onNext}>
          Save &amp; Next →
        </button>
      </div>
    </div>
  );
}
