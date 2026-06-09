import { useState, useEffect, useRef } from "react";

// ─── Config ────────────────────────────────────────────────────────────────
const PREFIX_OPTIONS  = ["B", "FB", "MAC", "FOR", "ZET", "Custom"];
const COMPANY_OPTIONS = ["ZET", "MAC", "FOR", "FB", "ABC", "Custom"];

// ─── Helpers ───────────────────────────────────────────────────────────────
function extractSegments(partNo = "") {
  if (!partNo) return { first: "", last: "" };
 
  // Split on any symbol/special character as delimiter
  const parts = partNo.toUpperCase().split(/[^0-9A-Z]+/).filter(p => p.length > 0);
 
  if (parts.length === 1) {
    // No symbol found — pad to 6 and split first 3 / last 3
    const single = parts[0].padStart(6, "0");
    return {
      first: single.slice(0, 3),
      last:  single.slice(-3),
    };
  }
 
  return {
    first: parts[0].padStart(3, "0"),                  // e.g. "HY" → "0HY"
    last:  parts[parts.length - 1].padStart(3, "0"),   // e.g. "23" → "023"
  };
}
 
function buildBO(prefix, prefixCode, first, companyCode, last) {
  return `${prefix}${prefixCode}${first}${companyCode}${last}`;
}

function generateSuggestions(prefix, first, last) {
  const prefixes  = ["B", "FB", "MAC", "FOR"];
  const companies = ["ZET", "MAC", "FOR", "ABC"];
  const out = [];
  prefixes.forEach(p =>
    companies.forEach(c =>
      out.push({ value: buildBO(prefix, p, first, c, last), prefixCode: p, companyCode: c })
    )
  );
  return out.filter(s => s.value.replace(/undefined/g, "").length > 0);
}

// ─── Component ─────────────────────────────────────────────────────────────
/**
 * BOPartNumberBuilder
 *
 * Props:
 *   isOpen        {boolean}   – controls visibility
 *   onClose       {function}  – called when the user cancels
 *   onApply       {function}  – called with the final BO part number string
 *   customerName  {string}    – pre-filled from enquiry form
 *   partNo        {string}    – customer part number pre-filled from enquiry form
 *   currentValue  {string}    – existing modifiedBOPartNo (for edit mode)
 */
export default function BOPartNumberBuilder({
  isOpen,
  onClose,
  onApply,
  customerName = "",
  partNo = "",
  currentValue = "",
}) {
  // Auto-derived
  const [prefix,      setPrefix]      = useState("");
  const [partFirst,   setPartFirst]   = useState("");
  const [partLast,    setPartLast]    = useState("");

  // User-selected
  const [prefixCode,  setPrefixCode]  = useState("B");
  const [companyCode, setCompanyCode] = useState("ZET");
  const [customPrefix,  setCustomPrefix]  = useState("");
  const [customCompany, setCustomCompany] = useState("");

  // State
  const [selected,   setSelected]    = useState("");
  const [searchTerm, setSearchTerm]  = useState("");
  const [manualMode, setManualMode]  = useState(false);
  const [manualVal,  setManualVal]   = useState("");
  const searchRef = useRef(null);

  // ── Derive from props whenever they change ──────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const p = customerName.trim();
    setPrefix(p ? p[0].toUpperCase() : "");
    const { first, last } = extractSegments(partNo);
    setPartFirst(first);
    setPartLast(last);
    setSelected(currentValue || "");
    setManualVal(currentValue || "");
    setManualMode(false);
    setSearchTerm("");
    setTimeout(() => searchRef.current?.focus(), 120);
  }, [isOpen, customerName, partNo, currentValue]);

  // ── Computed values ─────────────────────────────────────────────────────
  const effectivePrefix  = prefixCode  === "Custom" ? customPrefix  : prefixCode;
  const effectiveCompany = companyCode === "Custom" ? customCompany : companyCode;
  const generated = buildBO(prefix, effectivePrefix, partFirst, effectiveCompany, partLast);

  const suggestions = generateSuggestions(prefix, partFirst, partLast);
  const filtered = suggestions.filter(s =>
    !searchTerm || s.value.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const finalValue = manualMode ? manualVal : (selected || generated);

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={styles.drawer}>

        {/* ── Header ── */}
        <div style={styles.header}>
          <div>
            <p style={styles.headerSub}>Part number builder</p>
            <h2 style={styles.headerTitle}>Modified BO part number</h2>
          </div>
          <button style={styles.closeBtn} onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={styles.body}>

          {/* ── Auto-fetched info ── */}
          <div style={styles.section}>
            <p style={styles.sectionLabel}>Auto-fetched from enquiry</p>
            <div style={styles.infoGrid}>
              <InfoPill label="Customer" value={customerName || "—"} color="#E8F0FE" textColor="#1A56DB" />
              <InfoPill label="Customer prefix" value={prefix || "—"} color="#FEF3C7" textColor="#92400E" />
              <InfoPill label="Original part no" value={partNo || "—"} color="#F3F4F6" textColor="#374151" mono />
              <InfoPill label="First 3 digits" value={partFirst || "—"} color="#ECFDF5" textColor="#065F46" mono />
              <InfoPill label="Last 3 digits"  value={partLast  || "—"} color="#ECFDF5" textColor="#065F46" mono />
            </div>
          </div>

          {/* ── Editable overrides ── */}
          <div style={styles.section}>
            <p style={styles.sectionLabel}>Configure format</p>
            <div style={styles.configGrid}>

              {/* Customer prefix override */}
              <div>
                <label style={styles.fieldLabel}>Customer prefix (editable)</label>
                <input
                  style={styles.monoInput}
                  maxLength={4}
                  value={prefix}
                  onChange={e => setPrefix(e.target.value.toUpperCase())}
                  placeholder="F"
                />
              </div>

              {/* Prefix type */}
              <div>
                <label style={styles.fieldLabel}>Prefix type</label>
                <select style={styles.select} value={prefixCode} onChange={e => setPrefixCode(e.target.value)}>
                  {PREFIX_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
                {prefixCode === "Custom" && (
                  <input style={{...styles.monoInput, marginTop: 6}} maxLength={6}
                    placeholder="Enter custom…" value={customPrefix}
                    onChange={e => setCustomPrefix(e.target.value.toUpperCase())} />
                )}
              </div>

              {/* Part first 3 */}
              <div>
                <label style={styles.fieldLabel}>First 3 digits</label>
                <input style={styles.monoInput} maxLength={3} value={partFirst}
                  onChange={e => setPartFirst(e.target.value.replace(/\D/g,""))} placeholder="051" />
              </div>

              {/* Company code */}
              <div>
                <label style={styles.fieldLabel}>Company code</label>
                <select style={styles.select} value={companyCode} onChange={e => setCompanyCode(e.target.value)}>
                  {COMPANY_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
                {companyCode === "Custom" && (
                  <input style={{...styles.monoInput, marginTop: 6}} maxLength={6}
                    placeholder="Enter custom…" value={customCompany}
                    onChange={e => setCustomCompany(e.target.value.toUpperCase())} />
                )}
              </div>

              {/* Part last 3 */}
              <div>
                <label style={styles.fieldLabel}>Last 3 digits</label>
                <input style={styles.monoInput} maxLength={3} value={partLast}
                  onChange={e => setPartLast(e.target.value.replace(/\D/g,""))} placeholder="007" />
              </div>

            </div>
          </div>

          {/* ── Live preview ── */}
          <div style={styles.previewBox}>
            <div style={styles.previewLeft}>
              <p style={styles.previewLabel}>Live preview</p>
              <p style={styles.previewValue}>{manualMode ? manualVal : generated}</p>
            </div>
            <div style={styles.previewBreakdown}>
              {[
                { val: prefix,          tip: "Customer prefix" },
                { val: effectivePrefix, tip: "Prefix type" },
                { val: partFirst,       tip: "First 3 digits" },
                { val: effectiveCompany,tip: "Company code" },
                { val: partLast,        tip: "Last 3 digits" },
              ].map((seg, i) => (
                <span key={i} style={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <span title={seg.tip} style={styles.segChip}>{seg.val || "—"}</span>
                  {i < 4 && <span style={{ color: "#9CA3AF", fontSize: 11 }}>+</span>}
                </span>
              ))}
            </div>
          </div>

          {/* ── Manual override ── */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <label style={styles.sectionLabel}>Manual override</label>
              <button style={styles.toggleLink} onClick={() => {
                setManualMode(p => {
                  if (!p) setManualVal(selected || generated);
                  return !p;
                });
              }}>
                {manualMode ? "← Back to builder" : "Type manually"}
              </button>
            </div>
            {manualMode && (
              <input
                style={{...styles.monoInput, fontSize: 16, letterSpacing: 2}}
                value={manualVal}
                onChange={e => setManualVal(e.target.value.toUpperCase())}
                placeholder="Enter BO part number…"
                autoFocus
              />
            )}
          </div>

          {/* ── Suggestions ── */}
          <div style={styles.section}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <p style={{...styles.sectionLabel, marginBottom: 0}}>Suggested formats ({filtered.length})</p>
              <div style={styles.searchWrap}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" style={{ flexShrink: 0 }}>
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input ref={searchRef} style={styles.searchInput} placeholder="Filter…"
                  value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
            </div>

            <div style={styles.suggGrid}>
              {filtered.map(s => {
                const isSel = s.value === selected;
                return (
                  <div key={s.value}
                    onClick={() => { setSelected(s.value); setPrefixCode(s.prefixCode); setCompanyCode(s.companyCode); setManualMode(false); }}
                    style={{
                      ...styles.suggItem,
                      background: isSel ? "#EEF2FF" : "#F9FAFB",
                      border: `1.5px solid ${isSel ? "#6366F1" : "#E5E7EB"}`,
                      color: isSel ? "#4338CA" : "#374151",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{
                        width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                        background: isSel ? "#6366F1" : "#E5E7EB",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {isSel && <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                          <polyline points="1,6 4,9 11,2" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>}
                      </span>
                      <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: isSel ? 600 : 400 }}>{s.value}</span>
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: isSel ? "#C7D2FE" : "#E5E7EB", color: isSel ? "#3730A3" : "#6B7280" }}>{s.prefixCode}</span>
                      <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: isSel ? "#C7D2FE" : "#E5E7EB", color: isSel ? "#3730A3" : "#6B7280" }}>{s.companyCode}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* ── Footer ── */}
        <div style={styles.footer}>
          <div style={styles.footerPreview}>
            <span style={{ fontSize: 12, color: "#6B7280" }}>Will apply:</span>
            <span style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 700, color: "#111827", letterSpacing: 1.5 }}>
              {finalValue || "—"}
            </span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button style={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button
              style={{ ...styles.applyBtn, opacity: finalValue ? 1 : 0.4, cursor: finalValue ? "pointer" : "not-allowed" }}
              disabled={!finalValue}
              onClick={() => { onApply(finalValue); onClose(); }}
            >
              Apply BO part number
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── InfoPill sub-component ────────────────────────────────────────────────
function InfoPill({ label, value, color, textColor, mono }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</span>
      <span style={{
        padding: "4px 10px", borderRadius: 6, background: color, color: textColor,
        fontSize: mono ? 13 : 14, fontFamily: mono ? "monospace" : "inherit", fontWeight: 500,
        display: "inline-block",
      }}>{value}</span>
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────
const styles = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
    zIndex: 1000, display: "flex", alignItems: "stretch", justifyContent: "flex-end",
  },
  drawer: {
    width: "min(520px, 100vw)", background: "#fff", display: "flex",
    flexDirection: "column", height: "100vh", overflowY: "auto",
    boxShadow: "-8px 0 32px rgba(0,0,0,0.12)",
    animation: "slideIn 0.22s cubic-bezier(.4,0,.2,1)",
  },
  header: {
    display: "flex", alignItems: "flex-start", justifyContent: "space-between",
    padding: "22px 24px 18px", borderBottom: "1px solid #F3F4F6", position: "sticky", top: 0,
    background: "#fff", zIndex: 10,
  },
  headerSub:   { fontSize: 12, color: "#6B7280", margin: 0, fontWeight: 500, letterSpacing: 0.3 },
  headerTitle: { fontSize: 20, fontWeight: 700, color: "#111827", margin: "4px 0 0", letterSpacing: -0.3 },
  closeBtn: {
    background: "#F3F4F6", border: "none", borderRadius: 8, width: 32, height: 32,
    display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6B7280",
  },
  body: { flex: 1, padding: "20px 24px", overflowY: "auto" },
  section: { marginBottom: 24 },
  sectionLabel: { fontSize: 12, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 },
  infoGrid: { display: "flex", flexWrap: "wrap", gap: 10 },
  configGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 },
  fieldLabel: { display: "block", fontSize: 12, color: "#6B7280", fontWeight: 500, marginBottom: 5 },
  monoInput: {
    width: "100%", padding: "8px 10px", fontFamily: "monospace", fontSize: 14, fontWeight: 600,
    border: "1.5px solid #E5E7EB", borderRadius: 8, outline: "none", background: "#F9FAFB",
    color: "#111827", letterSpacing: 1, boxSizing: "border-box",
    transition: "border-color 0.15s",
  },
  select: {
    width: "100%", padding: "8px 10px", fontSize: 13, fontWeight: 500,
    border: "1.5px solid #E5E7EB", borderRadius: 8, outline: "none", background: "#F9FAFB",
    color: "#374151", boxSizing: "border-box", cursor: "pointer",
  },
  previewBox: {
    background: "linear-gradient(135deg, #EEF2FF 0%, #F0FDF4 100%)",
    border: "1.5px solid #C7D2FE", borderRadius: 12, padding: "16px 20px",
    marginBottom: 20, display: "flex", flexDirection: "column", gap: 12,
  },
  previewLeft: {},
  previewLabel: { fontSize: 11, fontWeight: 600, color: "#6366F1", textTransform: "uppercase", letterSpacing: 0.6, margin: "0 0 4px" },
  previewValue: { fontFamily: "monospace", fontSize: 26, fontWeight: 800, color: "#1E1B4B", letterSpacing: 3, margin: 0 },
  previewBreakdown: { display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" },
  segChip: {
    fontFamily: "monospace", fontSize: 11, padding: "2px 7px", borderRadius: 4,
    background: "rgba(99,102,241,0.12)", color: "#4338CA", fontWeight: 700, cursor: "default",
  },
  toggleLink: {
    background: "none", border: "none", color: "#6366F1", fontSize: 12,
    fontWeight: 500, cursor: "pointer", padding: 0,
  },
  searchWrap: {
    display: "flex", alignItems: "center", gap: 6, background: "#F9FAFB",
    border: "1px solid #E5E7EB", borderRadius: 6, padding: "5px 10px", width: 140,
  },
  searchInput: {
    border: "none", outline: "none", background: "transparent", fontSize: 12,
    color: "#374151", width: "100%",
  },
  suggGrid: { display: "flex", flexDirection: "column", gap: 6 },
  suggItem: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "9px 12px", borderRadius: 8, cursor: "pointer", transition: "all 0.12s",
  },
  footer: {
    borderTop: "1px solid #F3F4F6", padding: "16px 24px",
    display: "flex", alignItems: "center", justifyContent: "space-between",
    position: "sticky", bottom: 0, background: "#fff",
  },
  footerPreview: { display: "flex", alignItems: "center", gap: 10 },
  cancelBtn: {
    padding: "9px 18px", borderRadius: 8, border: "1.5px solid #E5E7EB",
    background: "#fff", color: "#374151", fontSize: 13, fontWeight: 500, cursor: "pointer",
  },
  applyBtn: {
    padding: "9px 20px", borderRadius: 8, border: "none",
    background: "#6366F1", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
  },
};