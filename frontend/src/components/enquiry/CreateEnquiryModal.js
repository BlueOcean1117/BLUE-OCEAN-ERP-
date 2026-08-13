import React, { useState, useEffect } from "react";

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
   BO Part Number Builder Drawer Component
───────────────────────────────────────────── */
const COMPANY_CODES  = ["FAB","MAC","FOR","CAS","FAS","ASM","STA","FMC","CMC","RUB","PLA",];
const FIXED_PREFIX   = "B";

function BOBuilderDrawer({ isOpen, onClose, onApply, formData }) {
  /* Snapshot values at the moment the drawer opens */
  const [snapshot, setSnapshot] = useState({ customerName: "", customerPartNo: "" });

  /* configurable state */
  const [customerPrefix, setCustomerPrefix] = useState("");
  const [companyCode,    setCompanyCode]    = useState("ZET");
  const [customCode,     setCustomCode]     = useState("");
  const [first3,         setFirst3]         = useState("");
  const [last3,          setLast3]          = useState("");

  /* Capture a fresh snapshot and re-init every time the drawer opens */
  useEffect(() => {
    if (isOpen) {
      const name   = formData.customerName   || "";
      const partNo = formData.customerPartNo || "";
      setSnapshot({ customerName: name, customerPartNo: partNo });
      setCustomerPrefix(derivePrefix(name));
      setFirst3(extractDigits(partNo, "first", 3));
      setLast3(extractDigits(partNo, "last",  3));
      setCompanyCode("ZET");
      setCustomCode("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  /* Also keep first3/last3 in sync if customerPartNo changes WHILE drawer is open */
  useEffect(() => {
    if (isOpen) {
      const name   = formData.customerName   || "";
      const partNo = formData.customerPartNo || "";
      if (name !== snapshot.customerName) {
        setCustomerPrefix(derivePrefix(name));
      }
      if (partNo !== snapshot.customerPartNo) {
        setFirst3(extractDigits(partNo, "first", 3));
        setLast3(extractDigits(partNo, "last",  3));
      }
      setSnapshot({ customerName: name, customerPartNo: partNo });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.customerName, formData.customerPartNo]);

  /* Use snapshot for display in auto-fetch section */
  const customerName   = snapshot.customerName;
  const customerPartNo = snapshot.customerPartNo;

  /* live preview */
  const resolvedCode   = companyCode === "Custom" ? customCode  : companyCode;
  const generatedPartNo = `${customerPrefix}${FIXED_PREFIX}${first3}${resolvedCode}${last3}`;

  const handleApply = () => {
    onApply(generatedPartNo);
    onClose();
  };

  /* Trap body scroll when open */
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  return (
    <>
      {/* Backdrop — semi-transparent, does NOT close the main modal */}
      <div
        className={`bo-drawer-backdrop${isOpen ? " open" : ""}`}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div className={`bo-drawer${isOpen ? " open" : ""}`} onClick={e => e.stopPropagation()}>
        {/* Drawer Header */}
        <div className="bo-drawer-header">
          <div className="bo-drawer-title">
            <span className="bo-drawer-title-icon"><IconWand /></span>
            <div>
              <h3>BO Part Number Builder</h3>
              <p>Configure and generate the Modified BO Part Number</p>
            </div>
          </div>
          <button className="bo-drawer-close" onClick={onClose}><IconClose /></button>
        </div>

        <div className="bo-drawer-body">

          {/* ── AUTO-FETCHED SECTION ── */}
          <div className="bo-drawer-section">
            <div className="bo-drawer-section-label">
              <span className="bo-ds-dot fetch" />
              Auto-Fetched Details
            </div>
            <div className="bo-fetch-grid">
              <div className="bo-fetch-item">
                <span className="bo-fetch-key">Customer Name</span>
                <span className="bo-fetch-val">{customerName || <em>Not entered yet</em>}</span>
              </div>
              <div className="bo-fetch-item">
                <span className="bo-fetch-key">Customer Prefix</span>
                <span className="bo-fetch-val highlight">{derivePrefix(customerName) || "—"}</span>
              </div>
              <div className="bo-fetch-item">
                <span className="bo-fetch-key">Original Part No</span>
                <span className="bo-fetch-val">{customerPartNo || <em>Not entered yet</em>}</span>
              </div>
              <div className="bo-fetch-item">
                <span className="bo-fetch-key">First 3 Digits</span>
                <span className="bo-fetch-val highlight">{first3 || "—"}</span>
              </div>
              <div className="bo-fetch-item">
                <span className="bo-fetch-key">Last 3 Digits</span>
                <span className="bo-fetch-val highlight">{last3 || "—"}</span>
              </div>
            </div>
          </div>

          {/* ── CONFIGURE SECTION ── */}
          <div className="bo-drawer-section">
            <div className="bo-drawer-section-label">
              <span className="bo-ds-dot config" />
              Configure
            </div>

            <div className="bo-config-grid">
              {/* Customer Prefix (editable) */}
              <div className="bo-config-field">
                <label>Customer Prefix</label>
                <input
                  type="text"
                  maxLength={6}
                  value={customerPrefix}
                  onChange={e => setCustomerPrefix(e.target.value.toUpperCase())}
                  placeholder="e.g. F"
                />
              </div>

              {/* Prefix Type — static readonly display, always "B" */}
              <div className="bo-config-field">
                <label>Prefix Type</label>
                <input
                  type="text"
                  value={FIXED_PREFIX}
                  readOnly
                  style={{ background: "#f3f4f6", color: "#6b7280", cursor: "not-allowed" }}
                />
              </div>

              {/* First 3 */}
              <div className="bo-config-field">
                <label>First 3 Digits</label>
                <input
                  type="text"
                  maxLength={3}
                  value={first3}
                  onChange={e => setFirst3(e.target.value.replace(/\D/g,""))}
                  placeholder="e.g. 051"
                />
              </div>

              {/* Process Code */}
              <div className="bo-config-field">
                <label>Process Code</label>
                <select value={companyCode} onChange={e => setCompanyCode(e.target.value)}>
                  {COMPANY_CODES.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                {companyCode === "Custom" && (
                  <input
                    type="text"
                    className="bo-custom-input"
                    placeholder="Enter custom code"
                    value={customCode}
                    onChange={e => setCustomCode(e.target.value.toUpperCase())}
                  />
                )}
              </div>

              {/* Last 3 */}
              <div className="bo-config-field">
                <label>Last 3 Digits</label>
                <input
                  type="text"
                  maxLength={3}
                  value={last3}
                  onChange={e => setLast3(e.target.value.replace(/\D/g,""))}
                  placeholder="e.g. 007"
                />
              </div>
            </div>
          </div>

          {/* ── LIVE PREVIEW ── */}
          <div className="bo-drawer-section">
            <div className="bo-drawer-section-label">
              <span className="bo-ds-dot preview" />
              Live Preview
            </div>
            <div className="bo-live-preview">
              <span className="bo-preview-label">Generated BO Part Number</span>
              <div className="bo-preview-value">
                {generatedPartNo || <span className="bo-preview-empty">Fill fields above to generate</span>}
              </div>
              <div className="bo-preview-breakdown">
                <span className="bp-chip cust">{customerPrefix || "—"}</span>
                <span className="bp-sep">+</span>
                <span className="bp-chip prefix">{FIXED_PREFIX}</span>
                <span className="bp-sep">+</span>
                <span className="bp-chip digits">{first3 || "—"}</span>
                <span className="bp-sep">+</span>
                <span className="bp-chip code">{resolvedCode || "—"}</span>
                <span className="bp-sep">+</span>
                <span className="bp-chip digits">{last3 || "—"}</span>
              </div>
            </div>
          </div>

        </div>

        {/* Drawer Footer */}
        <div className="bo-drawer-footer">
          <button className="bo-drawer-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="bo-drawer-apply"
            onClick={handleApply}
            disabled={!generatedPartNo}
          >
            <IconCheck /> Apply BO Part Number
          </button>
        </div>
      </div>
    </>
  );
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
});

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
  const [showBOPanel, setShowBOPanel]   = useState(false);
  const [boTarget, setBoTarget]         = useState(null); // { parentId, childId }
  const [supplierDraft, setSupplierDraft] = useState({}); // { [partId]: "supplier name being typed" }
  const [supplierPoDraft, setSupplierPoDraft] = useState({}); // { [partId]: "PO number being typed" }
  const [supplierDateDraft, setSupplierDateDraft] = useState({}); // { [partId]: "date of issue being typed" }
  const [partSuppliers, setPartSuppliers] = useState({}); // { [partId]: [{ name, poNumber, dateOfIssue }] }

  useEffect(() => {
    if (isOpen) {
      setForm(getInitialForm());
      const initialParts = getInitialParts();
      setParts(initialParts);
      setPartsError("");
      setActiveTab("bo");
      setShowBOPanel(false);
      setBoTarget(null);
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editData]);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  /* ── Parts Details: CRUD helpers ── */
  const addPart = () => setParts((prev) => [...prev, makeEmptyPart()]);

  const removePart = (id) =>
    setParts((prev) => prev.filter((p) => p.id !== id));

  const updatePartField = (id, field, value) =>
    setParts((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));

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
  const addSupplierToPart = (partId, rawValue, rawPoNumber, rawDateOfIssue, partLabel) => {
    const value = (rawValue || "").trim();
    const poNumber = (rawPoNumber || "").trim();
    const dateOfIssue = (rawDateOfIssue || "").trim();
    if (!value && !poNumber && !dateOfIssue) return; // nothing typed at all — nothing to do
    // Require all three fields together before a supplier assignment can be added,
    // per spec: "Do not allow incomplete supplier assignments to be saved."
    if (!value || !poNumber || !dateOfIssue) {
      setPartsError(
        `Please complete Supplier, PO Number and PO Date before adding a supplier${partLabel ? ` for ${partLabel}` : ""}.`
      );
      return;
    }
    setPartsError("");
    setPartSuppliers((prev) => {
      const current = prev[partId] || [];
      // avoid case-insensitive duplicates on supplier name
      if (current.some((s) => s.name.toLowerCase() === value.toLowerCase())) {
        setPartsError(`"${value}" is already assigned to this part.`);
        return prev;
      }
      return { ...prev, [partId]: [...current, { name: value, poNumber, dateOfIssue }] };
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
          ? { ...p, children: (p.children || []).map((c) => (c.id === childId ? { ...c, [field]: value } : c)) }
          : p
      )
    );

  /* ── BO Part Number Builder — works against whichever part/child triggered it ── */
  const openBOBuilder = (parentId, childId = null) => {
    setBoTarget({ parentId, childId });
    setShowBOPanel(true);
  };

  const applyBOPartNo = (value) => {
    if (!boTarget) return;
    if (boTarget.childId) {
      updateChildField(boTarget.parentId, boTarget.childId, "modifiedBOPartNo", value);
    } else {
      updatePartField(boTarget.parentId, "modifiedBOPartNo", value);
    }
  };

  const getBoTargetCustomerPartNo = () => {
    if (!boTarget) return "";
    const parent = parts.find((p) => p.id === boTarget.parentId);
    if (!parent) return "";
    if (boTarget.childId) {
      const child = (parent.children || []).find((c) => c.id === boTarget.childId);
      return child ? child.customerPartNo : "";
    }
    return parent.customerPartNo;
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
    const validationMessage = validateParts();
    if (validationMessage) {
      setPartsError(validationMessage);
      setActiveTab("parts");
      return;
    }
    setPartsError("");

    // If the user typed a supplier name/PO/Date but never clicked "Add Supplier"
    // (or pressed Enter), that draft text would otherwise be silently lost on save.
    // Auto-commit any non-empty leftover drafts into the supplier list here, per part,
    // right before the payload is built — without mutating existing entries.
    // Per spec: an incomplete draft (some fields filled, not all) blocks the save
    // with a clear message, rather than being silently saved partial or dropped.
    const effectivePartSuppliers = { ...partSuppliers };
    for (const p of parts) {
      const draftName = (supplierDraft[p.id] || "").trim();
      const draftPo = (supplierPoDraft[p.id] || "").trim();
      const draftDate = (supplierDateDraft[p.id] || "").trim();
      if (!draftName && !draftPo && !draftDate) continue; // nothing left in the inputs for this part
      if (!draftName || !draftPo || !draftDate) {
        setPartsError(
          `Please complete Supplier, PO Number and PO Date before saving — an incomplete supplier entry is pending for part "${p.customerPartNo || "(unnamed)"}".`
        );
        setActiveTab("po");
        return;
      }
      const current = effectivePartSuppliers[p.id] || [];
      const alreadyExists = current.some((s) => s.name.toLowerCase() === draftName.toLowerCase());
      if (!alreadyExists) {
        effectivePartSuppliers[p.id] = [...current, { name: draftName, poNumber: draftPo, dateOfIssue: draftDate }];
      }
    }

    // Clean UI-only fields (id/collapsed) before sending to the API.
    const cleanParts = parts.map(({ id, collapsed, children, childDecision, ...rest }) => ({
      ...rest,
      isChildPart: false,
      children: (children || []).map(({ id: childId, ...childRest }) => ({
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
      poDetails: {
        supplierName: form.supplierName,
        poNumber: form.poNumber,
        dateOfIssue: form.dateOfIssue || null,
      },
      // Multiple suppliers assigned per Part, keyed by that part's Customer Part No.
      // Each supplier now carries its own poNumber and dateOfIssue alongside its name.
      partSuppliers: parts.map((p) => ({
        customerPartNo: p.customerPartNo || "",
        suppliers: effectivePartSuppliers[p.id] || [],
      })),
    };
    if (isEdit) payload.enquiryNumber = form.enquiryNumber;
    onSubmit(payload);
  };

  const tabs = [
    { key: "bo", label: "BO / Enquiry Details", Icon: IconBO },
    { key: "parts", label: `Parts Details${parts.length ? ` (${parts.length})` : ""}`, Icon: IconPart },
    { key: "po", label: "PO Details", Icon: IconPO },
  ];

  return (
    <>
      {/* ── Scoped styles for the BO Builder Drawer ── */}
      <style>{`
        /* Backdrop */
        .bo-drawer-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.25);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.28s ease;
          z-index: 1100;
        }
        .bo-drawer-backdrop.open {
          opacity: 1;
          pointer-events: auto;
        }

        /* Drawer panel */
        .bo-drawer {
          position: fixed;
          top: 0;
          right: 0;
          height: 100vh;
          width: 420px;
          max-width: 95vw;
          background: #ffffff;
          box-shadow: -6px 0 32px rgba(0,0,0,0.15);
          display: flex;
          flex-direction: column;
          z-index: 1200;
          transform: translateX(100%);
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          border-left: 1px solid #e5e7eb;
        }
        .bo-drawer.open {
          transform: translateX(0);
        }

        /* Header */
        .bo-drawer-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 16px 18px 14px;
          border-bottom: 1px solid #f0f0f0;
          background: linear-gradient(135deg, #f8f5ff 0%, #fdf4ff 100%);
          flex-shrink: 0;
        }
        .bo-drawer-title {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }
        .bo-drawer-title-icon {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          background: linear-gradient(135deg, #7c3aed, #a855f7);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          flex-shrink: 0;
        }
        .bo-drawer-title h3 {
          margin: 0 0 2px;
          font-size: 14.5px;
          font-weight: 700;
          color: #1e1b4b;
        }
        .bo-drawer-title p {
          margin: 0;
          font-size: 11px;
          color: #6b7280;
        }
        .bo-drawer-close {
          border: none;
          background: #f3f4f6;
          border-radius: 8px;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #6b7280;
          transition: background 0.15s;
          flex-shrink: 0;
        }
        .bo-drawer-close:hover { background: #e5e7eb; color: #111; }

        /* Body */
        .bo-drawer-body {
          flex: 1;
          overflow-y: auto;
          padding: 14px 18px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .bo-drawer-body::-webkit-scrollbar { width: 5px; }
        .bo-drawer-body::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; }

        /* Section */
        .bo-drawer-section {
          background: #fafafa;
          border: 1px solid #f0f0f0;
          border-radius: 12px;
          padding: 12px 14px;
        }
        .bo-drawer-section-label {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 10.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #6b7280;
          margin-bottom: 10px;
        }
        .bo-ds-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          display: inline-block;
        }
        .bo-ds-dot.fetch   { background: #3b82f6; }
        .bo-ds-dot.config  { background: #8b5cf6; }
        .bo-ds-dot.preview { background: #10b981; }
        .bo-ds-dot.suggest { background: #f59e0b; }

        /* Auto-fetch grid */
        .bo-fetch-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 7px;
        }
        .bo-fetch-item {
          display: flex;
          flex-direction: column;
          gap: 3px;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 7px 9px;
        }
        .bo-fetch-key {
          font-size: 9.5px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #9ca3af;
        }
        .bo-fetch-val {
          font-size: 12.5px;
          font-weight: 600;
          color: #374151;
        }
        .bo-fetch-val em { font-style: italic; font-weight: 400; color: #9ca3af; }
        .bo-fetch-val.highlight {
          color: #7c3aed;
          font-size: 13.5px;
        }

        /* Config grid */
        .bo-config-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 9px;
        }
        .bo-config-field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .bo-config-field label {
          font-size: 10.5px;
          font-weight: 600;
          color: #374151;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .bo-config-field input,
        .bo-config-field select {
          border: 1.5px solid #e5e7eb;
          border-radius: 7px;
          padding: 6px 9px;
          font-size: 12.5px;
          color: #111;
          background: #fff;
          outline: none;
          transition: border-color 0.15s;
          width: 100%;
          box-sizing: border-box;
        }
        .bo-config-field input:focus,
        .bo-config-field select:focus {
          border-color: #7c3aed;
          box-shadow: 0 0 0 3px rgba(124,58,237,0.1);
        }
        .bo-custom-input {
          margin-top: 4px !important;
        }

        /* Live preview */
        .bo-live-preview {
          background: linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%);
          border: 1.5px solid #a7f3d0;
          border-radius: 10px;
          padding: 12px 14px;
          text-align: center;
        }
        .bo-preview-label {
          display: block;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #059669;
          margin-bottom: 7px;
        }
        .bo-preview-value {
          font-size: 20px;
          font-weight: 800;
          color: #065f46;
          letter-spacing: 0.06em;
          margin-bottom: 8px;
          min-height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .bo-preview-empty {
          font-size: 12.5px;
          font-weight: 400;
          color: #9ca3af;
          font-style: italic;
        }
        .bo-preview-breakdown {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          flex-wrap: wrap;
        }
        .bp-chip {
          padding: 2px 9px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.04em;
        }
        .bp-chip.cust   { background: #fef3c7; color: #92400e; }
        .bp-chip.prefix { background: #ede9fe; color: #5b21b6; }
        .bp-chip.digits { background: #dbeafe; color: #1d4ed8; }
        .bp-chip.code   { background: #fce7f3; color: #9d174d; }
        .bp-sep { color: #9ca3af; font-size: 11px; font-weight: 600; }

        /* Footer */
        .bo-drawer-footer {
          padding: 12px 18px;
          border-top: 1px solid #f0f0f0;
          display: flex;
          gap: 10px;
          background: #fff;
          flex-shrink: 0;
        }
        .bo-drawer-cancel {
          flex: 1;
          padding: 9px;
          border: 1.5px solid #e5e7eb;
          border-radius: 9px;
          background: #fff;
          color: #374151;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }
        .bo-drawer-cancel:hover { background: #f9fafb; border-color: #d1d5db; }
        .bo-drawer-apply {
          flex: 2;
          padding: 9px 16px;
          border: none;
          border-radius: 9px;
          background: linear-gradient(135deg, #7c3aed, #a855f7);
          color: #fff;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: opacity 0.15s, transform 0.12s;
          box-shadow: 0 3px 10px rgba(124,58,237,0.3);
        }
        .bo-drawer-apply:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); }
        .bo-drawer-apply:disabled { opacity: 0.45; cursor: not-allowed; }

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
      `}</style>

      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-container" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="modal-header">
            <h2>{isEdit ? "Edit Enquiry" : "Create New Enquiry"}</h2>
            <p>
              {isEdit
                ? "Update the enquiry details below."
                : "Fill in the details below to create a new enquiry record. You can add information across all three sections."}
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
            {/* ─── BO / Enquiry & Part Mapping ─── */}
            {activeTab === "bo" && (
              <>
                <div className="tab-section bo-section">
                  <div className="tab-section-blob bo-blob" />
                  <div className="tab-section-title">
                    <span className="section-icon bo"><IconBO /></span>
                    BO / Enquiry Details
                  </div>
                  <div className="tab-fields-grid">
                    <div className="tab-field-card">
                      <label className="bo-label required">Customer Name</label>
                      <input type="text" placeholder="Enter customer name" value={form.customerName} onChange={(e) => handleChange("customerName", e.target.value)} />
                    </div>
                    <div className="tab-field-card">
                      <label className="bo-label required">Customer RFQ Date</label>
                      <input type="date" placeholder="dd-mm-yyyy" value={form.customerRFQDate} onChange={(e) => handleChange("customerRFQDate", e.target.value)} />
                    </div>
                  </div>
                  <div className="tab-fields-grid single">
                    <div className="tab-field-card">
                      <label className="bo-label">Item Description</label>
                      <input type="text" placeholder="Enter item description" value={form.itemDescription} onChange={(e) => handleChange("itemDescription", e.target.value)} />
                    </div>
                  </div>

                  {/* Enquiry Number Generation */}
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
              </>
            )}

            {/* ─── Parts Details (multiple parent + child parts) ─── */}
            {activeTab === "parts" && (
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
                              <div className="tab-field-card">
                                <label className="part-label">Modified BO Part No</label>
                                <div className="bo-field-trigger-wrap">
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
                                  <button
                                    type="button"
                                    className="bo-generate-btn"
                                    onClick={() => openBOBuilder(part.id)}
                                  >
                                    <span className="bo-generate-btn-icon"><IconWand /></span>
                                    {part.modifiedBOPartNo ? "Rebuild BO Part Number" : "Generate BO Part Number"}
                                  </button>
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
                                      <div className="tab-field-card">
                                        <label className="part-label">Modified BO Part No</label>
                                        <div className="bo-field-trigger-wrap">
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
                                          <button
                                            type="button"
                                            className="bo-generate-btn"
                                            onClick={() => openBOBuilder(part.id, child.id)}
                                          >
                                            <span className="bo-generate-btn-icon"><IconWand /></span>
                                            {child.modifiedBOPartNo ? "Rebuild BO Part Number" : "Generate BO Part Number"}
                                          </button>
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

                {partsError && (
                  <div className="parts-error-banner">
                    <IconAlert /> {partsError}
                  </div>
                )}

                {/* ── General PO Details (Supplier Name / PO Number / Date of Issue) ──
                    FIX: these three fields feed the top-level `poDetails` object that
                    EnquiryTable.js, ViewEnquiryModal.js, and the dashboard exports read
                    from (enq.poDetails.*). This tab previously had NO input elements
                    bound to form.supplierName / form.poNumber / form.dateOfIssue — only
                    the "Assign Suppliers to Parts" section below existed — so these three
                    fields were always submitted empty. Everything else in this file/tab
                    is unchanged. ── */}
                <div className="tab-fields-grid">
                  <div className="tab-field-card">
                    <label className="bo-label">Supplier Name</label>
                    <input
                      type="text"
                      placeholder="Enter supplier name"
                      value={form.supplierName}
                      onChange={(e) => handleChange("supplierName", e.target.value)}
                    />
                  </div>
                  <div className="tab-field-card">
                    <label className="bo-label">PO Number</label>
                    <input
                      type="text"
                      placeholder="Enter PO number"
                      value={form.poNumber}
                      onChange={(e) => handleChange("poNumber", e.target.value)}
                    />
                  </div>
                </div>
                <div className="tab-fields-grid single">
                  <div className="tab-field-card">
                    <label className="bo-label">Date of Issue</label>
                    <input
                      type="date"
                      value={form.dateOfIssue}
                      onChange={(e) => handleChange("dateOfIssue", e.target.value)}
                    />
                  </div>
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
            <button className="modal-cancel-btn" onClick={onClose}>Cancel</button>
            <button className="modal-submit-btn" onClick={handleSubmit} disabled={isSubmitting}>
              <IconSparkle /> {isEdit ? "Update Enquiry" : "Create Enquiry"}
            </button>
          </div>
        </div>
      </div>

      {/* ── BO Part Number Builder Drawer ── */}
      <BOBuilderDrawer
        isOpen={showBOPanel}
        onClose={() => setShowBOPanel(false)}
        onApply={(value) => applyBOPartNo(value)}
        formData={{
          customerName:   form.customerName,
          customerPartNo: getBoTargetCustomerPartNo(),
        }}
      />
    </>
  );
}
