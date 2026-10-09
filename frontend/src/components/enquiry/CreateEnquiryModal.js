import React, { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import { loadEnquiryDraft, saveEnquiryDraft, markEnquiryDraftClosed, clearEnquiryDraft, isDraftEmpty } from "./draft";

const EMPTY_FORM = {
  customerName: "",
  customerRFQDate: "",
  itemDescription: "",
  enquiryNumberMode: "auto",
  enquiryNumber: "",
  customerPartNo: "",
  customerPartName: "",
  modifiedBOPartNo: "",
  boPartName: "",
  supplierName: "",
  poNumber: "",
  dateOfIssue: "",
};

/* ── SVG icon helpers ── */
const IconBO = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
  </svg>
);
const IconPart = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
  </svg>
);
const IconPO = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>
);
const IconSparkle = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74z"/>
  </svg>
);
const IconWand = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/>
    <path d="M17.8 11.8L19 13"/><path d="M15 9h.01"/>
    <path d="M17.8 6.2L19 5"/><path d="M3 21l9-9"/><path d="M12.2 6.2L11 5"/>
  </svg>
);
const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconClose = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const IconPlus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2"/>
  </svg>
);
const IconChevron = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);
const IconParentTag = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="3"/>
  </svg>
);
const IconChildTag = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18l6-6-6-6"/>
  </svg>
);
const IconAlert = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

/* ─────────────────────────────────────────────
   Helper: derive prefix from customer name
───────────────────────────────────────────── */
function derivePrefix(name) {
  if (!name) return "";
  return name.trim().charAt(0).toUpperCase();
}

/* ─────────────────────────────────────────────
   Helper: extract first/last N digits from part no
───────────────────────────────────────────── */
function extractDigits(partNo, position = "first", count = 3) {
  if (!partNo) return "0".repeat(count);
  // Step 1: replace every symbol with "0", keep alphabets and numbers as-is
  // e.g. "BH-015" → "BH0015"  |  "AB@12" → "AB012"  |  "12#34$56" → "12034056"
  const converted = partNo.replace(/[^A-Za-z0-9]/g, "0");
  if (!converted) return "0".repeat(count);
  // Step 2: left-pad with zeros if shorter than 6
  // e.g. "BH015"(5) → "0BH015"  |  "XYZ"(3) → "000XYZ"  |  "12345"(5) → "012345"
  const padded = converted.length < count * 2
    ? converted.padStart(count * 2, "0")
    : converted;
  // Step 3: first 3 and last 3 of the padded value
  if (position === "first") return padded.slice(0, count);
  if (position === "last")  return padded.slice(-count);
  return "";
}
/* ─────────────────────────────────────────────
   BO Part Number generation — now INLINE (no side panel).
   Formula is unchanged:  <customer prefix> + "B" + <first 3> + <process code> + <last 3>
───────────────────────────────────────────── */
const COMPANY_CODES    = ["FAB","MAC","FOR","CAS","FAS","ASM","STA","FMC","CMC","RUB","PLA","LAS","PIN"];
const FIXED_PREFIX     = "B";
// The old builder always started with "ZET" (it just wasn't in its dropdown, so the dropdown
// showed "FAB" while the number used "ZET"). It is now a real, visible option and the default.
const BO_DEFAULT_CODE  = "ZET";
const PROCESS_CODES    = [BO_DEFAULT_CODE, ...COMPANY_CODES];

function buildBOPartNo(customerName, customerPartNo, code) {
  return `${derivePrefix(customerName)}${FIXED_PREFIX}${extractDigits(customerPartNo, "first", 3)}${code}${extractDigits(customerPartNo, "last", 3)}`;
}

/* ─────────────────────────────────────────────
   Parts Details — helpers
───────────────────────────────────────────── */
let __partIdSeq = 0;
const newPartId = () => `part_${Date.now()}_${(__partIdSeq++)}_${Math.random().toString(36).slice(2, 7)}`;

const makeEmptyPart = () => ({
  id: newPartId(),
  customerPartNo: "",
  customerPartName: "",
  modifiedBOPartNo: "",
  boPartName: "",
  isChildPart: false,
  collapsed: false,
  children: [],
  itemDescription: "",   // part-specific description (optional)
  showItemDesc: false,   // UI only: is the description box open?
  boNumberMode: "auto",  // "auto" | "customerPartNumber"
  boAutoMemo: null,      // UI only: last auto-generated BO No, restored when switching back

  boProcessCode: BO_DEFAULT_CODE, // UI only
  // "null"  = not yet answered the Yes/No child-part prompt
  // "yes"   = user chose to add child parts (existing Add Child Part UI shown)
  // "no"    = user chose to skip child parts for this parent part
  childDecision: null,
});

const makeEmptyChildPart = () => ({
  id: newPartId(),
  customerPartNo: "",
  customerPartName: "",
  modifiedBOPartNo: "",
  boPartName: "",
  isChildPart: true,
  itemDescription: "",
  showItemDesc: false,
  boNumberMode: "auto",
  boAutoMemo: null,

  boProcessCode: BO_DEFAULT_CODE, // UI only
});

/* ─────────────────────────────────────────────
   BO Number mode toggle (per part / child part)
   "auto"               → existing BO Part Number Builder, unchanged
   "customerPartNumber" → BO Number mirrors the Customer Part No
───────────────────────────────────────────── */
function BONumberModeToggle({ name, mode, onChange }) {
  return (
    <div className="bo-mode-toggle" role="radiogroup" aria-label="BO Number mode">
      <span className="bo-mode-toggle-label">BO Number</span>
      <label className={mode !== "customerPartNumber" ? "selected" : ""}>
        <input type="radio" name={name} checked={mode !== "customerPartNumber"} onChange={() => onChange("auto")} />
        Auto Generate
      </label>
      <label className={mode === "customerPartNumber" ? "selected" : ""}>
        <input type="radio" name={name} checked={mode === "customerPartNumber"} onChange={() => onChange("customerPartNumber")} />
        Same as Customer Part Number
      </label>
    </div>
  );
}

/* Process Code dropdown + Generate button, shown inline in the BO Number strip. */
function BOGenerateControl({ code, hasValue, canGenerate, onCodeChange, onGenerate }) {
  return (
    <div className="bo-gen-inline">
      <label className="bo-code-label">Process Code</label>
      <select className="bo-code-select" value={code || BO_DEFAULT_CODE} onChange={(e) => onCodeChange(e.target.value)} aria-label="Process code">
        {PROCESS_CODES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <button
        type="button"
        className="bo-generate-btn"
        onClick={onGenerate}
        disabled={!canGenerate}
        title={canGenerate ? "" : "Enter the Customer Part No first"}
      >
        <span className="bo-generate-btn-icon"><IconWand /></span>
        {hasValue ? "Rebuild BO Part Number" : "Generate BO Part Number"}
      </button>
    </div>
  );
}

/* Optional part-specific Item Description. Hidden behind "+ Add Item Description"
   so nobody is forced to type one; with none, the common description applies. */
function PartItemDescription({ shown, value, onShow, onChange, onRemove }) {
  if (!shown) {
    return (
      <div className="item-desc-cell">
        <label className="part-label">Item Description</label>
        <button type="button" className="item-desc-add-btn" onClick={onShow}>
          <IconPlus /> Add Item Description
        </button>
      </div>
    );
  }
  return (
    <div className="item-desc-box item-desc-cell">
      <div className="item-desc-head">
        <label className="part-label" title="This description applies to this part only">Item Description (own)</label>
        <button type="button" className="item-desc-remove-btn" onClick={onRemove} title="Remove — use the common Item Description" aria-label="Use common Item Description">
          <IconClose />
        </button>
      </div>
      <input
        type="text"
        placeholder="Enter description..."
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={!value}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main Modal
───────────────────────────────────────────── */
export default function CreateEnquiryModal({
  isOpen,
  onClose,
  onSubmit,
  editData,
  isSubmitting,
  existingSuppliers, // optional string[] — powers the supplier suggestion dropdown
}) {
  const isEdit = !!editData;
  const supplierOptions = Array.isArray(existingSuppliers) ? existingSuppliers : [];

  const getInitialForm = () => {
    if (editData) {
      return {
        customerName: editData.customerName || "",
        customerRFQDate: editData.customerRFQDate
          ? new Date(editData.customerRFQDate).toISOString().split("T")[0]
          : "",
        itemDescription: editData.itemDescription || "",
        enquiryNumberMode: "manual",
        enquiryNumber: editData.enquiryNumber || "",
        customerPartNo: editData.partMapping?.customerPartNo || "",
        customerPartName: editData.partMapping?.customerPartName || "",
        modifiedBOPartNo: editData.partMapping?.modifiedBOPartNo || "",
        boPartName: editData.partMapping?.boPartName || "",
        supplierName: editData.poDetails?.supplierName || "",
        poNumber: editData.poDetails?.poNumber || "",
        dateOfIssue: editData.poDetails?.dateOfIssue
          ? new Date(editData.poDetails.dateOfIssue).toISOString().split("T")[0]
          : "",
      };
    }
    return { ...EMPTY_FORM };
  };

  /* ── Parts Details: build initial parent/child parts from editData ── */
  const getInitialParts = () => {
    if (editData) {
      // New-format records: use the stored parts hierarchy as-is.
      if (Array.isArray(editData.parts) && editData.parts.length > 0) {
        return editData.parts.map((p) => ({
          id: newPartId(),
          customerPartNo: p.customerPartNo || "",
          customerPartName: p.customerPartName || "",
          modifiedBOPartNo: p.modifiedBOPartNo || "",
          boPartName: p.boPartName || "",
          itemDescription: p.itemDescription || "",
          showItemDesc: !!p.itemDescription,
          boNumberMode: p.boNumberMode === "customerPartNumber" ? "customerPartNumber" : "auto",
          boAutoMemo: null,

          boProcessCode: BO_DEFAULT_CODE, // UI only
          isChildPart: false,
          collapsed: false,
          // If this part already has saved child parts, treat the prompt as
          // already answered "Yes" so existing data keeps displaying as-is.
          childDecision: Array.isArray(p.children) && p.children.length > 0 ? "yes" : null,
          children: Array.isArray(p.children)
            ? p.children.map((c) => ({
                id: newPartId(),
                customerPartNo: c.customerPartNo || "",
                customerPartName: c.customerPartName || "",
                modifiedBOPartNo: c.modifiedBOPartNo || "",
                boPartName: c.boPartName || "",
                itemDescription: c.itemDescription || "",
                showItemDesc: !!c.itemDescription,
                boNumberMode: c.boNumberMode === "customerPartNumber" ? "customerPartNumber" : "auto",
                boAutoMemo: null,

                boProcessCode: BO_DEFAULT_CODE, // UI only
                isChildPart: true,
              }))
            : [],
        }));
      }
      // Backward compatibility: older single-part records only have
      // `partMapping` — surface it as the first parent part.
      const pm = editData.partMapping || {};
      if (pm.customerPartNo || pm.customerPartName || pm.modifiedBOPartNo || pm.boPartName) {
        return [
          {
            id: newPartId(),
            customerPartNo: pm.customerPartNo || "",
            customerPartName: pm.customerPartName || "",
            modifiedBOPartNo: pm.modifiedBOPartNo || "",
            boPartName: pm.boPartName || "",
            itemDescription: "",
            showItemDesc: false,
            boNumberMode: "auto",
            boAutoMemo: null,

            boProcessCode: BO_DEFAULT_CODE, // UI only
            isChildPart: false,
            collapsed: false,
            children: [],
            childDecision: null,
          },
        ];
      }
      return [makeEmptyPart()];
    }
    return [makeEmptyPart()];
  };

  const [activeTab, setActiveTab]       = useState("bo");
  const [form, setForm]                 = useState(getInitialForm);
  const [parts, setParts]               = useState(getInitialParts);
  const [partsError, setPartsError]     = useState("");
  const [supplierDraft, setSupplierDraft] = useState({}); // { [partId]: "supplier name being typed" }
  const [supplierPoDraft, setSupplierPoDraft] = useState({}); // { [partId]: "PO number being typed" }
  const [supplierDateDraft, setSupplierDateDraft] = useState({}); // { [partId]: "date of issue being typed" }
  const [partSuppliers, setPartSuppliers] = useState({}); // { [partId]: [{ name, poNumber, dateOfIssue }] }
  const submitLockRef = useRef(false); // synchronous double-submit guard, see handleSubmit
  // Draft auto-save (create flow only). draftReady flips true only AFTER a saved draft has been
  // restored, so the first (still-empty) render can never overwrite what was saved.
  const [draftReady, setDraftReady] = useState(false);
  const [draftInfo, setDraftInfo]   = useState({ restoredAt: null, savedAt: null });
  const draftSnapRef  = useRef(null);   // latest form snapshot
  const draftDirtyRef = useRef(false);  // typed but not yet written (debounce pending)

  // Release the lock once the parent reports the request has finished
  // (success or failure) so a legitimate next save isn't blocked forever.
  useEffect(() => {
    if (!isSubmitting) submitLockRef.current = false;
  }, [isSubmitting]);

  // Also release the lock whenever the modal is (re)opened, in case it was
  // closed mid-request.
  useEffect(() => {
    if (isOpen) submitLockRef.current = false;
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setForm(getInitialForm());
      const initialParts = getInitialParts();
      setParts(initialParts);
      setPartsError("");
      setActiveTab("bo");
      setSupplierDraft({});
      setSupplierPoDraft({});
      setSupplierDateDraft({});
      // Hydrate per-part supplier assignments, matched by Customer Part No.
      // Normalize legacy string[] suppliers into { name, poNumber, dateOfIssue } objects.
      const savedPS = Array.isArray(editData?.partSuppliers) ? editData.partSuppliers : [];
      const hydrated = {};
      initialParts.forEach((p) => {
        const match = savedPS.find((s) => s.customerPartNo === p.customerPartNo);
        const rawSuppliers = match ? match.suppliers || [] : [];
        hydrated[p.id] = rawSuppliers.map((s) =>
          typeof s === "string"
            ? { name: s, poNumber: "", dateOfIssue: "" }
            : { name: s.name || "", poNumber: s.poNumber || "", dateOfIssue: s.dateOfIssue || "" }
        );
      });
      setPartSuppliers(hydrated);

      // ── Restore an auto-saved draft (new enquiries only) ──
      if (!editData) {
        const d = loadEnquiryDraft();
        if (d && !isDraftEmpty(d, EMPTY_FORM)) {
          setForm({ ...EMPTY_FORM, ...d.form });
          setParts(d.parts);
          setPartSuppliers(d.partSuppliers || {});
          setSupplierDraft(d.supplierDraft || {});
          setSupplierPoDraft(d.supplierPoDraft || {});
          setSupplierDateDraft(d.supplierDateDraft || {});
          setActiveTab(d.activeTab === "po" ? "po" : "bo");
          setDraftInfo({ restoredAt: d.savedAt, savedAt: d.savedAt });
        } else {
          setDraftInfo({ restoredAt: null, savedAt: null });
        }
        setDraftReady(true);
      }
    } else {
      setDraftReady(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editData]);

  // ── Auto-save: debounced while typing + flushed immediately on refresh / tab close ──
  useEffect(() => {
    if (!isOpen || editData || !draftReady) return undefined;
    const snap = { form, parts, partSuppliers, supplierDraft, supplierPoDraft, supplierDateDraft, activeTab };
    draftSnapRef.current = snap;
    draftDirtyRef.current = true;
    const write = () => {
      draftDirtyRef.current = false;
      if (isDraftEmpty(snap, EMPTY_FORM)) { clearEnquiryDraft(); return null; }
      return saveEnquiryDraft(snap);
    };
    const timer = setTimeout(() => {
      const ok = write();
      if (ok) setDraftInfo((prev) => ({ ...prev, savedAt: Date.now() }));
    }, 500);
    const flush = () => { clearTimeout(timer); write(); };
    window.addEventListener("beforeunload", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("beforeunload", flush);
      window.removeEventListener("pagehide", flush);
    };
  }, [isOpen, editData, draftReady, form, parts, partSuppliers, supplierDraft, supplierPoDraft, supplierDateDraft, activeTab]);

  // When the form is closed (Cancel / ✕), keep the draft but don't reopen it after a refresh.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (wasOpenRef.current && !isOpen && !editData) {
      // Closed within the debounce window? Save the last keystrokes first.
      const snap = draftSnapRef.current;
      if (draftDirtyRef.current && snap && !isDraftEmpty(snap, EMPTY_FORM)) saveEnquiryDraft(snap);
      draftDirtyRef.current = false;
      markEnquiryDraftClosed();
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, editData]);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  /* ── Draft: discard the saved draft and start from a blank form ── */
  const discardDraft = () => {
    clearEnquiryDraft();
    setForm({ ...EMPTY_FORM });
    setParts(getInitialParts());
    setPartSuppliers({});
    setSupplierDraft({});
    setSupplierPoDraft({});
    setSupplierDateDraft({});
    setPartsError("");
    setActiveTab("bo");
    setDraftInfo({ restoredAt: null, savedAt: null });
    toast.info("Draft discarded");
  };
  const draftTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  /* ── Parts Details: CRUD helpers ── */
  const addPart = () => setParts((prev) => [...prev, makeEmptyPart()]);

  const removePart = (id) =>
    setParts((prev) => prev.filter((p) => p.id !== id));

  const updatePartField = (id, field, value) =>
    setParts((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const next = { ...p, [field]: value };
        // "Same as Customer Part Number": BO No follows every Customer Part No edit.
        if (field === "customerPartNo" && p.boNumberMode === "customerPartNumber") {
          next.modifiedBOPartNo = value;
        }
        return next;
      })
    );

  const togglePartCollapse = (id) =>
    setParts((prev) => prev.map((p) => (p.id === id ? { ...p, collapsed: !p.collapsed } : p)));

  const addChildPart = (parentId) =>
    setParts((prev) =>
      prev.map((p) =>
        p.id === parentId ? { ...p, children: [...(p.children || []), makeEmptyChildPart()] } : p
      )
    );

  /* ── Child Part confirmation (Yes/No) — records the user's choice per Parent Part ── */
  const setChildDecision = (parentId, decision) =>
    setParts((prev) =>
      prev.map((p) => (p.id === parentId ? { ...p, childDecision: decision } : p))
    );

  /* ── Supplier assignment — a Part can have multiple suppliers, each with its own PO Number and Date of Issue (PO Details tab) ── */
  const addSupplierToPart = (partId, rawValue, rawPoNumber, rawDateOfIssue) => {
    const value = (rawValue || "").trim();
    if (!value) {
      toast.error("Enter a supplier name before clicking Add Supplier.");
      return;
    }
    const poNumber = (rawPoNumber || "").trim();
    const dateOfIssue = (rawDateOfIssue || "").trim();

    const current = partSuppliers[partId] || [];
    // avoid case-insensitive duplicates on supplier name
    const isDuplicate = current.some((s) => s.name.toLowerCase() === value.toLowerCase());
    if (isDuplicate) {
      toast.error(`"${value}" is already added for this part. Edit or remove the existing chip first.`);
      return;
    }

    setPartSuppliers((prev) => {
      const list = prev[partId] || [];
      return { ...prev, [partId]: [...list, { name: value, poNumber, dateOfIssue }] };
    });
    setSupplierDraft((prev) => ({ ...prev, [partId]: "" }));
    setSupplierPoDraft((prev) => ({ ...prev, [partId]: "" }));
    setSupplierDateDraft((prev) => ({ ...prev, [partId]: "" }));
  };

  const removeSupplierFromPart = (partId, supplierName) =>
    setPartSuppliers((prev) => ({
      ...prev,
      [partId]: (prev[partId] || []).filter((s) => s.name !== supplierName),
    }));

  // Click a chip to load it back into the input row for editing (name, PO, date)
  const editSupplierChip = (partId, supplier) => {
    setSupplierDraft((prev) => ({ ...prev, [partId]: supplier.name }));
    setSupplierPoDraft((prev) => ({ ...prev, [partId]: supplier.poNumber || "" }));
    setSupplierDateDraft((prev) => ({ ...prev, [partId]: supplier.dateOfIssue || "" }));
    removeSupplierFromPart(partId, supplier.name); // pulled out of the list while it's being edited
  };

  const removeChildPart = (parentId, childId) =>
    setParts((prev) =>
      prev.map((p) =>
        p.id === parentId ? { ...p, children: (p.children || []).filter((c) => c.id !== childId) } : p
      )
    );

  const updateChildField = (parentId, childId, field, value) =>
    setParts((prev) =>
      prev.map((p) =>
        p.id === parentId
          ? {
              ...p,
              children: (p.children || []).map((c) => {
                if (c.id !== childId) return c;
                const next = { ...c, [field]: value };
                if (field === "customerPartNo" && c.boNumberMode === "customerPartNumber") {
                  next.modifiedBOPartNo = value;
                }
                return next;
              }),
            }
          : p
      )
    );

  /* ── Generate the BO Part Number inline (parent part: childId = null) ── */
  const findItem = (parentId, childId) => {
    const parent = parts.find((p) => p.id === parentId);
    return childId ? (parent?.children || []).find((c) => c.id === childId) : parent;
  };
  const generateBO = (parentId, childId = null) => {
    const item = findItem(parentId, childId);
    if (!item) return;
    if (!(item.customerPartNo || "").trim()) { toast.error("Enter the Customer Part No first."); return; }
    const value = buildBOPartNo(form.customerName, item.customerPartNo, item.boProcessCode || BO_DEFAULT_CODE);
    if (childId) updateChildField(parentId, childId, "modifiedBOPartNo", value);
    else updatePartField(parentId, "modifiedBOPartNo", value);
  };

  /* ── BO Number mode switch (parent part: childId = null)
     auto → customerPartNumber : BO No := Customer Part No (previous auto value is remembered)
     customerPartNumber → auto : restore the remembered auto value if still valid for the current
                                 Customer Part No; otherwise generate it again with the same formula. */
  const changeBONumberMode = (parentId, childId, mode) => {
    const item = findItem(parentId, childId);
    if (!item || item.boNumberMode === mode) return;

    let patch;
    if (mode === "customerPartNumber") {
      patch = {
        boNumberMode: mode,
        boAutoMemo: item.modifiedBOPartNo
          ? { value: item.modifiedBOPartNo, src: item.customerPartNo }
          : item.boAutoMemo || null,
        modifiedBOPartNo: item.customerPartNo,
      };
    } else {
      const memo = item.boAutoMemo;
      let restore = "";
      if (memo && memo.src === item.customerPartNo) restore = memo.value;
      else if ((item.customerPartNo || "").trim()) restore = buildBOPartNo(form.customerName, item.customerPartNo, item.boProcessCode || BO_DEFAULT_CODE);
      patch = { boNumberMode: mode, modifiedBOPartNo: restore };
    }

    if (childId) {
      setParts((prev) =>
        prev.map((p) =>
          p.id === parentId
            ? { ...p, children: (p.children || []).map((c) => (c.id === childId ? { ...c, ...patch } : c)) }
            : p
        )
      );
    } else {
      setParts((prev) => prev.map((p) => (p.id === parentId ? { ...p, ...patch } : p)));
    }
  };


  /* ── Validation: parent part no mandatory, child part no mandatory if added, no duplicates ── */
  const validateParts = () => {
    const seen = new Set();
    for (const p of parts) {
      if (!p.customerPartNo || !p.customerPartNo.trim()) {
        return "Parent Part Number (Customer Part No) is mandatory for every part added.";
      }
      const key = p.customerPartNo.trim().toLowerCase();
      if (seen.has(key)) return `Duplicate part number found: "${p.customerPartNo}". Part numbers must be unique within an enquiry.`;
      seen.add(key);

      for (const c of (p.children || [])) {
        if (!c.customerPartNo || !c.customerPartNo.trim()) {
          return "Child Part Number is mandatory for every child part added.";
        }
        const ckey = c.customerPartNo.trim().toLowerCase();
        if (seen.has(ckey)) return `Duplicate part number found: "${c.customerPartNo}". Part numbers must be unique within an enquiry.`;
        seen.add(ckey);
      }
    }
    return "";
  };

  const handleSubmit = () => {
    // Instant, synchronous guard against double-submit races (e.g. a fast
    // double-click, or clicking again while a slow/cold-starting backend
    // hasn't responded yet). isSubmitting is a prop updated via React state,
    // which lags one render behind the click — this ref closes that gap
    // immediately so a second click can never slip a second request through.
    if (submitLockRef.current || isSubmitting) return;
    submitLockRef.current = true;

    // Editing a saved enquiry: its (now editable) Enquiry Number can't be blank.
    if (isEdit && !(form.enquiryNumber || "").trim()) {
      submitLockRef.current = false;
      toast.error("Enquiry Number cannot be empty.");
      setActiveTab("bo");
      return;
    }

    const validationMessage = validateParts();
    if (validationMessage) {
      submitLockRef.current = false;
      setPartsError(validationMessage);
      setActiveTab("bo"); // Enquiry & Part Details is now a single tab
      return;
    }
    setPartsError("");

    // If the user typed a supplier name/PO/Date but never clicked "Add Supplier"
    // (or pressed Enter), that draft text would otherwise be silently lost on save.
    // Auto-commit any non-empty leftover drafts into the supplier list here, per part,
    // right before the payload is built — without mutating existing entries.
    const effectivePartSuppliers = { ...partSuppliers };
    parts.forEach((p) => {
      const draftName = (supplierDraft[p.id] || "").trim();
      if (!draftName) return; // nothing left in the input for this part — nothing to do
      const draftPo = (supplierPoDraft[p.id] || "").trim();
      const draftDate = (supplierDateDraft[p.id] || "").trim();
      const current = effectivePartSuppliers[p.id] || [];
      const alreadyExists = current.some((s) => s.name.toLowerCase() === draftName.toLowerCase());
      if (!alreadyExists) {
        effectivePartSuppliers[p.id] = [...current, { name: draftName, poNumber: draftPo, dateOfIssue: draftDate }];
      }
    });

    // Clean UI-only fields (id/collapsed) before sending to the API.
    const cleanParts = parts.map(({ id, collapsed, children, childDecision, showItemDesc, boAutoMemo, boProcessCode, ...rest }) => ({
      ...rest,
      isChildPart: false,
      children: (children || []).map(({ id: childId, showItemDesc: _s, boAutoMemo: _m, boProcessCode: _c, ...childRest }) => ({
        ...childRest,
        isChildPart: true,
      })),
    }));

    // Mirror the first parent part into `partMapping` so every existing
    // API consumer (list, search, stats, table) that reads partMapping.*
    // keeps working exactly as before, unchanged.
    const firstPart = parts[0] || {};

    const payload = {
      customerName: form.customerName,
      customerRFQDate: form.customerRFQDate || null,
      itemDescription: form.itemDescription,
      enquiryNumber:
        form.enquiryNumberMode === "auto" ? "auto" : form.enquiryNumber,
      partMapping: {
        customerPartNo: firstPart.customerPartNo || "",
        customerPartName: firstPart.customerPartName || "",
        modifiedBOPartNo: firstPart.modifiedBOPartNo || "",
        boPartName: firstPart.boPartName || "",
      },
     parts: cleanParts,
poDetails: (() => {
  const firstPartWithSupplier = parts.find(
    (p) => (effectivePartSuppliers[p.id] || []).length > 0
  );
  const firstSupplier = firstPartWithSupplier
    ? effectivePartSuppliers[firstPartWithSupplier.id][0]
    : null;
  return {
    supplierName: firstSupplier?.name || form.supplierName || "",
    poNumber: firstSupplier?.poNumber || form.poNumber || "",
    dateOfIssue: firstSupplier?.dateOfIssue || form.dateOfIssue || null,
  };
})(),
      // Multiple suppliers assigned per Part, keyed by that part's Customer Part No.
      // Each supplier now carries its own poNumber and dateOfIssue alongside its name.
      partSuppliers: parts.map((p) => ({
        customerPartNo: p.customerPartNo || "",
        suppliers: effectivePartSuppliers[p.id] || [],
      })),
    };
    if (isEdit) payload.enquiryNumber = (form.enquiryNumber || "").trim();
    draftDirtyRef.current = false; // submitted: don't re-save this content as a draft when the form closes
    onSubmit(payload);
  };

  const tabs = [
    { key: "bo", label: "Enquiry & Part Details", Icon: IconBO },
    { key: "po", label: "Supplier PO Details", Icon: IconPO },
  ];

  return (
    <>
      {/* ── Scoped styles for the Enquiry modal ── */}
      <style>{`
        /* BO field trigger button inside form */
        .bo-field-trigger-wrap {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .bo-filled-display {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #f5f3ff;
          border: 1.5px solid #a78bfa;
          border-radius: 8px;
          padding: 7px 11px;
          font-size: 13px;
          font-weight: 700;
          color: #5b21b6;
          letter-spacing: 0.04em;
        }
        .bo-filled-clear {
          border: none;
          background: none;
          cursor: pointer;
          color: #9ca3af;
          padding: 0;
          display: flex;
          align-items: center;
          transition: color 0.15s;
        }
        .bo-filled-clear:hover { color: #ef4444; }
        .bo-generate-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          border: 1.5px dashed #a78bfa;
          border-radius: 8px;
          background: #faf5ff;
          color: #7c3aed;
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          width: 100%;
          justify-content: center;
        }
        .bo-generate-btn:hover {
          background: #f0e6ff;
          border-color: #7c3aed;
          box-shadow: 0 2px 8px rgba(124,58,237,0.12);
        }
        .bo-generate-btn-icon {
          width: 22px;
          height: 22px;
          border-radius: 6px;
          background: linear-gradient(135deg, #7c3aed, #a855f7);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
        }

        /* ─────────────────────────────────────────────
           Parts Details tab
        ───────────────────────────────────────────── */
        .parts-title-row {
          justify-content: space-between;
          width: 100%;
        }
        .add-part-btn {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 7px 13px;
          border: none;
          border-radius: 8px;
          background: linear-gradient(135deg, #7c3aed, #a855f7);
          color: #fff;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: opacity 0.15s, transform 0.12s;
          box-shadow: 0 2px 8px rgba(124,58,237,0.25);
          position: relative;
          z-index: 1;
        }
        .add-part-btn:hover { opacity: 0.92; transform: translateY(-1px); }
        .add-part-btn-bottom {
          margin: 12px 0 0;
          width: 100%;
          justify-content: center;
          padding: 9px 14px;
          font-size: 12.5px;
        }

        .parts-error-banner {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #fef2f2;
          border: 1.5px solid #fecaca;
          color: #b91c1c;
          font-size: 12px;
          font-weight: 600;
          border-radius: 8px;
          padding: 9px 13px;
          margin-bottom: 12px;
          position: relative;
          z-index: 1;
        }

        .parts-empty-state {
          background: rgba(255,255,255,0.7);
          border: 1.5px dashed #c4b5fd;
          border-radius: 10px;
          padding: 20px;
          text-align: center;
          color: #6b7280;
          font-size: 13px;
          position: relative;
          z-index: 1;
        }

        .parts-list {
          display: flex;
          flex-direction: column;
          gap: 11px;
          position: relative;
          z-index: 1;
        }

        /* Parent part card */
        .part-card {
          background: #fff;
          border: 1.5px solid #ddd6fe;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 1px 4px rgba(124,58,237,0.06);
        }
        .part-card-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 13px;
          background: linear-gradient(135deg, #f5f3ff, #f3e8ff);
          border-bottom: 1px solid #ede9fe;
        }
        .part-collapse-btn {
          border: none;
          background: #fff;
          width: 25px;
          height: 25px;
          border-radius: 7px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #7c3aed;
          flex-shrink: 0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
        }
        .part-collapse-btn .chevron {
          display: flex;
          transition: transform 0.18s;
          transform: rotate(0deg);
        }
        .part-collapse-btn .chevron.open {
          transform: rotate(90deg);
        }

        .part-badge {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          font-weight: 700;
          padding: 4px 9px;
          border-radius: 999px;
          flex-shrink: 0;
        }
        .parent-badge {
          background: #7c3aed;
          color: #fff;
        }
        .child-badge {
          background: #c4b5fd;
          color: #3b0764;
        }

        .part-card-summary {
          font-size: 12.5px;
          font-weight: 700;
          color: #4c1d95;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .child-count-chip {
          font-size: 10.5px;
          font-weight: 600;
          color: #7c3aed;
          background: #fff;
          border: 1px solid #ddd6fe;
          padding: 3px 8px;
          border-radius: 999px;
          flex-shrink: 0;
        }

        .part-card-header .remove-part-btn {
          margin-left: auto;
        }

        .remove-part-btn, .remove-child-btn {
          display: flex;
          align-items: center;
          gap: 5px;
          border: 1.5px solid #fecaca;
          background: #fff;
          color: #dc2626;
          font-size: 11px;
          font-weight: 700;
          padding: 5px 9px;
          border-radius: 7px;
          cursor: pointer;
          transition: all 0.15s;
          flex-shrink: 0;
          white-space: nowrap;
        }
        .remove-part-btn:hover, .remove-child-btn:hover {
          background: #fef2f2;
          border-color: #fca5a5;
        }

        .part-card-body {
          padding: 13px;
        }

        /* Child parts nested tree */
        .child-parts-wrap {
          margin-top: 6px;
          padding-left: 20px;
          border-left: 2px dashed #ddd6fe;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .child-part-row {
          display: flex;
          gap: 8px;
          position: relative;
        }
        .child-part-connector {
          width: 18px;
          height: 22px;
          margin-left: -22px;
          border-bottom: 2px dashed #ddd6fe;
          border-left: 2px dashed transparent;
          flex-shrink: 0;
        }
        .child-part-content {
          flex: 1;
          background: #faf9ff;
          border: 1.5px solid #ede9fe;
          border-radius: 10px;
          padding: 10px;
        }
        .child-part-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 9px;
        }
        .child-part-header .remove-child-btn {
          margin-left: auto;
        }
        .child-fields-grid {
          margin-bottom: 9px;
        }
        .child-fields-grid .tab-field-card {
          background: #fff;
        }

        .add-child-part-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px 13px;
          border: 1.5px dashed #a78bfa;
          border-radius: 8px;
          background: #fff;
          color: #7c3aed;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s;
          width: fit-content;
        }
        .add-child-part-btn:hover {
          background: #f5f3ff;
          border-color: #7c3aed;
        }

        /* Child Part Yes/No confirmation prompt */
        .child-confirm-box {
          margin-top: 6px;
          padding: 11px 13px;
          background: #faf9ff;
          border: 1.5px dashed #ddd6fe;
          border-radius: 10px;
          display: flex;
          flex-direction: column;
          gap: 9px;
        }
        .child-confirm-text {
          font-size: 12px;
          font-weight: 600;
          color: #4c1d95;
        }
        .child-confirm-actions {
          display: flex;
          gap: 8px;
        }
        .child-confirm-yes-btn,
        .child-confirm-no-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 15px;
          border-radius: 7px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s;
        }
        .child-confirm-yes-btn {
          border: none;
          background: linear-gradient(135deg, #7c3aed, #a855f7);
          color: #fff;
          box-shadow: 0 2px 8px rgba(124,58,237,0.25);
        }
        .child-confirm-yes-btn:hover { opacity: 0.92; }
        .child-confirm-no-btn {
          border: 1.5px solid #e5e7eb;
          background: #fff;
          color: #374151;
        }
        .child-confirm-no-btn:hover { background: #f9fafb; border-color: #d1d5db; }

        /* Shown after the user answers "No" — lets them change their mind */
        .child-decision-skipped {
          margin-top: 6px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 8px 13px;
          background: #f9fafb;
          border: 1px dashed #e5e7eb;
          border-radius: 8px;
          font-size: 11.5px;
          color: #6b7280;
        }
        .child-decision-change-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          border: none;
          background: none;
          color: #7c3aed;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          padding: 0;
          flex-shrink: 0;
          white-space: nowrap;
        }
        .child-decision-change-btn:hover { text-decoration: underline; }

        @media (max-width: 640px) {
          .part-card-header { flex-wrap: wrap; }
          .child-parts-wrap { padding-left: 12px; }
        }

        /* ─────────────────────────────────────────────
           Supplier assignment (PO Details tab)
        ───────────────────────────────────────────── */
        .supplier-assign-section {
          margin-top: 14px;
          padding-top: 13px;
          border-top: 1.5px dashed #e5e7eb;
        }
        .supplier-assign-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12.5px;
          font-weight: 700;
          color: #065f46;
          margin-bottom: 10px;
        }
        .supplier-assign-empty {
          background: rgba(255,255,255,0.7);
          border: 1.5px dashed #a7f3d0;
          border-radius: 10px;
          padding: 15px;
          text-align: center;
          color: #6b7280;
          font-size: 12.5px;
        }
        .supplier-part-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .supplier-part-row {
          background: #fff;
          border: 1.5px solid #bbf7d0;
          border-radius: 10px;
          padding: 10px 13px;
        }
        .supplier-part-label {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 9px;
        }
        .supplier-part-no {
          font-size: 12px;
          font-weight: 700;
          color: #15803d;
        }
        .supplier-chip-list {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 9px;
          min-height: 22px;
        }
        .supplier-chip-empty {
          font-size: 11.5px;
          color: #9ca3af;
          font-style: italic;
        }
        .supplier-chip {
          display: flex;
          align-items: center;
          gap: 5px;
          background: #d1fae5;
          color: #065f46;
          font-size: 11px;
          font-weight: 700;
          padding: 4px 6px 4px 10px;
          border-radius: 999px;
        }
        /* visually separates the PO number/date from the supplier name inside the chip */
        .supplier-chip-po {
          font-weight: 600;
          color: #047857;
          opacity: 0.85;
        }
        /* the clickable name/PO/date portion of the chip (everything except the ✕ remove button) */
        .supplier-chip-text {
          display: flex;
          align-items: center;
          gap: 5px;
          cursor: pointer;
        }
        .supplier-chip-remove {
          border: none;
          background: none;
          cursor: pointer;
          color: #065f46;
          opacity: 0.6;
          display: flex;
          align-items: center;
          padding: 2px;
          border-radius: 50%;
          transition: all 0.15s;
        }
        .supplier-chip-remove:hover { opacity: 1; background: rgba(6,95,70,0.12); }
        .supplier-input-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .supplier-input {
          flex: 1 1 160px;
          min-width: 140px;
          border: 1.5px solid #e5e7eb;
          border-radius: 7px;
          padding: 7px 9px;
          font-size: 12.5px;
          color: #111;
          background: #fff;
          outline: none;
          transition: border-color 0.15s;
        }
        .supplier-input:focus {
          border-color: #10b981;
          box-shadow: 0 0 0 3px rgba(16,185,129,0.12);
        }
        .supplier-po-input {
          flex: 1 1 130px;
          min-width: 110px;
          border: 1.5px solid #e5e7eb;
          border-radius: 7px;
          padding: 7px 9px;
          font-size: 12.5px;
          color: #111;
          background: #fff;
          outline: none;
          transition: border-color 0.15s;
        }
        .supplier-po-input:focus {
          border-color: #10b981;
          box-shadow: 0 0 0 3px rgba(16,185,129,0.12);
        }
        .supplier-date-input {
          flex: 1 1 130px;
          min-width: 110px;
          border: 1.5px solid #e5e7eb;
          border-radius: 7px;
          padding: 7px 9px;
          font-size: 12.5px;
          color: #111;
          background: #fff;
          outline: none;
          transition: border-color 0.15s;
        }
        .supplier-date-input:focus {
          border-color: #10b981;
          box-shadow: 0 0 0 3px rgba(16,185,129,0.12);
        }
        .supplier-add-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 7px 13px;
          border: none;
          border-radius: 7px;
          background: linear-gradient(135deg, #10b981, #34d399);
          color: #fff;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
          transition: opacity 0.15s, transform 0.12s;
          box-shadow: 0 2px 8px rgba(16,185,129,0.25);
        }
        .supplier-add-btn:hover { opacity: 0.92; transform: translateY(-1px); }

        /* ── Inline BO generator: Process Code + Generate ── */
        .bo-gen-inline { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .bo-code-label { font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: #6b7280; white-space: nowrap; }
        .bo-code-select {
          padding: 6px 28px 6px 10px; border: 1.5px solid #ddd6fe; border-radius: 8px; background: #fff;
          font-size: 12.5px; font-weight: 700; color: #6d28d9; cursor: pointer; width: auto; min-width: 74px;
        }
        .bo-code-select:focus { outline: none; border-color: #7c3aed; box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.15); }
        .bo-generate-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .enq-form .bo-gen-inline { flex: 0 0 auto; gap: 8px; order: 1; flex-wrap: nowrap; }
        .enq-form .bo-filled-display { order: 2; }
        .enq-form .bo-code-select { padding: 5px 26px 5px 9px; }

        /* ── Draft auto-save ── */
        .draft-banner {
          display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
          margin-bottom: 10px; padding: 8px 12px; border-radius: 10px;
          background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; font-size: 12.5px;
        }
        .draft-banner-text { flex: 1 1 260px; }
        .draft-banner-btn {
          border: 1px solid #6ee7b7; background: #fff; color: #047857; border-radius: 8px;
          padding: 4px 10px; font-size: 12px; font-weight: 600; cursor: pointer;
        }
        .draft-banner-btn:hover { background: #d1fae5; }
        .draft-banner-x { border: none; background: none; color: #059669; cursor: pointer; font-size: 13px; padding: 2px 4px; }
        .draft-status { margin-right: auto; align-self: center; font-size: 12px; font-weight: 600; color: #059669; }

        /* ── BO Number mode toggle ── */
        .bo-mode-toggle {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px 12px;
          font-size: 12px;
        }
        .bo-mode-toggle-label {
          font-size: 10.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #6b7280;
        }
        .bo-mode-toggle label {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          cursor: pointer;
          font-weight: 600;
          color: #4b5563;
        }
        .bo-mode-toggle label.selected { color: #6d28d9; }
        .bo-mode-toggle input[type="radio"] { accent-color: #7c3aed; margin: 0; width: auto; }
        .bo-filled-display.bo-linked { background: #f0fdf4; border-color: #86efac; color: #166534; }
        .bo-filled-display.bo-linked em { font-weight: 400; color: #9ca3af; }
        .bo-linked-tag { font-size: 10px; font-weight: 600; letter-spacing: 0; color: #15803d; }

        /* ── Part-specific Item Description ── */
        .item-desc-hint { display: block; margin-top: 5px; font-size: 11px; color: #6b7280; }
        .item-desc-add-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 4px;
          padding: 6px 11px;
          border: 1.5px dashed #a78bfa;
          border-radius: 8px;
          background: #faf5ff;
          color: #7c3aed;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
        }
        .item-desc-add-btn:hover { background: #f0e6ff; border-color: #7c3aed; }
        .item-desc-box { margin-top: 4px; display: flex; flex-direction: column; gap: 5px; }
        .item-desc-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .item-desc-remove-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          border: none;
          background: none;
          color: #9ca3af;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
        }
        .item-desc-remove-btn:hover { color: #ef4444; }

        /* ═════════════════════════════════════════════════════════════
           COMPACT FORM LAYOUT — scoped to .enq-form (Create/Edit Enquiry)
           Fields flow side-by-side so the whole form fits on screen.
        ═════════════════════════════════════════════════════════════ */
        .modal-container.enq-form {
          width: min(1240px, 97vw);
          max-height: 97vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border-radius: 14px;
        }
        .enq-form .modal-header { padding: 14px 24px 8px; padding-right: 56px; flex-shrink: 0; }
        .enq-form .modal-header h2 { font-size: 20px; margin: 0; }
        .enq-form .modal-header p { display: none; }
        .enq-form .modal-close-btn { top: 12px; right: 16px; width: 28px; height: 28px; }
        .enq-form .modal-divider { margin: 0 24px; }
        .enq-form .modal-tabs { margin: 10px 24px 0; padding: 3px; flex-shrink: 0; }
        .enq-form .modal-tab { padding: 6px 14px; font-size: 13px; }
        .enq-form .modal-body { padding: 10px 24px; flex: 1 1 auto; min-height: 0; overflow-y: auto; }
        .enq-form .modal-footer { padding: 10px 24px 14px; flex-shrink: 0; background: #fff; }
        .enq-form .modal-cancel-btn,
        .enq-form .modal-submit-btn { padding: 8px 22px; font-size: 13.5px; }

        /* Section cards */
        .enq-form .tab-section { padding: 12px 14px; border-radius: 12px; margin-bottom: 10px; }
        .enq-form .tab-section:last-child { margin-bottom: 0; }
        .enq-form .tab-section-blob { display: none; }
        .enq-form .tab-section-title { font-size: 14px; margin-bottom: 8px; gap: 8px; }
        .enq-form .tab-section-title .section-icon { width: 26px; height: 26px; border-radius: 8px; }
        .enq-form .tab-section-title .section-icon svg { width: 14px; height: 14px; }

        /* Field cards become tight label-over-input cells */
        .enq-form .tab-fields-grid { gap: 8px; margin-bottom: 0; }
        .enq-form .tab-field-card { padding: 7px 10px; gap: 3px; border-radius: 8px; min-width: 0; }
        .enq-form .tab-field-card label { font-size: 11.5px; }
        .enq-form .tab-field-card input:not([type="radio"]) { padding: 6px 9px; font-size: 13px; border-radius: 7px; box-sizing: border-box; width: 100%; min-width: 0; }

        /* Row 1: Enquiry No | Customer | RFQ date | Item description */
        .enq-form .tab-fields-grid.enq-row-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); align-items: start; }
        .enq-form .enquiry-gen-section { margin: 0; padding: 7px 10px; border-radius: 8px; background: #fff; }
        .enq-form .enquiry-gen-title { font-size: 11.5px; margin-bottom: 4px; }
        .enq-form .enquiry-gen-options { margin-bottom: 6px; }
        .enq-form .enquiry-gen-info { display: none; } /* radios already say "Auto Generate" */
        .enq-form .enquiry-gen-input { margin-top: 6px; }
        .enq-form .enquiry-gen-input input { padding: 5px 9px; font-size: 12.5px; box-sizing: border-box; width: 100%; }

        /* Parts: header + ONE row per part.
           The two stacked field grids inside a card are flattened (display: contents)
           so their cells flow into a single 5-column row:
           Customer Part No | Part Name | BO Number | BO Part Name | Item Description */
        .enq-form .parts-title-row { margin-bottom: 8px; }
        .enq-form .add-part-btn { padding: 5px 11px; font-size: 11.5px; }
        .enq-form .add-part-btn-bottom { width: auto; margin: 8px 0 0; padding: 6px 14px; font-size: 12px; }
        .enq-form .parts-error-banner { padding: 6px 10px; margin-bottom: 8px; font-size: 11.5px; }
        .enq-form .parts-list { gap: 8px; }
        .enq-form .part-card { border-radius: 10px; }
        .enq-form .part-card-header { padding: 5px 10px; gap: 8px; }
        .enq-form .part-collapse-btn { width: 22px; height: 22px; }
        .enq-form .part-badge { font-size: 10.5px; padding: 3px 8px; }
        .enq-form .remove-part-btn,
        .enq-form .remove-child-btn { padding: 3px 8px; font-size: 10.5px; }
        .enq-form .part-card-body,
        .enq-form .child-part-content {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
          align-items: start;
        }
        .enq-form .part-card-body { padding: 8px 10px; }
        .enq-form .part-card-body > .tab-fields-grid,
        .enq-form .child-part-content > .tab-fields-grid { display: contents; }
        /* BO Number cell gets more room (mode toggle + value + button) */
        .enq-form .part-card-body > .tab-fields-grid:nth-of-type(1),
        .enq-form .part-card-body > .tab-fields-grid:nth-of-type(2) { order: 0; }
        .enq-form .part-card-body > .child-parts-wrap,
        .enq-form .part-card-body > .child-confirm-box,
        .enq-form .part-card-body > .child-decision-skipped { grid-column: 1 / -1; order: 10; }
        .enq-form .child-part-content > .child-part-header { grid-column: 1 / -1; }

        /* BO Number: full-width strip → [label] [Auto | Same as CPN] [value] [Generate] */
        .enq-form .bo-number-cell {
          grid-column: 1 / -1;
          order: 5;
          flex-direction: row;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px 18px;
          padding: 8px 12px;
          background: #faf8ff;
          border-color: #e9e0ff;
        }
        .enq-form .bo-number-cell > .part-label { flex: 0 0 auto; margin: 0; font-size: 12px; }
        .enq-form .bo-field-trigger-wrap {
          flex: 1 1 460px;
          min-width: 0;
          display: flex;
          flex-direction: row;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px 12px;
        }
        .enq-form .bo-filled-display { flex: 1 1 200px; min-width: 0; margin: 0; padding: 6px 10px; font-size: 12.5px; border-radius: 8px; }
        .enq-form .bo-linked-tag { display: none; }
        .enq-form .bo-generate-btn { flex: 0 0 auto; width: auto; margin: 0; padding: 6px 14px; font-size: 12px; gap: 7px; white-space: nowrap; }
        .enq-form .bo-generate-btn-icon { width: 18px; height: 18px; }

        /* Segmented toggle (replaces loose radios) */
        .enq-form .bo-mode-toggle,
        .enq-form .enquiry-gen-options {
          display: inline-flex;
          flex: 0 0 auto;
          align-items: stretch;
          gap: 2px;
          padding: 2px;
          border-radius: 9px;
          background: #ede9fe;
          margin: 0;
        }
        .enq-form .enquiry-gen-options { display: flex; background: #e0ecff; }
        .enq-form .bo-mode-toggle-label { display: none; }
        .enq-form .bo-mode-toggle label,
        .enq-form .enquiry-gen-options label {
          position: relative;
          flex: 1 1 auto;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 5px 12px;
          border-radius: 7px;
          font-size: 12px;
          font-weight: 600;
          line-height: 1.2;
          color: #6b7280;
          white-space: nowrap;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
        }
        .enq-form .bo-mode-toggle label.selected { background: #fff; color: #6d28d9; box-shadow: 0 1px 3px rgba(76, 29, 149, 0.18); }
        .enq-form .enquiry-gen-options label.selected { background: #fff; color: #2563eb; box-shadow: 0 1px 3px rgba(37, 99, 235, 0.18); }
        .enq-form .bo-mode-toggle input[type="radio"],
        .enq-form .enquiry-gen-options input[type="radio"] {
          position: absolute; opacity: 0; width: 0; height: 0; margin: 0; padding: 0; pointer-events: none;
        }
        .enq-form .bo-mode-toggle label:focus-within,
        .enq-form .enquiry-gen-options label:focus-within { outline: 2px solid #a78bfa; outline-offset: 1px; }

        /* Item description cell */
        .enq-form .item-desc-cell { margin: 0; background: #fff; border: 1px solid rgba(0,0,0,0.06); border-radius: 8px; padding: 7px 10px; gap: 3px; display: flex; flex-direction: column; min-width: 0; }
        .enq-form .item-desc-cell .part-label { font-size: 11.5px; font-weight: 600; color: #7c3aed; margin: 0; white-space: nowrap; }
        .enq-form .item-desc-head { min-width: 0; }
        .enq-form .item-desc-remove-btn { flex-shrink: 0; padding: 2px; }
        .enq-form .item-desc-add-btn { margin: 0; justify-content: center; padding: 0 10px; font-size: 11.5px; width: 100%; box-sizing: border-box; height: 31px; }
        .enq-form .item-desc-box input { padding: 6px 9px; font-size: 13px; border: 1px solid #e5e7eb; border-radius: 7px; width: 100%; box-sizing: border-box; }

        /* Child parts */
        .enq-form .child-parts-wrap { margin-top: 2px; padding-left: 14px; gap: 6px; }
        .enq-form .child-part-content { padding: 6px 8px; border-radius: 8px; }
        .enq-form .child-part-header { margin: 0; }
        .enq-form .child-part-connector { height: 16px; }
        .enq-form .add-child-part-btn { padding: 5px 10px; font-size: 11.5px; }
        .enq-form .child-confirm-box { margin-top: 0; padding: 6px 10px; flex-direction: row; align-items: center; justify-content: space-between; gap: 10px; }
        .enq-form .child-confirm-yes-btn,
        .enq-form .child-confirm-no-btn { padding: 4px 12px; }
        .enq-form .child-decision-skipped { margin-top: 0; padding: 5px 10px; }

        /* Supplier PO tab */
        .enq-form .supplier-assign-section { padding: 10px 12px; }
        .enq-form .supplier-part-list { gap: 8px; }
        .enq-form .supplier-part-row { padding: 8px 10px; gap: 6px; }

        /* Narrower screens: fewer columns, still no wasted space */
        @media (max-width: 1100px) {
          .enq-form .tab-fields-grid.enq-row-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .enq-form .part-card-body,
          .enq-form .child-part-content { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 640px) {
          .enq-form .tab-fields-grid.enq-row-4,
          .enq-form .part-card-body,
          .enq-form .child-part-content { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-container enq-form" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="modal-header">
            <h2>{isEdit ? "Edit Enquiry" : "Create New Enquiry"}</h2>
            <p>
              {isEdit
                ? "Update the enquiry details below."
                : "Fill in the details below to create a new enquiry record. You can add information across both sections."}
            </p>
            <button className="modal-close-btn" onClick={onClose}>✕</button>
          </div>

          <hr className="modal-divider" />

          {/* Tabs */}
          <div className="modal-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                className={`modal-tab${activeTab === tab.key ? " active" : ""}`}
                onClick={() => setActiveTab(tab.key)}
              >
                <span className="modal-tab-icon"><tab.Icon /></span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="modal-body">
            {!isEdit && draftInfo.restoredAt && (
              <div className="draft-banner" role="status">
                <span className="draft-banner-text">
                  <strong>Draft restored</strong> — your earlier entries (saved at {draftTime(draftInfo.restoredAt)}) are back. Changes are saved automatically.
                </span>
                <button type="button" className="draft-banner-btn" onClick={discardDraft}>Discard draft &amp; start fresh</button>
                <button type="button" className="draft-banner-x" aria-label="Dismiss" onClick={() => setDraftInfo((p) => ({ ...p, restoredAt: null }))}>✕</button>
              </div>
            )}
            {/* ─── BO / Enquiry & Part Mapping ─── */}
            {activeTab === "bo" && (
              <>
                <div className="tab-section bo-section">
                  <div className="tab-section-blob bo-blob" />
                  <div className="tab-section-title">
                    <span className="section-icon bo"><IconBO /></span>
                    BO / Enquiry Details
                  </div>
                  {/* One compact row of fields. Create: Customer | RFQ | Item Desc | Enquiry No. generation.
                      Edit: Enquiry Number (now editable) | Customer | RFQ | Item Desc. */}
                  <div className="tab-fields-grid enq-row-4">
                    {/* Saved enquiries only: the generated number may be corrected. Create flow is unchanged. */}
                    {isEdit && (
                      <div className="tab-field-card">
                        <label className="bo-label required">Enquiry Number</label>
                        <input
                          type="text"
                          placeholder="e.g. ENQ-26-015"
                          value={form.enquiryNumber}
                          onChange={(e) => handleChange("enquiryNumber", e.target.value)}
                        />
                      </div>
                    )}
                    <div className="tab-field-card">
                      <label className="bo-label required">Customer Name</label>
                      <input type="text" placeholder="Enter customer name" value={form.customerName} onChange={(e) => handleChange("customerName", e.target.value)} />
                    </div>
                    <div className="tab-field-card">
                      <label className="bo-label required">Customer RFQ Date</label>
                      <input type="date" placeholder="dd-mm-yyyy" value={form.customerRFQDate} onChange={(e) => handleChange("customerRFQDate", e.target.value)} />
                    </div>
                    <div className="tab-field-card">
                      <label className="bo-label">Item Description</label>
                      <input type="text" placeholder="Common description for all parts" title="Common description for all parts. A part can have its own via “+ Add Item Description” in Part Details." value={form.itemDescription} onChange={(e) => handleChange("itemDescription", e.target.value)} />
                    </div>

                    {/* Enquiry Number Generation (create only — logic unchanged) */}
                    {!isEdit && (
                      <div className="enquiry-gen-section">
                        <div className="enquiry-gen-title">
                          <IconSparkle /> Enquiry No. Generation
                        </div>
                        <div className="enquiry-gen-options">
                          <label className={form.enquiryNumberMode === "auto" ? "selected" : ""}>
                            <input type="radio" name="enquiryMode" checked={form.enquiryNumberMode === "auto"} onChange={() => handleChange("enquiryNumberMode", "auto")} />
                            Auto Generate
                          </label>
                          <label className={form.enquiryNumberMode === "manual" ? "selected" : ""}>
                            <input type="radio" name="enquiryMode" checked={form.enquiryNumberMode === "manual"} onChange={() => handleChange("enquiryNumberMode", "manual")} />
                            Manual Entry
                          </label>
                        </div>
                        {form.enquiryNumberMode === "auto" ? (
                          <div className="enquiry-gen-info">
                            <span className="gen-icon"><IconSparkle /></span>
                            <span>
                              Enquiry No. will be auto-generated<br />
                              <span className="gen-example">Example: ENQ-2024-001, ENQ-2024-002, etc.</span>
                            </span>
                          </div>
                        ) : (
                          <div className="enquiry-gen-input">
                            <input type="text" placeholder="Enter enquiry number (e.g. ENQ-2024-001)" value={form.enquiryNumber} onChange={(e) => handleChange("enquiryNumber", e.target.value)} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ─── Parts Details (multiple parent + child parts) ─── */}
            {activeTab === "bo" && (
              <div className="tab-section part-section">
                <div className="tab-section-blob part-blob" />
                <div className="tab-section-title parts-title-row">
                  <span className="section-icon part"><IconPart /></span>
                  Parts Details
                  <button
                    type="button"
                    className="add-part-btn"
                    onClick={addPart}
                  >
                    <IconPlus /> Add Parent Part
                  </button>
                </div>

                {partsError && (
                  <div className="parts-error-banner">
                    <IconAlert /> {partsError}
                  </div>
                )}

                {parts.length === 0 ? (
                  <div className="parts-empty-state">
                    No parts added yet. A default part will be created automatically — use “Add Child Part” within it to add child parts.
                  </div>
                ) : (
                  <div className="parts-list">
                    {parts.map((part, pIdx) => {
                      const kids = part.children || []; // guard: never undefined
                      return (
                      <div className="part-card" key={part.id}>
                        <div className="part-card-header">
                          <button
                            type="button"
                            className="part-collapse-btn"
                            onClick={() => togglePartCollapse(part.id)}
                            title={part.collapsed ? "Expand" : "Collapse"}
                          >
                            <span className={`chevron${part.collapsed ? "" : " open"}`}><IconChevron /></span>
                          </button>
                          <span className="part-badge parent-badge"><IconParentTag /> Parent Part {pIdx + 1}</span>
                          {part.customerPartNo && <span className="part-card-summary">{part.customerPartNo}</span>}
                          {kids.length > 0 && (
                            <span className="child-count-chip">{kids.length} child part{kids.length > 1 ? "s" : ""}</span>
                          )}
                          <button
                            type="button"
                            className="remove-part-btn"
                            title="Remove Part"
                            onClick={() => removePart(part.id)}
                          >
                            <IconTrash /> Remove Part
                          </button>
                        </div>

                        {!part.collapsed && (
                          <div className="part-card-body">
                            <div className="tab-fields-grid">
                              <div className="tab-field-card">
                                <label className="part-label required">Customer Part No</label>
                                <input
                                  type="text"
                                  placeholder="Enter customer part no"
                                  value={part.customerPartNo}
                                  onChange={(e) => updatePartField(part.id, "customerPartNo", e.target.value)}
                                />
                              </div>
                              <div className="tab-field-card">
                                <label className="part-label">Customer Part Name</label>
                                <input
                                  type="text"
                                  placeholder="Enter customer part name"
                                  value={part.customerPartName}
                                  onChange={(e) => updatePartField(part.id, "customerPartName", e.target.value)}
                                />
                              </div>
                            </div>
                            <div className="tab-fields-grid">
                              <div className="tab-field-card bo-number-cell">
                                <label className="part-label">Modified BO Part No</label>
                                <div className="bo-field-trigger-wrap">
                                  <BONumberModeToggle
                                    name={`boMode_${part.id}`}
                                    mode={part.boNumberMode}
                                    onChange={(m) => changeBONumberMode(part.id, null, m)}
                                  />
                                  {part.boNumberMode === "customerPartNumber" ? (
                                    <div className="bo-filled-display bo-linked">
                                      <span>{part.modifiedBOPartNo || <em>Enter Customer Part No</em>}</span>
                                      <span className="bo-linked-tag">= Customer Part No</span>
                                    </div>
                                  ) : (
                                  <>
                                  {part.modifiedBOPartNo ? (
                                    <div className="bo-filled-display">
                                      <span>{part.modifiedBOPartNo}</span>
                                      <button
                                        className="bo-filled-clear"
                                        title="Clear and rebuild"
                                        onClick={() => updatePartField(part.id, "modifiedBOPartNo", "")}
                                      >
                                        <IconClose />
                                      </button>
                                    </div>
                                  ) : null}
                                  <BOGenerateControl
                                    code={part.boProcessCode}
                                    hasValue={!!part.modifiedBOPartNo}
                                    canGenerate={!!(part.customerPartNo || "").trim()}
                                    onCodeChange={(c) => updatePartField(part.id, "boProcessCode", c)}
                                    onGenerate={() => generateBO(part.id, null)}
                                  />
                                  </>
                                  )}
                                </div>
                              </div>
                              <div className="tab-field-card">
                                <label className="part-label">BO Part Name</label>
                                <input
                                  type="text"
                                  placeholder="Enter BO part name"
                                  value={part.boPartName}
                                  onChange={(e) => updatePartField(part.id, "boPartName", e.target.value)}
                                />
                              </div>
                            </div>

                            {/* ── Part-specific Item Description (optional) ── */}
                            <PartItemDescription
                              shown={part.showItemDesc}
                              value={part.itemDescription}
                              onShow={() => updatePartField(part.id, "showItemDesc", true)}
                              onChange={(v) => updatePartField(part.id, "itemDescription", v)}
                              onRemove={() => { updatePartField(part.id, "itemDescription", ""); updatePartField(part.id, "showItemDesc", false); }}
                            />

                            {/* ── Child Parts — gated behind a Yes/No confirmation ── */}
                            {kids.length > 0 || part.childDecision === "yes" ? (
                            <div className="child-parts-wrap">
                              {kids.map((child, cIdx) => (
                                <div className="child-part-row" key={child.id}>
                                  <div className="child-part-connector" />
                                  <div className="child-part-content">
                                    <div className="child-part-header">
                                      <span className="part-badge child-badge"><IconChildTag /> Child Part {cIdx + 1}</span>
                                      <button
                                        type="button"
                                        className="remove-child-btn"
                                        title="Remove Child Part"
                                        onClick={() => removeChildPart(part.id, child.id)}
                                      >
                                        <IconTrash /> Remove
                                      </button>
                                    </div>
                                    <div className="tab-fields-grid child-fields-grid">
                                      <div className="tab-field-card">
                                        <label className="part-label required">Customer Part No</label>
                                        <input
                                          type="text"
                                          placeholder="Enter customer part no"
                                          value={child.customerPartNo}
                                          onChange={(e) => updateChildField(part.id, child.id, "customerPartNo", e.target.value)}
                                        />
                                      </div>
                                      <div className="tab-field-card">
                                        <label className="part-label">Customer Part Name</label>
                                        <input
                                          type="text"
                                          placeholder="Enter customer part name"
                                          value={child.customerPartName}
                                          onChange={(e) => updateChildField(part.id, child.id, "customerPartName", e.target.value)}
                                        />
                                      </div>
                                    </div>
                                    <div className="tab-fields-grid child-fields-grid">
                                      <div className="tab-field-card bo-number-cell">
                                        <label className="part-label">Modified BO Part No</label>
                                        <div className="bo-field-trigger-wrap">
                                          <BONumberModeToggle
                                            name={`boMode_${child.id}`}
                                            mode={child.boNumberMode}
                                            onChange={(m) => changeBONumberMode(part.id, child.id, m)}
                                          />
                                          {child.boNumberMode === "customerPartNumber" ? (
                                            <div className="bo-filled-display bo-linked">
                                              <span>{child.modifiedBOPartNo || <em>Enter Customer Part No</em>}</span>
                                              <span className="bo-linked-tag">= Customer Part No</span>
                                            </div>
                                          ) : (
                                          <>
                                          {child.modifiedBOPartNo ? (
                                            <div className="bo-filled-display">
                                              <span>{child.modifiedBOPartNo}</span>
                                              <button
                                                className="bo-filled-clear"
                                                title="Clear and rebuild"
                                                onClick={() => updateChildField(part.id, child.id, "modifiedBOPartNo", "")}
                                              >
                                                <IconClose />
                                              </button>
                                            </div>
                                          ) : null}
                                          <BOGenerateControl
                                    code={child.boProcessCode}
                                    hasValue={!!child.modifiedBOPartNo}
                                    canGenerate={!!(child.customerPartNo || "").trim()}
                                    onCodeChange={(c) => updateChildField(part.id, child.id, "boProcessCode", c)}
                                    onGenerate={() => generateBO(part.id, child.id)}
                                  />
                                          </>
                                          )}
                                        </div>
                                      </div>
                                      <div className="tab-field-card">
                                        <label className="part-label">BO Part Name</label>
                                        <input
                                          type="text"
                                          placeholder="Enter BO part name"
                                          value={child.boPartName}
                                          onChange={(e) => updateChildField(part.id, child.id, "boPartName", e.target.value)}
                                        />
                                      </div>
                                    </div>
                                    <PartItemDescription
                                      shown={child.showItemDesc}
                                      value={child.itemDescription}
                                      onShow={() => updateChildField(part.id, child.id, "showItemDesc", true)}
                                      onChange={(v) => updateChildField(part.id, child.id, "itemDescription", v)}
                                      onRemove={() => { updateChildField(part.id, child.id, "itemDescription", ""); updateChildField(part.id, child.id, "showItemDesc", false); }}
                                    />
                                  </div>
                                </div>
                              ))}

                              <button
                                type="button"
                                className="add-child-part-btn"
                                onClick={() => addChildPart(part.id)}
                              >
                                <IconPlus /> Add Child Part
                              </button>
                            </div>
                            ) : part.childDecision === "no" ? (
                              <div className="child-decision-skipped">
                                <span>Child Parts skipped for this Parent Part.</span>
                                <button
                                  type="button"
                                  className="child-decision-change-btn"
                                  onClick={() => setChildDecision(part.id, "yes")}
                                >
                                  <IconPlus /> Add Child Part
                                </button>
                              </div>
                            ) : (
                              <div className="child-confirm-box">
                                <div className="child-confirm-text">
                                  Do you want to add Child Part(s) for this Parent Part?
                                </div>
                                <div className="child-confirm-actions">
                                  <button
                                    type="button"
                                    className="child-confirm-yes-btn"
                                    onClick={() => setChildDecision(part.id, "yes")}
                                  >
                                    <IconCheck /> Yes
                                  </button>
                                  <button
                                    type="button"
                                    className="child-confirm-no-btn"
                                    onClick={() => setChildDecision(part.id, "no")}
                                  >
                                    <IconClose /> No
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                )}

                <button
                  type="button"
                  className="add-part-btn add-part-btn-bottom"
                  onClick={addPart}
                >
                  <IconPlus /> Add Parent Part
                </button>
              </div>
            )}

            {/* ─── PO Details ─── */}
            {activeTab === "po" && (
              <div className="tab-section po-section">
                <div className="tab-section-blob po-blob" />
                <div className="tab-section-title">
                  <span className="section-icon po"><IconPO /></span>
                  PO Number Details
                </div>
                {/* ── Assign Suppliers to Parts — each Part can have multiple suppliers, each with its own PO Number and Date of Issue ── */}
                <div className="supplier-assign-section">
                  <div className="supplier-assign-title">
                    <IconPO /> Assign Suppliers to Parts
                  </div>

                  {parts.length === 0 ? (
                    <div className="supplier-assign-empty">
                      Add Parts in the "Parts Details" tab first, then assign suppliers here.
                    </div>
                  ) : (
                    <div className="supplier-part-list">
                      {parts.map((part, pIdx) => {
                        const supList = partSuppliers[part.id] || [];
                        const draft = supplierDraft[part.id] || "";
                        const poDraft = supplierPoDraft[part.id] || "";
                        const dateDraft = supplierDateDraft[part.id] || "";
                        return (
                          <div className="supplier-part-row" key={part.id}>
                            <div className="supplier-part-label">
                              <span className="part-badge parent-badge"><IconParentTag /> Parent Part {pIdx + 1}</span>
                              {part.customerPartNo && <span className="supplier-part-no">{part.customerPartNo}</span>}
                            </div>

                            <div className="supplier-chip-list">
                              {supList.length === 0 ? (
                                <span className="supplier-chip-empty">No suppliers assigned yet</span>
                              ) : (
                                supList.map((s) => (
                                  <span className="supplier-chip" key={s.name}>
                                    {/* click the name/PO/date to load this supplier back into the input row for editing */}
                                    <span
                                      className="supplier-chip-text"
                                      title="Click to edit"
                                      onClick={() => editSupplierChip(part.id, s)}
                                    >
                                      {s.name}
                                      {s.poNumber ? <span className="supplier-chip-po">· PO {s.poNumber}</span> : null}
                                      {s.dateOfIssue ? <span className="supplier-chip-po">· {s.dateOfIssue}</span> : null}
                                    </span>
                                    <button
                                      type="button"
                                      className="supplier-chip-remove"
                                      title="Remove supplier"
                                      onClick={() => removeSupplierFromPart(part.id, s.name)}
                                    >
                                      <IconClose />
                                    </button>
                                  </span>
                                ))
                              )}
                            </div>

                            <div className="supplier-input-row">
                              <input
                                type="text"
                                list="existing-suppliers-list"
                                className="supplier-input"
                                placeholder="Type or pick a supplier"
                                value={draft}
                                onChange={(e) =>
                                  setSupplierDraft((prev) => ({ ...prev, [part.id]: e.target.value }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    addSupplierToPart(part.id, draft, poDraft, dateDraft);
                                  }
                                }}
                              />
                              <input
                                type="text"
                                className="supplier-po-input"
                                placeholder="PO Number"
                                value={poDraft}
                                onChange={(e) =>
                                  setSupplierPoDraft((prev) => ({ ...prev, [part.id]: e.target.value }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    addSupplierToPart(part.id, draft, poDraft, dateDraft);
                                  }
                                }}
                              />
                              <input
                                type="date"
                                className="supplier-date-input"
                                value={dateDraft}
                                onChange={(e) =>
                                  setSupplierDateDraft((prev) => ({ ...prev, [part.id]: e.target.value }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    addSupplierToPart(part.id, draft, poDraft, dateDraft);
                                  }
                                }}
                              />
                              <button
                                type="button"
                                className="supplier-add-btn"
                                onClick={() => addSupplierToPart(part.id, draft, poDraft, dateDraft)}
                              >
                                <IconPlus /> Add Supplier
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Shared Suggestion List  — powers autocomplete for every part's input above */}
                  <datalist id="existing-suppliers-list">
                    {supplierOptions.map((s) => (
                      <option value={s} key={s} />
                    ))}
                  </datalist>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="modal-footer">
            {!isEdit && draftInfo.savedAt && (
              <span className="draft-status" title="Everything you type is saved in this browser until you create the enquiry or discard the draft.">
                ✓ Draft auto-saved · {draftTime(draftInfo.savedAt)}
              </span>
            )}
            <button className="modal-cancel-btn" onClick={onClose}>Cancel</button>
            <button className="modal-submit-btn" onClick={handleSubmit} disabled={isSubmitting}>
              <IconSparkle /> {isEdit ? "Update Enquiry" : "Create Enquiry"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
