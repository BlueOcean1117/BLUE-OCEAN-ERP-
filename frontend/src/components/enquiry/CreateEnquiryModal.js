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
  if (!partNo) return "";
  const clean = String(partNo).trim();
  if (clean.length === 0) return "";
  const lastThree  = clean.slice(-3);
  let   firstPart  = clean.slice(0, -3);
  if (firstPart.length < 3)      firstPart = firstPart.padStart(3, "0");
  else if (firstPart.length > 3) firstPart = firstPart.substring(0, 3);
  if (position === "first") return firstPart;
  if (position === "last")  return lastThree;
  return "";
}

/* ─────────────────────────────────────────────
   BO Part Number Builder Drawer Component
───────────────────────────────────────────── */
// CHANGE 3: Prefix type is now constant "B" — removed PREFIX_OPTIONS
const COMPANY_CODES  = ["ZET", "MAC", "FOR", "ABC", "Custom"];
const FIXED_PREFIX   = "B";

function BOBuilderDrawer({ isOpen, onClose, onApply, formData }) {
  /* Snapshot values at the moment the drawer opens */
  const [snapshot, setSnapshot] = useState({ customerName: "", customerPartNo: "" });

  /* configurable state */
  const [customerPrefix, setCustomerPrefix] = useState("");
  // CHANGE 3: prefixType removed — always "B"
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

  /* live preview — CHANGE 3: uses FIXED_PREFIX "B" instead of resolvedPrefix */
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

              {/* CHANGE 3: Prefix Type — now a static readonly display, always "B" */}
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

              {/* CHANGE 2: Renamed "Company Code" → "Process Code" */}
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

          {/* CHANGE 1: Suggested Formats section REMOVED */}

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
   Main Modal
───────────────────────────────────────────── */
export default function CreateEnquiryModal({
  isOpen,
  onClose,
  onSubmit,
  editData,
  isSubmitting,
}) {
  const isEdit = !!editData;

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

  const [activeTab, setActiveTab]       = useState("bo");
  const [form, setForm]                 = useState(getInitialForm);
  const [showBOPanel, setShowBOPanel]   = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(getInitialForm());
      setActiveTab("bo");
      setShowBOPanel(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editData]);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    const payload = {
      customerName: form.customerName,
      customerRFQDate: form.customerRFQDate || null,
      itemDescription: form.itemDescription,
      enquiryNumber:
        form.enquiryNumberMode === "auto" ? "auto" : form.enquiryNumber,
      partMapping: {
        customerPartNo: form.customerPartNo,
        customerPartName: form.customerPartName,
        modifiedBOPartNo: form.modifiedBOPartNo,
        boPartName: form.boPartName,
      },
      poDetails: {
        supplierName: form.supplierName,
        poNumber: form.poNumber,
        dateOfIssue: form.dateOfIssue || null,
      },
    };
    if (isEdit) payload.enquiryNumber = form.enquiryNumber;
    onSubmit(payload);
  };

  const tabs = [
    { key: "bo", label: "BO / Enquiry & Part Mapping", Icon: IconBO },
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
          padding: 20px 20px 16px;
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
          width: 36px;
          height: 36px;
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
          font-size: 15px;
          font-weight: 700;
          color: #1e1b4b;
        }
        .bo-drawer-title p {
          margin: 0;
          font-size: 11.5px;
          color: #6b7280;
        }
        .bo-drawer-close {
          border: none;
          background: #f3f4f6;
          border-radius: 8px;
          width: 30px;
          height: 30px;
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
          padding: 16px 20px;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .bo-drawer-body::-webkit-scrollbar { width: 5px; }
        .bo-drawer-body::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; }

        /* Section */
        .bo-drawer-section {
          background: #fafafa;
          border: 1px solid #f0f0f0;
          border-radius: 12px;
          padding: 14px 16px;
        }
        .bo-drawer-section-label {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #6b7280;
          margin-bottom: 12px;
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
          gap: 8px;
        }
        .bo-fetch-item {
          display: flex;
          flex-direction: column;
          gap: 3px;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 8px 10px;
        }
        .bo-fetch-key {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #9ca3af;
        }
        .bo-fetch-val {
          font-size: 13px;
          font-weight: 600;
          color: #374151;
        }
        .bo-fetch-val em { font-style: italic; font-weight: 400; color: #9ca3af; }
        .bo-fetch-val.highlight {
          color: #7c3aed;
          font-size: 14px;
        }

        /* Config grid */
        .bo-config-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .bo-config-field {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .bo-config-field label {
          font-size: 11px;
          font-weight: 600;
          color: #374151;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .bo-config-field input,
        .bo-config-field select {
          border: 1.5px solid #e5e7eb;
          border-radius: 7px;
          padding: 7px 10px;
          font-size: 13px;
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
          padding: 14px 16px;
          text-align: center;
        }
        .bo-preview-label {
          display: block;
          font-size: 10.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #059669;
          margin-bottom: 8px;
        }
        .bo-preview-value {
          font-size: 22px;
          font-weight: 800;
          color: #065f46;
          letter-spacing: 0.06em;
          margin-bottom: 10px;
          min-height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .bo-preview-empty {
          font-size: 13px;
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
          padding: 14px 20px;
          border-top: 1px solid #f0f0f0;
          display: flex;
          gap: 10px;
          background: #fff;
          flex-shrink: 0;
        }
        .bo-drawer-cancel {
          flex: 1;
          padding: 10px;
          border: 1.5px solid #e5e7eb;
          border-radius: 9px;
          background: #fff;
          color: #374151;
          font-size: 13.5px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }
        .bo-drawer-cancel:hover { background: #f9fafb; border-color: #d1d5db; }
        .bo-drawer-apply {
          flex: 2;
          padding: 10px 16px;
          border: none;
          border-radius: 9px;
          background: linear-gradient(135deg, #7c3aed, #a855f7);
          color: #fff;
          font-size: 13.5px;
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
          padding: 8px 12px;
          font-size: 13.5px;
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
          padding: 9px 14px;
          border: 1.5px dashed #a78bfa;
          border-radius: 8px;
          background: #faf5ff;
          color: #7c3aed;
          font-size: 13px;
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
          width: 24px;
          height: 24px;
          border-radius: 6px;
          background: linear-gradient(135deg, #7c3aed, #a855f7);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
        }
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

                <div className="tab-section part-section" style={{ marginTop: "16px" }}>
                  <div className="tab-section-blob part-blob" />
                  <div className="tab-section-title">
                    <span className="section-icon part"><IconPart /></span>
                    Part Number Mapping
                  </div>
                  <div className="tab-fields-grid">
                    <div className="tab-field-card">
                      <label className="part-label">Customer Part No</label>
                      <input type="text" placeholder="Enter customer part no" value={form.customerPartNo} onChange={(e) => handleChange("customerPartNo", e.target.value)} />
                    </div>
                    <div className="tab-field-card">
                      <label className="part-label">Customer Part Name</label>
                      <input type="text" placeholder="Enter customer part name" value={form.customerPartName} onChange={(e) => handleChange("customerPartName", e.target.value)} />
                    </div>
                  </div>

                  {/* ── MODIFIED BO PART NO — Smart Builder Field ── */}
                  <div className="tab-fields-grid">
                    <div className="tab-field-card">
                      <label className="part-label">Modified BO Part No</label>
                      <div className="bo-field-trigger-wrap">
                        {form.modifiedBOPartNo ? (
                          /* Value already set — show it with a clear button */
                          <div className="bo-filled-display">
                            <span>{form.modifiedBOPartNo}</span>
                            <button
                              className="bo-filled-clear"
                              title="Clear and rebuild"
                              onClick={() => handleChange("modifiedBOPartNo", "")}
                            >
                              <IconClose />
                            </button>
                          </div>
                        ) : null}
                        {/* Always show the builder button */}
                        <button
                          type="button"
                          className="bo-generate-btn"
                          onClick={() => setShowBOPanel(true)}
                        >
                          <span className="bo-generate-btn-icon"><IconWand /></span>
                          {form.modifiedBOPartNo ? "Rebuild BO Part Number" : "Generate BO Part Number"}
                        </button>
                      </div>
                    </div>
                    <div className="tab-field-card">
                      <label className="part-label">BO Part Name</label>
                      <input type="text" placeholder="Enter BO part name" value={form.boPartName} onChange={(e) => handleChange("boPartName", e.target.value)} />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ─── PO Details ─── */}
            {activeTab === "po" && (
              <div className="tab-section po-section">
                <div className="tab-section-blob po-blob" />
                <div className="tab-section-title">
                  <span className="section-icon po"><IconPO /></span>
                  PO Number Details
                </div>
                <div className="tab-fields-grid">
                  <div className="tab-field-card">
                    <label className="po-label">Supplier Name</label>
                    <input type="text" placeholder="Enter supplier name" value={form.supplierName} onChange={(e) => handleChange("supplierName", e.target.value)} />
                  </div>
                  <div className="tab-field-card">
                    <label className="po-label">PO Number</label>
                    <input type="text" placeholder="Enter PO number" value={form.poNumber} onChange={(e) => handleChange("poNumber", e.target.value)} />
                  </div>
                </div>
                <div className="tab-fields-grid single">
                  <div className="tab-field-card" style={{ maxWidth: "280px" }}>
                    <label className="po-label">Date of Issue</label>
                    <input type="date" value={form.dateOfIssue} onChange={(e) => handleChange("dateOfIssue", e.target.value)} />
                  </div>
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
        onApply={(value) => handleChange("modifiedBOPartNo", value)}
        formData={{
          customerName:   form.customerName,
          customerPartNo: form.customerPartNo,
        }}
      />
    </>
  );
}