/* ─────────────────────────────────────────────────────────────
   Create-Enquiry draft auto-save (browser localStorage)

   • Saves everything typed in the "Create New Enquiry" form while the user types,
     so a refresh / accidental close / crash doesn't lose it.
   • Stored per logged-in user, expires after 7 days, versioned.
   • Cleared after a successful create, or when the user clicks "Discard draft".
   • Create flow only — editing a saved enquiry is untouched.
───────────────────────────────────────────────────────────── */

const VERSION = 1;
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

const userKey = () => {
  try {
    const u = JSON.parse(localStorage.getItem("erp_user") || "null");
    return (u && (u.id || u._id || u.employeeId || u.email)) || "anon";
  } catch { return "anon"; }
};
const KEY = () => `erp_enquiry_create_draft_v${VERSION}:${userKey()}`;

const PART_TEXT_FIELDS = ["customerPartNo", "customerPartName", "modifiedBOPartNo", "boPartName", "itemDescription"];
const blank = (v) => v === undefined || v === null || String(v).trim() === "";

/** True when nothing meaningful has been typed (so there is nothing worth saving). */
export function isDraftEmpty({ form = {}, parts = [], partSuppliers = {}, supplierDraft = {}, supplierPoDraft = {}, supplierDateDraft = {} }, emptyForm = {}) {
  const formEmpty = Object.keys(form).every((k) => k === "enquiryNumberMode" || blank(form[k]) || String(form[k]) === String(emptyForm[k] ?? ""));
  if (!formEmpty) return false;
  const partEmpty = (p) => PART_TEXT_FIELDS.every((f) => blank(p && p[f])) && (p.children || []).every(partEmpty);
  if (!parts.every(partEmpty)) return false;
  if (Object.values(partSuppliers).some((l) => Array.isArray(l) && l.length)) return false;
  return ![supplierDraft, supplierPoDraft, supplierDateDraft].some((d) => Object.values(d).some((v) => !blank(v)));
}

export function loadEnquiryDraft() {
  try {
    const raw = localStorage.getItem(KEY());
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || d.v !== VERSION || !d.form || typeof d.form !== "object" || !Array.isArray(d.parts) || !d.parts.length) return null;
    if (!d.parts.every((p) => p && typeof p === "object" && p.id && Array.isArray(p.children || []))) return null;
    if (Date.now() - (d.savedAt || 0) > TTL_MS) { localStorage.removeItem(KEY()); return null; }
    return d;
  } catch { return null; }
}

/** Returns true if the write succeeded (false e.g. when storage is full/blocked). */
export function saveEnquiryDraft(data) {
  try {
    localStorage.setItem(KEY(), JSON.stringify({ v: VERSION, savedAt: Date.now(), wasOpen: true, ...data }));
    return true;
  } catch { return false; }
}

/** Keep the draft's content but remember the form was closed (so a refresh doesn't reopen it). */
export function markEnquiryDraftClosed() {
  try {
    const raw = localStorage.getItem(KEY());
    if (!raw) return;
    const d = JSON.parse(raw);
    d.wasOpen = false;
    localStorage.setItem(KEY(), JSON.stringify(d));
  } catch { /* ignore */ }
}

export function clearEnquiryDraft() {
  try { localStorage.removeItem(KEY()); } catch { /* ignore */ }
}

/** True when a refresh happened while the Create form was open with real content. */
export function hasOpenEnquiryDraft() {
  const d = loadEnquiryDraft();
  return !!(d && d.wasOpen);
}
