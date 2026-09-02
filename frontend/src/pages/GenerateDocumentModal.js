import React, { useEffect, useState } from "react";
import API from "../services/api";
import { toast } from "react-toastify";

// ─────────────────────────────────────────────────────────────────────────
// Document Generation modal
// Flow (updated):
//   • EVD, End Use Letter, SCOMET, Cargo Security Declaration → clicking the
//     name generates & downloads the PDF directly. No verification/preview
//     page. Editable fields (Part Description, End User, HAWB, MAWB) fall
//     back to their existing shipment-derived defaults since there's no
//     longer a step to edit them before download.
//   • Authority Letter → unchanged: clicking the name still opens the
//     preview page (Invoice No./Date) with its own "Generate & Download"
//     button, per explicit instruction to keep that step for this one
//     document only. Its download is now a PDF as well.
// Still talks only to the existing /shipment/:id/document-types,
// /generate-document/:docType/preview and /generate-document/:docType
// endpoints — no existing shipment API call is touched.
// ─────────────────────────────────────────────────────────────────────────

const FIELD_LABELS = {
  part_desc: "Part Description",
  end_user: "End User / Customer",
  sector: "Sector",
  hawb: "HAWB #",
  mawb: "MAWB #",
};

// ✅ NEW — doc types that keep the verification/preview page. Everything
// else skips straight to generate + PDF download on click.
const KEEP_PREVIEW_FOR = new Set([]);

// ✅ NEW — fixed PDF filenames (mirrors backend PDF_FILENAMES)
const PDF_FILENAMES = {
  evd: "EVD.pdf",
  end_use_letter: "End_Use_Letter.pdf",
  scomet: "SCOMET_Declaration.pdf",
  authority_letter: "Authority_Letter.pdf",
  cargo_security_declaration: "Cargo_Security_Declaration.pdf",
};

// ✅ NEW — shared error decoder (unchanged logic, pulled out so both the
// direct-download path and the existing preview path can use it)
async function reportGenerateError(err) {
  if (err.response?.data instanceof Blob) {
    try {
      const text = await err.response.data.text();
      const parsed = JSON.parse(text);
      toast.error(parsed.message || "Failed to generate document");
    } catch {
      toast.error("Failed to generate document");
    }
  } else {
    toast.error(err.response?.data?.message || "Failed to generate document");
  }
}

export default function GenerateDocumentModal({ shipment, onClose }) {
  const [docTypes, setDocTypes] = useState([]);
  const [selectedType, setSelectedType] = useState(null);
  const [preview, setPreview] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [loadingList, setLoadingList] = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [directGeneratingType, setDirectGeneratingType] = useState(null); // ✅ NEW

  useEffect(() => {
    let cancelled = false;
    API.get(`/shipment/${shipment._id}/document-types`)
      .then((res) => { if (!cancelled) setDocTypes(res.data || []); })
      .catch(() => { if (!cancelled) toast.error("Failed to load document types"); })
      .finally(() => { if (!cancelled) setLoadingList(false); });
    return () => { cancelled = true; };
  }, [shipment._id]);

  const selectDocType = (docType) => {
    setSelectedType(docType);
    setPreview(null);
    setLoadingPreview(true);
    API.get(`/shipment/${shipment._id}/generate-document/${docType}/preview`)
      .then((res) => {
        setPreview(res.data);
        setEditValues(res.data.editable || {});
      })
      .catch(() => toast.error("Failed to load document preview"))
      .finally(() => setLoadingPreview(false));
  };

  const downloadPdfBlob = (blobData, docType, label) => {
    const blob = new Blob([blobData], { type: "application/pdf" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = PDF_FILENAMES[docType] || `${label || "document"}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    toast.success("Document generated ✅");
  };

  // Existing flow — used only for Authority Letter now (still has its
  // preview page + "Generate & Download" button). Same endpoint, same
  // editable-field submission; only the response is now PDF.
  const handleGenerate = async () => {
    if (!selectedType) return;
    try {
      setGenerating(true);
      const res = await API.post(
        `/shipment/${shipment._id}/generate-document/${selectedType}?format=pdf`,
        { editableFields: editValues },
        { responseType: "blob" }
      );
      downloadPdfBlob(res.data, selectedType, preview?.label);
    } catch (err) {
      await reportGenerateError(err);
    } finally {
      setGenerating(false);
    }
  };

  // ✅ NEW — direct generate + download, no preview step. Used for every
  // doc type except the ones in KEEP_PREVIEW_FOR. Editable fields are not
  // collected here, so the backend falls back to its existing
  // shipment-derived defaults for them (same defaults the preview page
  // used to pre-fill).
  const handleDirectGenerate = async (docType, label) => {
    try {
      setDirectGeneratingType(docType);
      const res = await API.post(
        `/shipment/${shipment._id}/generate-document/${docType}?format=pdf`,
        { editableFields: {} },
        { responseType: "blob" }
      );
      downloadPdfBlob(res.data, docType, label);
    } catch (err) {
      await reportGenerateError(err);
    } finally {
      setDirectGeneratingType(null);
    }
  };

  const handleDocTypeClick = (docType, label) => {
    if (KEEP_PREVIEW_FOR.has(docType)) {
      selectDocType(docType);
    } else {
      handleDirectGenerate(docType, label);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 560, width: "100%" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>Generate Document</h3>
          <button className="btn small" onClick={onClose}>✕</button>
        </div>
        <p style={{ color: "#64748B", fontSize: 13, marginTop: 4 }}>
          Shipment: <strong>{shipment.enquiry_no}</strong> — Invoice {shipment.invoice_no || "—"}
        </p>

        {!selectedType && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            {loadingList && <div>Loading…</div>}
            {!loadingList && docTypes.map((d) => (
              <button
                key={d.docType}
                className="btn"
                style={{ textAlign: "left" }}
                disabled={directGeneratingType === d.docType}
                onClick={() => handleDocTypeClick(d.docType, d.label)}
              >
                {directGeneratingType === d.docType ? "Generating PDF…" : d.label}
              </button>
            ))}
          </div>
        )}

        {selectedType && (
          <div style={{ marginTop: 12 }}>
            <button
              className="btn small"
              style={{ marginBottom: 10 }}
              onClick={() => { setSelectedType(null); setPreview(null); }}
            >
              ← Back to document list
            </button>

            {loadingPreview && <div>Loading preview…</div>}

            {!loadingPreview && preview && (
              <>
                <h4 style={{ marginBottom: 6 }}>{preview.label}</h4>

                {preview.missing && preview.missing.length > 0 && (
                  <div style={{
                    background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FCA5A5",
                    borderRadius: 6, padding: "8px 10px", fontSize: 13, marginBottom: 10,
                  }}>
                    {preview.missing.map((m, i) => <div key={i}>{m}</div>)}
                  </div>
                )}

                <div style={{ fontSize: 13, color: "#334155", marginBottom: 10 }}>
                  <div><strong>Invoice No.:</strong> {preview.invoice_no || "—"}</div>
                  <div><strong>Invoice Date:</strong> {preview.invoice_date || "—"}</div>
                  {selectedType === "cargo_security_declaration" && (
                    <div><strong>Mode:</strong> {preview.mode || "—"}</div>
                  )}
                </div>

                {preview.editableFields.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                    {preview.editableFields.map((field) => (
                      <label key={field} style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 3 }}>
                        {FIELD_LABELS[field] || field}
                        <input
                          type="text"
                          value={editValues[field] ?? ""}
                          onChange={(e) => setEditValues((p) => ({ ...p, [field]: e.target.value }))}
                          style={{ padding: "6px 8px", border: "1px solid #CBD5E1", borderRadius: 4 }}
                        />
                      </label>
                    ))}
                  </div>
                )}

                <button
                  className="btn"
                  disabled={generating || (preview.missing && preview.missing.length > 0)}
                  onClick={handleGenerate}
                >
                  {generating ? "Generating PDF…" : "Generate & Download"}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
