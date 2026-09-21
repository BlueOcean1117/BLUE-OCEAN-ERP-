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
  const [downloadingAll, setDownloadingAll] = useState(false); // ✅ NEW

  // ✅ NEW — Label Document (6th option). Fully isolated state; nothing
  // above this touches or reads these.
  const [labelStep, setLabelStep] = useState(null); // null | "choose" | "form"
  const [labelMode, setLabelMode] = useState(null); // "single" | "multiple"
  const [poInputs, setPoInputs] = useState([""]);
  const [labelGenerating, setLabelGenerating] = useState(false);

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

  // ✅ NEW — generate all 5 documents as PDFs and download them bundled into
  // a single ZIP. Reuses the same generate-document pipeline server-side;
  // this just calls the new /generate-all-documents endpoint.
  const handleDownloadAll = async () => {
    try {
      setDownloadingAll(true);
      const res = await API.post(
        `/shipment/${shipment._id}/generate-all-documents`,
        {},
        { responseType: "blob" }
      );
      const skippedHeader = res.headers?.["x-skipped-documents"];
      if (skippedHeader) {
        toast.warn(`Some documents were skipped: ${decodeURIComponent(skippedHeader)}`);
      }
      const blob = new Blob([res.data], { type: "application/zip" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Documents_${shipment.enquiry_no || shipment._id}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("All documents generated ✅");
    } catch (err) {
      await reportGenerateError(err);
    } finally {
      setDownloadingAll(false);
    }
  };

  // ✅ NEW — Label Document handlers. Isolated from every handler above;
  // none of the existing 5-document logic is called or modified here.
  const startLabelFlow = () => {
    setLabelStep("choose");
    setLabelMode(null);
    setPoInputs([""]);
  };

  const chooseLabelMode = (mode) => {
    setLabelMode(mode);
    setPoInputs([""]);
    setLabelStep("form");
  };

  const updatePoInput = (idx, value) => {
    setPoInputs((prev) => prev.map((v, i) => (i === idx ? value : v)));
  };

  const addPoInput = () => setPoInputs((prev) => [...prev, ""]);
  const removePoInput = (idx) => setPoInputs((prev) => prev.filter((_, i) => i !== idx));

  const backToDocList = () => {
    setLabelStep(null);
    setLabelMode(null);
    setPoInputs([""]);
  };

  const handleGenerateLabels = async () => {
    const poNumbers = poInputs.map((p) => p.trim()).filter(Boolean);
    if (poNumbers.length === 0) {
      toast.error("Enter at least one PO Number");
      return;
    }
    try {
      setLabelGenerating(true);
      const res = await API.post(
        `/shipment/${shipment._id}/generate-label`,
        { poNumbers },
        { responseType: "blob" }
      );
      const contentType = res.headers?.["content-type"] || "";
      const isZip = contentType.includes("zip");
      const blob = new Blob([res.data], { type: isZip ? "application/zip" : "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = isZip ? `Labels_${Date.now()}.zip` : `Label_${poNumbers[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      const skippedHeader = res.headers?.["x-skipped-pos"];
      if (skippedHeader) {
        toast.warn(`Some PO Numbers were skipped: ${decodeURIComponent(skippedHeader)}`);
      }
      toast.success("Label document generated ✅");
    } catch (err) {
      // ✅ NEW — Label-specific error handling: surfaces the *actual* reason
      // (from the backend's `details` array — e.g. "PO Number not found.")
      // instead of just the generic top-level message, since that's the
      // whole point of this toast for debugging a specific PO.
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          const details = Array.isArray(parsed.details) ? parsed.details.join(" | ") : "";
          toast.error(details || parsed.message || "Failed to generate label");
        } catch {
          toast.error("Failed to generate label");
        }
      } else {
        const details = Array.isArray(err.response?.data?.details) ? err.response.data.details.join(" | ") : "";
        toast.error(details || err.response?.data?.message || "Failed to generate label");
      }
    } finally {
      setLabelGenerating(false);
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

        {!selectedType && !labelStep && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            {loadingList && <div>Loading…</div>}

            {!loadingList && docTypes.length > 0 && (
              <button
                className="btn"
                style={{ textAlign: "left", fontWeight: 600 }}
                disabled={downloadingAll || directGeneratingType !== null}
                onClick={handleDownloadAll}
              >
                {downloadingAll ? "Generating all 5 documents…" : "⬇ Download All (ZIP)"}
              </button>
            )}

            {!loadingList && docTypes.map((d) => (
              <button
                key={d.docType}
                className="btn"
                style={{ textAlign: "left" }}
                disabled={directGeneratingType === d.docType || downloadingAll}
                onClick={() => handleDocTypeClick(d.docType, d.label)}
              >
                {directGeneratingType === d.docType ? "Generating PDF…" : d.label}
              </button>
            ))}

            {/* ✅ NEW — 6th option, added below the existing 5. Existing
                buttons above are completely untouched. */}
            {!loadingList && (
              <button
                className="btn"
                style={{ textAlign: "left" }}
                onClick={startLabelFlow}
              >
                Label Document
              </button>
            )}
          </div>
        )}

        {/* ✅ NEW — Label Document: Step 1, One PO vs Multiple PO */}
        {labelStep === "choose" && (
          <div style={{ marginTop: 12 }}>
            <button className="btn small" style={{ marginBottom: 10 }} onClick={backToDocList}>
              ← Back to document list
            </button>
            <p style={{ fontSize: 14, marginBottom: 10 }}>
              Is this shipment for one PO Number or multiple PO Numbers?
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" onClick={() => chooseLabelMode("single")}>
                One PO Number
              </button>
              <button className="btn" onClick={() => chooseLabelMode("multiple")}>
                Multiple PO Numbers
              </button>
            </div>
          </div>
        )}

        {/* ✅ NEW — Label Document: Step 2, PO Number entry + generate */}
        {labelStep === "form" && (
          <div style={{ marginTop: 12 }}>
            <button
              className="btn small"
              style={{ marginBottom: 10 }}
              onClick={() => setLabelStep("choose")}
            >
              ← Back
            </button>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
              {poInputs.map((val, idx) => (
                <div key={idx} style={{ display: "flex", gap: 6 }}>
                  <input
                    type="text"
                    placeholder={labelMode === "single" ? "PO Number (e.g. MB00003256)" : `PO Number ${idx + 1}`}
                    value={val}
                    onChange={(e) => updatePoInput(idx, e.target.value)}
                    style={{ flex: 1, padding: "6px 8px", border: "1px solid #CBD5E1", borderRadius: 4 }}
                  />
                  {labelMode === "multiple" && poInputs.length > 1 && (
                    <button className="btn small" onClick={() => removePoInput(idx)}>✕</button>
                  )}
                </div>
              ))}
              {labelMode === "multiple" && (
                <button className="btn small" style={{ alignSelf: "flex-start" }} onClick={addPoInput}>
                  + Add another PO Number
                </button>
              )}
            </div>

            <button className="btn" disabled={labelGenerating} onClick={handleGenerateLabels}>
              {labelGenerating ? "Generating label(s)…" : "Generate Label"}
            </button>
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
