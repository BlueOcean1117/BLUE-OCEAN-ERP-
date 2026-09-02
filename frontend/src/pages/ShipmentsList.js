import React, { useEffect, useState, useRef } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import API from "../services/api";
import "./ShipmentsList.css";
import { useNavigate, useLocation } from "react-router-dom";
import BulkShipmentUpload from "./BulkShipmentUpload";
import GenerateDocumentModal from "./GenerateDocumentModal"; // ✅ NEW
import { toast } from "react-toastify";
// and typed search terms behave identically.
function sanitizeSearchInput(value) {
  if (value === undefined || value === null) return "";
  let str = String(value);
  str = str.replace(/[\u200B\u200C\u200D\u2060\uFEFF\u180E]/g, "");
  str = str.replace(/[\u0009-\u000D\u0020\u0085\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/g, " ");
  return str.replace(/\s+/g, " ").trim();
}
// ─── helpers ────────────────────────────────────────────────────────────────
const fmt   = (d) => (d ? new Date(d).toLocaleDateString("en-GB") : "N/A"); // ✅ FIXED — was locale-ambiguous (M/D vs D/M depending on browser), causing ETD dates to display incorrectly and look like they matched searches they didn't
const fmtDate = (d) => {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};
const safe  = (v) => (v ?? "N/A");
const safeN = (v, fb = 0) => (v != null ? v : fb);
const fmtNetWt = (v) => {
  const n = Number(v);
  if (v == null || Number.isNaN(n)) return safeN(v);
  const rounded = Number(n.toFixed(1)); // e.g. 4491.9993 -> 4492
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

// ✅ NEW — persist the "entries per page" choice so it survives navigating
// to another module and back, or reloading the page, until the user
// changes it again. Kept local to this file, no other logic touched.
const PAGE_SIZE_STORAGE_KEY = "boe_shipments_pageSize";
const ALL_ENTRIES = 10000; // same sentinel already used below for "All Entries"
function getStoredPageSize(fallback) {
  try {
    const saved = window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY);
    if (saved === "all") return ALL_ENTRIES;
    const n = Number(saved);
    if (Number.isFinite(n) && n > 0) return n;
  } catch (e) {
    // localStorage unavailable — fall back silently, no functional change
  }
  return fallback;
}

// ─── NEW: date-range helpers for ETD / Supplier ETD filters (frontend-only) ─
function toDayStart(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}
function getPresetRange(key) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (key === "today") return { start: today, end: today };
  if (key === "tomorrow") {
    const t = new Date(today);
    t.setDate(t.getDate() + 1);
    return { start: t, end: t };
  }
  if (key === "thisWeek") {
    const day = today.getDay();
    const start = new Date(today);
    start.setDate(today.getDate() - day);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start, end };
  }
  if (key === "thisMonth") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { start, end };
  }
  return null;
}
// Apply a {start,end} range filter (inclusive) to rows on a given date field.
function filterByRange(list, field, range) {
  if (!range || (!range.start && !range.end)) return list;
  return list.filter((r) => {
    const d = toDayStart(r[field]);
    if (!d) return false;
    if (range.start && d < range.start) return false;
    if (range.end && d > range.end) return false;
    return true;
  });
}
function sortByDateField(list, field, dir) {
  if (!dir) return list;
  const copy = [...list];
  copy.sort((a, b) => {
    const da = toDayStart(a[field]);
    const db = toDayStart(b[field]);
    if (!da && !db) return 0;
    if (!da) return 1;   // rows without a date sink to the end
    if (!db) return -1;
    return dir === "asc" ? da - db : db - da;
  });
  return copy;
}

// ─── Auto-calculate delivery status from dates ────────────────────────────
function calcDeliveryStatus(shipment) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const etd   = shipment.etd           ? new Date(shipment.etd)                : null;
  const final = shipment.final_delivery_date ? new Date(shipment.final_delivery_date) : null;
  if (etd)   etd.setHours(0, 0, 0, 0);
  if (final) final.setHours(0, 0, 0, 0);

  // If neither date is set, keep existing status
  if (!etd && !final) return shipment.delivery_status || "IN_PROCESS";

  if (final && today >= final) return "DELIVERED";
  if (etd   && today >= etd)  return "IN_TRANSIT";
  return "IN_PROCESS";
}

// Status display config
const STATUS_CFG = {
  IN_PROCESS: {
    label:  "In Process",
    bg:     "#FEF9C3",
    color:  "#92400E",
    border: "#FDE68A",
  },
  IN_TRANSIT: {
    label:  "In Transit",
    bg:     "#DBEAFE",
    color:  "#1E40AF",
    border: "#BFDBFE",
  },
  DELIVERED: {
    label:  "Final Delivered",
    bg:     "#D1FAE5",
    color:  "#065F46",
    border: "#6EE7B7",
  },
  DELAYED: {
    label:  "Delayed",
    bg:     "#FEE2E2",
    color:  "#991B1B",
    border: "#FCA5A5",
  },
};

function getDateHint(status, shipment) {
  const d = fmtDate;
  if (status === "IN_PROCESS")
    return shipment.etd ? `Expected Start: ${d(shipment.etd)}` : null;
  if (status === "IN_TRANSIT")
    return shipment.final_delivery_date ? `Expected Delivery: ${d(shipment.final_delivery_date)}` : null;
  if (status === "DELIVERED")
    return shipment.final_delivery_date ? `Delivered On: ${d(shipment.final_delivery_date)}` : null;
  return null;
}

// Flatten one shipment into one row per part (for Excel/PDF)
function flattenShipment(r) {
  const base = {
    "Enquiry No":          safe(r.enquiry_no),
    "FF":                  safe(r.ff),
    "Invoice No":          safe(r.invoice_no),
    "Invoice Date":        fmt(r.invoice_date),
    "Supplier":            safe(r.supplier_name),
    "Customer":            safe(r.customer),
    "Incoterm":            safe(r.incoterm),
    "Mode":                safe(r.mode),
    "SB No":               safe(r.sb_no),
    "SB Date":             fmt(r.sb_date),
    "Supplier ETD":        fmt(r.supplier_etd),
    "ETD":                 fmt(r.etd),
    "Final Delivery Date": fmt(r.final_delivery_date),
    "BL No":               safe(r.bl_no),
    "Container No":        safe(r.container_no),
    "POL":                 safe(r.pol),
    "Total Boxes":         safeN(r.total_no_of_boxes),
    "Total Net Wt":        safeN(r.total_net_wt ?? r.total_net_weight ?? r.net_wt),
    "Total Gross Wt":      safeN(r.total_gross_wt ?? r.total_gross_weight ?? r.gross_wt),
    "Delivery Status":     safe(r.delivery_status),
    "Status":              safe(r.status),
    "Manual Desc":         safe(r.manual_desc),
    "Notify Email":        safe(r.notify_email),
    "Email Message":       safe(r.email_message),
  };

  const parts = Array.isArray(r.parts) && r.parts.length > 0 ? r.parts : [{}];
  return parts.map((p, i) => ({
    ...base,
    "Part #":           i + 1,
    "Part No (QMREL)":  safe(p.part_no ?? p.part_number),
    "Part Description": safe(p.part_desc ?? p.part_name ?? p.part_description),
    "Quantity":         safeN(p.part_qty ?? p.qty ?? p.quantity),
    "Box Size":         safe(p.part_box_size ?? p.box_size),
    "No of Boxes":      safeN(p.part_no_of_boxes ?? p.no_of_boxes ?? p.boxes),
    "Net Wt / Unit":    safeN(p.netWtPerUnit ?? p.part_net_unit ?? p.net_wt_unit ?? p.netWTPerUnit ?? p.netWeightPerUnit ?? p.net_wt_per_unit ?? p.net_wt),
  "Total Net Wt (Part)": safeN(p.part_total_net_wt ?? p.total_net_wt ?? (((Number(p.quantity || 0)) * (Number(p.net_wt_per_unit || 0))) || null)),
    "Gross Wt (Part)":  safeN(p.part_gross ?? p.gross_wt ?? p.gross_weight),
  }));
}

// ─── NEW: Excel-style column filter popup (used by ETD & Supplier ETD) ─────
// Purely presentational + local UI state; reports the computed filter back
// up to the parent via onApply({ start, end, sortDir }) / onReset().
function ColumnDateFilterPopup({ title, initial, onApply, onReset, onClose }) {
  const ref = useRef(null);
  const [checks, setChecks] = useState(() => ({
    selectAll: !initial,
    today: false,
    tomorrow: false,
    thisWeek: false,
    thisMonth: false,
  }));
  const [from, setFrom] = useState(initial?.rawFrom || "");
  const [to,   setTo]   = useState(initial?.rawTo   || "");
  const [sortDir, setSortDir] = useState(initial?.sortDir || null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  function toggleCheck(key) {
    setChecks((prev) => {
      if (key === "selectAll") {
        return { selectAll: true, today: false, tomorrow: false, thisWeek: false, thisMonth: false };
      }
      const next = { ...prev, selectAll: false, [key]: !prev[key] };
      const anyChecked = next.today || next.tomorrow || next.thisWeek || next.thisMonth;
      if (!anyChecked) next.selectAll = true;
      return next;
    });
  }

  function handleApply() {
    // Union of any checked quick presets
    const presetKeys = ["today", "tomorrow", "thisWeek", "thisMonth"].filter((k) => checks[k]);
    let presetRange = null;
    presetKeys.forEach((k) => {
      const r = getPresetRange(k);
      if (!r) return;
      if (!presetRange) presetRange = { ...r };
      else {
        if (r.start < presetRange.start) presetRange.start = r.start;
        if (r.end   > presetRange.end)   presetRange.end   = r.end;
      }
    });

    const customStart = from ? toDayStart(from) : null;
    const customEnd   = to   ? toDayStart(to)   : null;

    let start = null, end = null;
    if (presetRange && (customStart || customEnd)) {
      // Intersect preset range with custom range
      start = customStart && customStart > presetRange.start ? customStart : presetRange.start;
      end   = customEnd   && customEnd   < presetRange.end   ? customEnd   : presetRange.end;
    } else if (presetRange) {
      start = presetRange.start; end = presetRange.end;
    } else if (customStart || customEnd) {
      start = customStart; end = customEnd;
    }

    onApply({ start, end, sortDir, rawFrom: from, rawTo: to });
  }

  function handleReset() {
    setChecks({ selectAll: true, today: false, tomorrow: false, thisWeek: false, thisMonth: false });
    setFrom(""); setTo(""); setSortDir(null);
    onReset();
  }

  return (
    <div className="col-filter-popup" ref={ref}>
      <div className="col-filter-popup__title">▾ {title}</div>

      <label className="col-filter-popup__check">
        <input type="checkbox" checked={checks.selectAll} onChange={() => toggleCheck("selectAll")} />
        Select All
      </label>
      <label className="col-filter-popup__check">
        <input type="checkbox" checked={checks.today} onChange={() => toggleCheck("today")} />
        Today
      </label>
      <label className="col-filter-popup__check">
        <input type="checkbox" checked={checks.tomorrow} onChange={() => toggleCheck("tomorrow")} />
        Tomorrow
      </label>
      <label className="col-filter-popup__check">
        <input type="checkbox" checked={checks.thisWeek} onChange={() => toggleCheck("thisWeek")} />
        This Week
      </label>
      <label className="col-filter-popup__check">
        <input type="checkbox" checked={checks.thisMonth} onChange={() => toggleCheck("thisMonth")} />
        This Month
      </label>

      <div className="col-filter-popup__divider" />

      <div className="col-filter-popup__label">Date Range</div>
      <div className="col-filter-popup__row">
        <div>
          <label className="col-filter-popup__sublabel">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="col-filter-popup__sublabel">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <div className="col-filter-popup__divider" />

      <div className="col-filter-popup__label">Sort</div>
      <div className="col-filter-popup__sort">
        <button type="button" className={sortDir === "az" ? "active" : ""} onClick={() => setSortDir(sortDir === "az" ? null : "az")}>A → Z</button>
        <button type="button" className={sortDir === "za" ? "active" : ""} onClick={() => setSortDir(sortDir === "za" ? null : "za")}>Z → A</button>
        <button type="button" className={sortDir === "oldest" ? "active" : ""} onClick={() => setSortDir(sortDir === "oldest" ? null : "oldest")}>Oldest → Newest</button>
        <button type="button" className={sortDir === "newest" ? "active" : ""} onClick={() => setSortDir(sortDir === "newest" ? null : "newest")}>Newest → Oldest</button>
      </div>

      <div className="col-filter-popup__actions">
        <button type="button" className="col-filter-popup__apply" onClick={handleApply}>Apply</button>
        <button type="button" className="col-filter-popup__reset" onClick={handleReset}>Reset</button>
      </div>
    </div>
  );
}

export default function ShipmentsList() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const isFirstLoad = useRef(true);

  // Pagination + search
  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(() => getStoredPageSize(10)); // ✅ CHANGED — was useState(10), reset every time this page remounted
  const [search,   setSearch]   = useState("");
  const [total,    setTotal]    = useState(0);

  // Data
  const [rows,         setRows]         = useState([]);
  const [filteredRows, setFilteredRows] = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");
  const [descValues,   setDescValues]   = useState({});
  const [savingId,     setSavingId]     = useState(null);
  const [showStatusAction, setShowStatusAction] = useState(false);
  const [backendStatus,    setBackendStatus]    = useState("checking");

  // Log detail modal
  const [selectedLog, setSelectedLog] = useState(null);
  const [docGenShipment, setDocGenShipment] = useState(null); // ✅ NEW — Generate Document modal target row

  // Bulk upload
  const [visibleBulkUploadModal, setVisibleBulkUploadModal] = useState(false);

  // ── NEW: ETD Date Range Filter (top of list) ─────────────────────────────
  const [etdFromInput, setEtdFromInput] = useState("");
  const [etdToInput,   setEtdToInput]   = useState("");
  const [appliedEtdRange, setAppliedEtdRange] = useState(null); // {start,end} | null

  // ── NEW: Excel-style column filters for ETD / Supplier ETD ──────────────
  const [etdColFilter,         setEtdColFilter]         = useState(null); // {start,end,sortDir,rawFrom,rawTo}
  const [supplierEtdColFilter, setSupplierEtdColFilter] = useState(null);
  const [openColPopup, setOpenColPopup] = useState(null); // 'etd' | 'supplier_etd' | null

  // ── CHECKBOX SELECTION ───────────────────────────────────────────────────
  const [selectionMode, setSelectionMode] = useState(false); // checkboxes hidden by default
  const [selected, setSelected] = useState(new Set());

  const allSelected =
    filteredRows.length > 0 && filteredRows.every((r) => selected.has(r._id));

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredRows.map((r) => r._id)));
    }
  }

  function toggleSelectionMode() {
    setSelectionMode((prev) => {
      if (prev) setSelected(new Set()); // clear on exit
      return !prev;
    });
  }

  function toggleRow(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // Rows to export: selected if any, else all filtered
  function getExportRows() {
    if (selected.size > 0) {
      return filteredRows.filter((r) => selected.has(r._id));
    }
    return filteredRows;
  }

  // ── INITIAL LOAD ─────────────────────────────────────────────────────────
  useEffect(() => {
    API.get("/health")
      .then(() => setBackendStatus("connected"))
      .catch(() => setBackendStatus("disconnected"))
      .finally(fetchAll);
  }, []);

  // ── FETCH SHIPMENTS ───────────────────────────────────────────────────────
  function fetchAll() {
    setLoading(true);
    setError("");
   const cleanedSearch = sanitizeSearchInput(search);
    const query = `?page=${page}&pageSize=${pageSize}&search=${encodeURIComponent(cleanedSearch)}`;
    API.get(`/shipment${query}`)
      .then((res) => {
        const raw = Array.isArray(res.data) ? res.data : [];
        // Auto-calculate delivery status from ETD / Final Delivery Date
        const data = raw.map((s) => ({ ...s, delivery_status: calcDeliveryStatus(s) }));

        // ── DEBUG: verify netWtPerUnit is present in API response ────────────
        console.log("[ShipmentsList] fetchAll — raw shipments count:", data.length);
        data.forEach((s, idx) => {
          if (s.parts?.length) {
            s.parts.forEach((p, pi) => {
              const val =
                p.netWtPerUnit ?? p.part_net_unit ?? p.net_wt_unit ??
                p.netWTPerUnit ?? p.netWeightPerUnit ?? p.net_wt_per_unit;
              if (val == null) {
                console.warn(
                  `[ShipmentsList] netWtPerUnit MISSING — shipment[${idx}] enquiry_no="${s.enquiry_no}" part[${pi}]`,
                  p
                );
              }
            });
          }
        });
        // ────────────────────────────────────────────────────────────────────
        const totalCount = Number(res.headers?.["x-total-count"]);
        setRows(data);
        setFilteredRows(data);
        setTotal(Number.isFinite(totalCount) ? totalCount : data.length);
        setSelected(new Set()); // clear selection on reload
      })
      .catch((err) => {
        console.error("Failed to load shipments:", err);
        setError("Failed to load shipments");
        setRows([]);
      })
      .finally(() => setLoading(false));
  }

  // ── NEW: apply ETD range (top bar) + Excel-style column filters/sorts ────
  // Operates purely on the already-loaded `rows` data — no API/backend calls.
  useEffect(() => {
    let out = rows;
    out = filterByRange(out, "etd", appliedEtdRange);
    out = filterByRange(out, "etd", etdColFilter);
    out = filterByRange(out, "supplier_etd", supplierEtdColFilter);

    // Whichever column filter has an active sort applies last (most recent Apply wins
    // between the two columns isn't tracked separately — Supplier ETD sort takes
    // precedence if both are set, since it's evaluated second).
    const dirMap = { az: "asc", za: "desc", oldest: "asc", newest: "desc" };
    if (etdColFilter?.sortDir) out = sortByDateField(out, "etd", dirMap[etdColFilter.sortDir]);
    if (supplierEtdColFilter?.sortDir) out = sortByDateField(out, "supplier_etd", dirMap[supplierEtdColFilter.sortDir]);

    setFilteredRows(out);
  }, [rows, appliedEtdRange, etdColFilter, supplierEtdColFilter]);
  useEffect(() => { fetchAll(); }, [page, pageSize, search]);

  // ── NEW: ETD range filter bar handlers ───────────────────────────────────
  function applyEtdRangeFilter() {
    if (!etdFromInput && !etdToInput) { setAppliedEtdRange(null); return; }
    setAppliedEtdRange({
      start: etdFromInput ? toDayStart(etdFromInput) : null,
      end:   etdToInput   ? toDayStart(etdToInput)   : null,
    });
  }
  function clearEtdRangeFilter() {
    setEtdFromInput(""); setEtdToInput(""); setAppliedEtdRange(null);
  }

  // ── STATUS UPDATE ─────────────────────────────────────────────────────────
  async function updateStatus(id, status) {
    try {
      await API.patch(`/shipment/${id}`, { status });
      fetchAll();
    } catch {
      toast.error("Status update failed");
    }
  }

  const handleBulkDone = (results) => {
    setVisibleBulkUploadModal(false);
    toast.success(`Uploaded ${results.inserted} shipments!`);
    if (results.skippedDuplicates > 0)
      toast.info(`Skipped ${results.skippedDuplicates} duplicates.`);
    fetchAll();
  };

  // ── EXPORT EXCEL (full + nested parts) ───────────────────────────────────
  function exportExcel(onlySelected = false) {
    const src    = onlySelected ? filteredRows.filter((r) => selected.has(r._id)) : getExportRows();
    const label  = onlySelected && selected.size > 0 ? "selected" : "all";

    if (onlySelected && selected.size === 0) {
      toast.warn("Please select at least one shipment to export.");
      return;
    }

    // One row per part
    const rows = src.flatMap(flattenShipment);

    const ws = XLSX.utils.json_to_sheet(rows);
    // Auto-width columns
    const colWidths = Object.keys(rows[0] || {}).map((k) => ({
      wch: Math.max(k.length, ...rows.map((r) => String(r[k] ?? "").length)) + 2,
    }));
    ws["!cols"] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Shipments");
    XLSX.writeFile(wb, `shipments_${label}_${Date.now()}.xlsx`);
    toast.success(`Excel exported — ${rows.length} part row(s) from ${src.length} shipment(s)`);
  }

  // ── EXPORT PDF (full + nested parts) ─────────────────────────────────────
  function exportPDF(onlySelected = false) {
    const src   = onlySelected ? filteredRows.filter((r) => selected.has(r._id)) : getExportRows();
    const label = onlySelected && selected.size > 0 ? "selected" : "all";

    if (onlySelected && selected.size === 0) {
      toast.warn("Please select at least one shipment to export.");
      return;
    }

    const doc = new jsPDF("l", "pt", "a3");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Shipment Export Report", 40, 36);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleString()}  |  Shipments: ${src.length}`, 40, 52);

    let yCursor = 68;

    src.forEach((r, idx) => {
      // ── Shipment header block ──
      if (yCursor > doc.internal.pageSize.height - 120) {
        doc.addPage();
        yCursor = 40;
      }

      doc.setFillColor(30, 41, 59);
      doc.rect(40, yCursor, doc.internal.pageSize.width - 80, 20, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(
        `#${idx + 1}  Enquiry: ${r.enquiry_no}   |   Customer: ${safe(r.customer)}   |   Supplier: ${safe(r.supplier_name)}   |   Mode: ${safe(r.mode)}`,
        48, yCursor + 13
      );
      yCursor += 24;

      // Shipment meta row
      doc.setTextColor(30, 41, 59);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      const meta = [
        `Invoice: ${safe(r.invoice_no)}`, `Invoice Date: ${fmt(r.invoice_date)}`,
        `Incoterm: ${safe(r.incoterm)}`,  `Supplier ETD: ${fmt(r.supplier_etd)}`, `ETD: ${fmt(r.etd)}`,
        `BL No: ${safe(r.bl_no)}`,        `Container: ${safe(r.container_no)}`,
        `POL: ${safe(r.pol)}`,            `SB No: ${safe(r.sb_no)}`,
        `Final Delivery: ${fmt(r.final_delivery_date)}`,
        `Total Boxes: ${safeN(r.total_no_of_boxes)}`,
        `Total Net Wt: ${safeN(r.total_net_wt ?? r.total_net_weight ?? r.net_wt)} Kg`,
        `Total Gross Wt: ${safeN(r.total_gross_wt ?? r.total_gross_weight ?? r.gross_wt)} Kg`,
        `Delivery Status: ${safe(r.delivery_status)}`,
        `FF: ${safe(r.ff)}`,
      ];
      // Print in 3 columns
      meta.forEach((m, i) => {
        const col = i % 3;
        const colW = (doc.internal.pageSize.width - 80) / 3;
        if (i % 3 === 0 && i > 0) yCursor += 13;
        if (i === 0) yCursor += 2;
        doc.text(m, 40 + col * colW, yCursor + (Math.floor(i / 3) === 0 ? 0 : 0));
      });
      yCursor += Math.ceil(meta.length / 3) * 13 + 6;

      // ── Parts table ──
      const parts = Array.isArray(r.parts) && r.parts.length > 0 ? r.parts : [];
      if (parts.length > 0) {
        doc.autoTable({
          startY: yCursor,
          head: [[
            "#", "Part No (QMREL)", "Description",
            "Qty", "Box Size", "No of Boxes",
            "Net Wt/Unit (Kg)", "Total Net Wt (Kg)", "Gross Wt (Kg)",
          ]],
          body: parts.map((p, pi) => [
            pi + 1,
            safe(p.part_no ?? p.part_number),
            safe(p.part_desc ?? p.part_name ?? p.part_description),
            safeN(p.part_qty ?? p.qty ?? p.quantity),
            safe(p.part_box_size ?? p.box_size),
            safeN(p.part_no_of_boxes ?? p.no_of_boxes ?? p.boxes),
            safeN(p.netWtPerUnit ?? p.part_net_unit ?? p.net_wt_unit ?? p.netWTPerUnit ?? p.netWeightPerUnit ?? p.net_wt_per_unit ?? p.net_wt),
            safeN(p.part_total_net_wt ?? p.total_net_wt),
            safeN(p.part_gross ?? p.gross_wt ?? p.gross_weight),
          ]),
          styles:      { fontSize: 8, cellPadding: 4 },
          headStyles:  { fillColor: [37, 99, 235], fontSize: 8, fontStyle: "bold" },
          alternateRowStyles: { fillColor: [239, 246, 255] },
          margin: { left: 40, right: 40 },
          tableWidth: "auto",
        });
        yCursor = doc.lastAutoTable.finalY + 14;
      } else {
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text("No part details recorded.", 40, yCursor);
        yCursor += 14;
        doc.setTextColor(30, 41, 59);
      }

      // divider
      doc.setDrawColor(226, 232, 240);
      doc.line(40, yCursor, doc.internal.pageSize.width - 40, yCursor);
      yCursor += 10;
    });

    doc.save(`shipments_${label}_${Date.now()}.pdf`);
    toast.success(`PDF exported — ${src.length} shipment(s)`);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="shipments-page">
      {/* ── HEADER ── */}
      <div className="shipments-header">
        <div className="shipments-header__left">
          <h2>Shipments List</h2>
          <div className="backend-status">
            Backend:
            <span className={`status-${backendStatus}`}>
              {backendStatus === "connected"    && " 🟢 Connected"}
              {backendStatus === "disconnected" && " 🔴 Disconnected"}
              {backendStatus === "checking"     && " 🔵 Checking..."}
            </span>
          </div>
        </div>

        <div className="shipments-header__right">
          <div className="header-controls-row">
            {/* ── ETD DATE RANGE FILTER (compact, single line, moved into header) ── */}
            <div className="etd-range-bar etd-range-bar--in-header">
              <div className="etd-range-bar__field">
                <label>ETD From</label>
                <input type="date" value={etdFromInput} onChange={(e) => setEtdFromInput(e.target.value)} />
              </div>
              <div className="etd-range-bar__field">
                <label>ETD To</label>
                <input type="date" value={etdToInput} onChange={(e) => setEtdToInput(e.target.value)} />
              </div>
              <button className="btn etd-range-bar__apply" onClick={applyEtdRangeFilter}>Apply</button>
              <button className="btn etd-range-bar__clear" onClick={clearEtdRangeFilter}>Clear</button>
            </div>

            <div className="actions">
              {/* Export all — always visible */}
              <button className="btn excel" onClick={() => exportExcel(false)}>Export Excel</button>
              <button className="btn pdf"   onClick={() => exportPDF(false)}>Export PDF</button>

              {/* Toggle selection mode */}
              <button
                className={`btn select-toggle ${selectionMode ? "select-toggle--active" : ""}`}
                onClick={toggleSelectionMode}
              >
                {selectionMode ? "✕ Cancel Selection" : "☑ Select Shipments"}
              </button>

              {/* Export selected — only visible when selection mode is ON */}
              {selectionMode && (
                <>
                  <button
                    className="btn excel-sel"
                    style={{ opacity: selected.size > 0 ? 1 : 0.55 }}
                    onClick={() => exportExcel(true)}
                  >
                    Export Excel {selected.size > 0 ? `(${selected.size})` : ""}
                  </button>
                  <button
                    className="btn pdf-sel"
                    style={{ opacity: selected.size > 0 ? 1 : 0.55 }}
                    onClick={() => exportPDF(true)}
                  >
                    Export PDF {selected.size > 0 ? `(${selected.size})` : ""}
                  </button>
                </>
              )}

              <button className="btn upload" onClick={() => setVisibleBulkUploadModal(true)}>
                Upload Bulk
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── BULK UPLOAD MODAL ── */}
      {visibleBulkUploadModal && (
        <BulkShipmentUpload
          visible={visibleBulkUploadModal}
          setVisible={setVisibleBulkUploadModal}
          onDone={handleBulkDone}
        />
      )}

      {/* ── SHIPMENT DETAIL MODAL ── */}
     
{selectedLog && (
  <div className="modal-overlay" onClick={() => setSelectedLog(null)}>
    <div className="sml-modal" onClick={(e) => e.stopPropagation()}>
 
      {/* ── HEADER ─────────────────────────────────────────── */}
      <div className="sml-modal__header">
        <div className="sml-modal__header-left">
          <div className="sml-modal__icon">📦</div>
          <div>
            <div className="sml-modal__title">
              Shipment Details
            </div>
            <div className="sml-modal__enquiry">
              {selectedLog.enquiry_no}
            </div>
          </div>
        </div>
        <button
          className="sml-modal__close"
          onClick={() => setSelectedLog(null)}
        >
          &times;
        </button>
      </div>
 
      {/* ── SCROLLABLE BODY ─────────────────────────────────── */}
      <div className="sml-modal__body">
 
        {/* ── SECTION 1 : Shipment Information ── */}
        <div className="sml-section-label">
          <span className="sml-section-label__bar" />
          Shipment Information
        </div>
        <div className="sml-grid-3">
          {[
            { label: "Enquiry No",   value: selectedLog.enquiry_no,   hl: true },
            { label: "SB No",        value: selectedLog.sb_no },
            { label: "SB Date",      value: fmt(selectedLog.sb_date) },
          ].map(({ label, value, hl }) => (
            <div className="sml-cell" key={label}>
              <div className="sml-cell__label">{label}</div>
              <div className={`sml-cell__value${hl ? " sml-cell__value--hl" : ""}`}>
                {safe(value)}
              </div>
            </div>
          ))}
        </div>
 
        {/* ── SECTION 2 : Tracking & Logistics ── */}
        <div className="sml-section-label" style={{ marginTop: 18 }}>
          <span className="sml-section-label__bar" />
          Tracking &amp; Logistics
        </div>
        <div className="sml-grid-3">
          {[
            { label: "ETD",          value: fmt(selectedLog.etd) },
            { label: "Supplier ETD", value: fmt(selectedLog.supplier_etd) },
            { label: "Final Delivery", value: fmt(selectedLog.final_delivery_date) },
          ].map(({ label, value }) => (
            <div className="sml-cell" key={label}>
              <div className="sml-cell__label">{label}</div>
              <div className="sml-cell__value">{safe(value)}</div>
            </div>
          ))}
 
          {/* Delivery Status — special badge cell */}
          <div className="sml-cell">
            <div className="sml-cell__label">Delivery Status</div>
            <div className="sml-cell__value">
              {(() => {
                const st  = calcDeliveryStatus(selectedLog);
                const cfg = STATUS_CFG[st] || STATUS_CFG["IN_PROCESS"];
                const hint = getDateHint(st, selectedLog);
                return (
                  <>
                    <span
                      className="sml-status-badge"
                      style={{
                        background: cfg.bg,
                        color:      cfg.color,
                        border:     `1px solid ${cfg.border}`,
                      }}
                    >
                      {cfg.label}
                    </span>
                    {hint && (
                      <div className="sml-status-hint">{hint}</div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
 

              {/* ── Weight Totals ── */}
              <div className="sml-section-title" style={{ marginTop: 16 }}>Weight & Boxes</div>
              <div className="sml-totals-row">
                <div className="sml-total-cell">
                  <div className="sml-total-label">Total Boxes</div>
                  <div className="sml-total-value">{safeN(selectedLog.total_no_of_boxes)}</div>
                </div>
                <div className="sml-total-cell">
                  <div className="sml-total-label">Total Net Wt (Kg)</div>
                 <div className="sml-total-value">{fmtNetWt(selectedLog.total_net_wt ?? selectedLog.total_net_weight)}</div>
                </div>
                <div className="sml-total-cell">
                  <div className="sml-total-label">Total Gross Wt (Kg)</div>
                  <div className="sml-total-value">{safeN(selectedLog.total_gross_wt ?? selectedLog.total_gross_weight)}</div>
                </div>
              </div>

              <div className="sml-parts-heading">Part / QMREL Details</div>
              <div style={{ overflowX: "auto" }}>
                <table className="modal-parts-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Part No</th>
                      <th>Description</th>
                      <th>Qty</th>
                      <th>Box Size</th>
                      <th>No of Boxes</th>
                      <th>Net Wt/Unit(Kg)</th>
                      <th>Total Net Wt(Kg)</th>
                      <th>Gross Wt(Kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedLog.parts?.length > 0 ? selectedLog.parts : [selectedLog]).map((p, i) => (
                      <tr key={i}>
                         <td>
                    <span className="sml-part-num">{i + 1}</span>
                  </td>
                        <td>{safe(p.part_no ?? p.part_number)}</td>
                        <td>{safe(p.part_desc ?? p.part_name ?? p.part_description)}</td>
                        <td>{safeN(p.part_qty ?? p.qty ?? p.quantity)}</td>
                        <td>{safe(p.part_box_size ?? p.box_size)}</td>
                        <td>{safeN(p.part_no_of_boxes ?? p.no_of_boxes ?? p.boxes)}</td>
                        <td>{safeN(p.netWtPerUnit ?? p.part_net_unit ?? p.net_wt_unit ?? p.netWTPerUnit ?? p.netWeightPerUnit ?? p.net_wt_per_unit ?? p.net_wt)}</td>
                         <td>{safeN(p.part_total_net_wt ?? p.total_net_wt ?? (() => {
                          const qty = p.part_qty ?? p.qty ?? p.quantity ?? 0;
                          const netWtUnit = p.netWtPerUnit ?? p.part_net_unit ?? p.net_wt_unit ?? p.netWTPerUnit ?? p.netWeightPerUnit ?? p.net_wt_per_unit ?? 0;
                          return qty && netWtUnit ? qty * netWtUnit : null;
                        })())}</td>
                        <td>{safeN(p.part_gross ?? p.gross_wt ?? p.gross_weight)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SEARCH ── */}
      <div className="search-bar">
        <input
          placeholder="Search by Enquiry / Part No / BL No / Supplier / Customer / Mode "
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="reset" onClick={() => setSearch("")}>Reset</button>
      </div>

      {/* Selection info bar — only in selection mode */}
      {selectionMode && selected.size > 0 && (
        <div className="selection-bar">
          <span>✅ {selected.size} shipment(s) selected</span>
          <button className="sel-clear" onClick={() => setSelected(new Set())}>Clear selection</button>
        </div>
      )}

      {/* ── TABLE ── */}
      <div className="table-wrap">
        {loading && <div className="table-loading">Loading...</div>}
        {error   && <div className="table-error">{error}</div>}

        <table>
          <thead>
            <tr>
              {/* Checkbox column — only shown in selection mode */}
              {selectionMode && (
                <th style={{ width: 36, textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    title="Select all"
                    style={{ cursor: "pointer" }}
                  />
                </th>
              )}
              <th>Enquiry No</th>
              <th>FF</th>
              <th>Invoice No</th>
              <th>Invoice Date</th>
              <th>Supplier</th>
              <th>Customer</th>
              <th>Incoterm</th>
              <th>Mode</th>
              <th colSpan={2}>Parts</th>
              <th>Total Boxes</th>
              <th>Total Net Wt</th>
              <th>Total Gross Wt</th>
              <th className="col-filterable">
                <span className="col-filterable__label" onClick={() => setOpenColPopup(openColPopup === "supplier_etd" ? null : "supplier_etd")}>
                  Supplier ETD <span className="col-filter-icon">▾</span>
                </span>
                {openColPopup === "supplier_etd" && (
                  <ColumnDateFilterPopup
                    title="Supplier ETD"
                    initial={supplierEtdColFilter}
                    onApply={(cfg) => { setSupplierEtdColFilter(cfg); setOpenColPopup(null); }}
                    onReset={() => { setSupplierEtdColFilter(null); setOpenColPopup(null); }}
                    onClose={() => setOpenColPopup(null)}
                  />
                )}
              </th>
              <th className="col-filterable">
                <span className="col-filterable__label" onClick={() => setOpenColPopup(openColPopup === "etd" ? null : "etd")}>
                  ETD <span className="col-filter-icon">▾</span>
                </span>
                {openColPopup === "etd" && (
                  <ColumnDateFilterPopup
                    title="ETD"
                    initial={etdColFilter}
                    onApply={(cfg) => { setEtdColFilter(cfg); setOpenColPopup(null); }}
                    onReset={() => { setEtdColFilter(null); setOpenColPopup(null); }}
                    onClose={() => setOpenColPopup(null)}
                  />
                )}
              </th>
              <th>BL No</th>
              <th>Container No</th>
              <th>POL</th>
              <th>Action</th>
              <th>Delivery Status</th>
              <th onClick={() => setShowStatusAction((p) => !p)} style={{ cursor: "pointer" }}>
                Invalid {showStatusAction ? "▲" : "▼"}
              </th>
              <th>Manual Desc</th>
              <th>Generate Document</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => (
              <tr
                key={r._id}
                className={[
                  r.status === "CANCELLED" ? "row-cancelled" : "",
                  selected.has(r._id)      ? "row-selected"  : "",
                ].join(" ").trim()}
              >
                {/* Checkbox — only shown in selection mode */}
                {selectionMode && (
                  <td style={{ textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={selected.has(r._id)}
                      onChange={() => toggleRow(r._id)}
                      style={{ cursor: "pointer" }}
                    />
                  </td>
                )}

                <td
                  style={{ color: "#007bff", cursor: "pointer", textDecoration: "underline", fontWeight: "bold" }}
                  onClick={() => setSelectedLog(r)}
                >
                  {r.enquiry_no}
                </td>
                <td>{safe(r.ff)}</td>
                <td>{safe(r.invoice_no)}</td>
                <td>{fmt(r.invoice_date)}</td>
                <td>{safe(r.supplier_name)}</td>
                <td>{safe(r.customer)}</td>
                <td>{safe(r.incoterm)}</td>
                <td><span className={`badge ${r.mode?.toLowerCase()}`}>{r.mode}</span></td>

               {/* Parts cell */}
                <td colSpan={2} style={{ verticalAlign: "top", padding: "4px 6px", width: "1%", whiteSpace: "nowrap" }}>
                  {r.parts && r.parts.length > 0
                    ? r.parts.map((p, i) => (
                        <div key={i} style={{
                          display: "flex", alignItems: "flex-start", gap: 6,
                          padding: "3px 6px",
                          marginBottom: i < r.parts.length - 1 ? 3 : 0,
                          background: i % 2 === 0 ? "#f8f9ff" : "#fff",
                          border: "1px solid #e3e8f0", borderRadius: 6, width: "fit-content", minWidth: 0,
                        }}>
                          <span style={{
                            minWidth: 15, height: 15, borderRadius: "50%",
                            background: "#4a6cf7", color: "#fff",
                            fontSize: 8, fontWeight: 700,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0, marginTop: 2,
                          }}>{i + 1}</span>
                          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                            <span style={{ fontWeight: 600, fontSize: 9, color: "#1a1a2e" }}>
                              {safe(p.part_no ?? p.part_number)}
                            </span>
                            <span style={{ fontSize: 9, color: "#555" }}>
                              {safe(p.part_desc ?? p.part_name ?? p.part_description)}
                            </span>
                          </div>
                        </div>
                      ))
                    : (
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{ fontWeight: 600, fontSize: 9 }}>{safe(r.part_no ?? r.part_number)}</span>
                        <span style={{ fontSize: 9, color: "#555" }}>{safe(r.part_desc ?? r.part_name)}</span>
                      </div>
                    )}
                </td>

                <td>{safeN(r.total_no_of_boxes)}</td>
                <td>{fmtNetWt(r.total_net_wt ?? r.total_net_weight ?? r.net_wt)}</td>
                <td>{safeN(r.total_gross_wt ?? r.total_gross_weight ?? r.gross_wt)}</td>
                <td>{fmt(r.supplier_etd)}</td>
                <td>{fmt(r.etd)}</td>
                <td>{safe(r.bl_no)}</td>
                <td>{safe(r.container_no)}</td>
                <td>{safe(r.pol)}</td>

                <td>
                  <button
                    className="edit-btn"
                    disabled={r.status === "CANCELLED"}
                    onClick={() => {
                      // ── Normalize netWtPerUnit across all known naming variants ──────
                      const normalizedParts = (r.parts ?? []).map((p) => {
                        const netWtPerUnit =
                          p.netWtPerUnit     ??   // camelCase (preferred)
                          p.part_net_unit    ??   // legacy snake_case variant 1
                          p.net_wt_unit      ??   // legacy snake_case variant 2
                          p.netWTPerUnit     ??   // alternate camel variant
                          p.netWeightPerUnit ??   // long-form camel variant
                          p.net_wt_per_unit  ??   // long-form snake_case
                          null;

                        console.log(
                          `[ShipmentsList] Edit clicked — enquiry_no="${r.enquiry_no}" part_no="${p.part_no ?? p.part_number}" netWtPerUnit resolved:`,
                          netWtPerUnit,
                          "| raw part:", p
                        );

                        return { ...p, netWtPerUnit };
                      });

                      const editPayload = { ...r, parts: normalizedParts };

                      console.log(
                        "[ShipmentsList] navigating to edit — full payload:",
                        editPayload
                      );

                      navigate(`/logistics/${r._id}`, { state: editPayload });
                    }}
                  >✏️</button>
                </td>

                <td style={{ minWidth: 130 }}>
                  {(() => {
                    const status = r.delivery_status || "IN_PROCESS";
                    const cfg    = STATUS_CFG[status] || STATUS_CFG["IN_PROCESS"];
                    const hint   = getDateHint(status, r);
                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {/* Auto-calculated status badge */}
                        <div style={{
                          display: "inline-flex", alignItems: "center",
                          background: cfg.bg, color: cfg.color,
                          border: `1px solid ${cfg.border}`,
                          borderRadius: 20, padding: "2px 7px",
                          fontSize: 9, fontWeight: 700, width: "fit-content",
                        }}>
                          {cfg.label}
                        </div>
                        {/* Date hint line */}
                        {hint && (
                          <div style={{ fontSize: 9, color: "#64748B", paddingLeft: 2 }}>
                            {hint}
                          </div>
                        )}
                        {/* Manual override dropdown */}
                         <select
                    className={`delivery-select ${r.delivery_status || "IN_PROCESS"}`}
                    value={r.delivery_status || "IN_PROCESS"}
                    onChange={async (e) => {
                      try {
                        await API.patch(`/shipment/delivery-status/${r._id}`, { delivery_status: e.target.value });
                        fetchAll();
                      } catch { toast.error("Failed to update delivery status"); }
                    }}
                  >
                    <option value="IN_PROCESS">In Process</option>
                    <option value="IN_TRANSIT">In Transit</option>
                    <option value="DELIVERED">Final Delivered</option>
                  </select>
                      </div>
                    );
                  })()}
                </td>

                <td>
                  {showStatusAction && (r.status === "CANCELLED"
                    ? <button className="btn-undo"   onClick={() => updateStatus(r._id, "ACTIVE")}>Undo</button>
                    : <button className="btn-cancel" onClick={() => updateStatus(r._id, "CANCELLED")}>Cancel</button>
                  )}
                </td>

                <td>
                  <input
                    type="text"
                    className="desc-input"
                    placeholder="Add description"
                    value={descValues[r._id] ?? r.manual_desc ?? ""}
                    onChange={(e) => setDescValues((prev) => ({ ...prev, [r._id]: e.target.value }))}
                  />
                  <button
                    className="btn small"
                    disabled={savingId === r._id}
                    onClick={async () => {
                      try {
                        setSavingId(r._id);
                        await API.patch(`/shipment/manual-desc/${r._id}`, { manual_desc: descValues[r._id] });
                        toast.success("Description saved ✅");
                        fetchAll();
                      } catch { toast.error("Failed to save description ❌"); }
                      finally { setSavingId(null); }
                    }}
                  >
                    {savingId === r._id ? "Saving..." : "Save"}
                  </button>
                </td>

                <td>
                  <button className="btn small" onClick={() => setDocGenShipment(r)}>
                    Generate Document
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── PAGINATION ── */}
      <div className="pagination">
        <button disabled={page === 1} onClick={() => setPage(page - 1)}>⬅ Prev</button>
        <span>Page <strong>{page}</strong> of {totalPages}</span>
        <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next ➡</button>
        <select
          value={pageSize >= ALL_ENTRIES ? "all" : String(pageSize)}
          onChange={(e) => {
            const newSize = e.target.value === "all" ? ALL_ENTRIES : Number(e.target.value);
            setPageSize(newSize);
            setPage(1);
            try {
              window.localStorage.setItem(PAGE_SIZE_STORAGE_KEY, e.target.value === "all" ? "all" : String(newSize));
            } catch (err) {
              // ignore — persistence is a nice-to-have, not a hard requirement
            }
          }}
        >
          <option value="5">5</option>
          <option value="10">10</option>
          <option value="20">20</option>
          <option value="50">50</option>
          <option value="100">100</option>
          <option value="all">All Entries</option>
        </select>
      </div>

      {/* ✅ NEW — Generate Document modal */}
      {docGenShipment && (
        <GenerateDocumentModal
          shipment={docGenShipment}
          onClose={() => setDocGenShipment(null)}
        />
      )}
    </div>
  );
}
