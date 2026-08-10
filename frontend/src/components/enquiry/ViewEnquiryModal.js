import React from "react";

function formatDateShort(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d)) return "—";
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const dd = String(d.getDate()).padStart(2, "0");
  const mmm = months[d.getMonth()];
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}-${mmm}-${yy}`;
}

function formatDateISO(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d)) return "—";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d)) return "";
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const dd = String(d.getDate()).padStart(2, "0");
  const mmm = months[d.getMonth()];
  const yy = String(d.getFullYear()).slice(-2);
  let h = d.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}-${mmm}-${yy} ${String(h).padStart(2, "0")}:${min} ${ampm}`;
}

/* ── Small SVG icons ── */
const IconDoc = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
  </svg>
);
const IconLink = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
  </svg>
);
const IconBox = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>
);
const IconGen = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>
);
const IconHistory = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const IconUser = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const IconClock = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const IconCal = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
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

export default function ViewEnquiryModal({ isOpen, onClose, enquiry }) {
  if (!isOpen || !enquiry) return null;

  const hasMultiParts = Array.isArray(enquiry.parts) && enquiry.parts.length > 0;
  const hasMultiPO = Array.isArray(enquiry.poDetailsList) && enquiry.poDetailsList.length > 0;

  // Suppliers assigned per-part ("Assign Suppliers to Parts"), normalized the
  // same way the table does — handles legacy string[] suppliers too.
  const partSuppliersList = (Array.isArray(enquiry.partSuppliers) ? enquiry.partSuppliers : [])
    .map((ps) => ({
      customerPartNo: ps.customerPartNo || "",
      suppliers: (Array.isArray(ps.suppliers) ? ps.suppliers : []).map((s) =>
        typeof s === "string"
          ? { name: s, poNumber: "", dateOfIssue: "" }
          : { name: s.name || "", poNumber: s.poNumber || "", dateOfIssue: s.dateOfIssue || "" }
      ),
    }))
    .filter((ps) => ps.suppliers.length > 0);
  const hasPartSuppliers = partSuppliersList.length > 0;

  const stored = (enquiry.editHistory || []).map((item) => ({
    section: item.section,
    sectionColor: item.sectionColor || "bo",
    description: item.description,
    user: item.user,
    time: formatDateTime(item.timestamp),
  }));

  const creationEntry = {
    section: "BO / Enquiry Details",
    sectionColor: "bo",
    description: "Enquiry record created",
    user: enquiry.generatedBy || "System",
    time: formatDateTime(enquiry.createdAt),
  };

  // Always show creation entry first; skip synthesizing it only if it's already stored
  const hasCreationEntry = stored.some((e) =>
    (e.description || "").toLowerCase().includes("created")
  );
  const editHistory = hasCreationEntry ? stored : [creationEntry, ...stored];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container view-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h2>Enquiry Details</h2>
          <p>Complete information and edit history for enquiry <strong className="view-enq-no">{enquiry.enquiryNumber}</strong></p>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <hr className="modal-divider" />

        <div className="view-modal-scroll">
          {/* ─── BO / Enquiry Details ─── */}
          <div className="view-card-section bo-bg">
            <div className="view-card-blob bo-card-blob" />
            <div className="view-card-header">
              <span className="view-card-icon bo-icon"><IconDoc /></span>
              <span className="view-card-title">BO / Enquiry Details</span>
            </div>
            <div className="view-fields-grid">
              <div className="view-field-card">
                <label>CUSTOMER NAME</label>
                <span>{enquiry.customerName || "—"}</span>
              </div>
              <div className="view-field-card">
                <label>CUSTOMER RFQ DATE</label>
                <span className="view-date-val"><IconCal /> {formatDateISO(enquiry.customerRFQDate)}</span>
              </div>
            </div>
            <div className="view-fields-grid single">
              <div className="view-field-card">
                <label>ITEM DESCRIPTION</label>
                <span>{enquiry.itemDescription || "—"}</span>
              </div>
            </div>
            <div className="view-fields-grid">
              <div className="view-field-card">
                <label>ENQUIRY NO.</label>
                <span><span className="view-badge blue">{enquiry.enquiryNumber || "—"}</span></span>
              </div>
              <div className="view-field-card">
                <label>LAST EDITED</label>
                <span className="view-meta-info">
                  <span className="view-meta-chip"><IconUser /> {enquiry.generatedBy || "—"}</span>
                  <span className="view-meta-chip"><IconClock /> {formatDateShort(enquiry.createdAt)}</span>
                </span>
              </div>
            </div>
          </div>

          {/* ─── Parts Details (parent parts + nested child parts) ─── */}
          <div className="view-card-section part-bg">
            <div className="view-card-blob part-card-blob" />
            <div className="view-card-header">
              <span className="view-card-icon part-icon"><IconLink /></span>
              <span className="view-card-title">
                Parts Details{hasMultiParts ? ` (${enquiry.parts.length} part${enquiry.parts.length > 1 ? "s" : ""})` : ""}
              </span>
            </div>

            {hasMultiParts ? (
              <div className="parts-hierarchy">
                {enquiry.parts.map((p, idx) => (
                  <div className="parts-h-parent" key={idx}>
                    <div className="parts-h-parent-header">
                      <span className="parts-h-badge parent"><IconParentTag /> Parent Part {idx + 1}</span>
                      {p.customerPartNo && <span className="parts-h-name">{p.customerPartNo}</span>}
                    </div>
                    <div className="view-fields-grid">
                      <div className="view-field-card">
                        <label>CUSTOMER PART NO</label>
                        <span>{p.customerPartNo || "—"}</span>
                      </div>
                      <div className="view-field-card">
                        <label>CUSTOMER PART NAME</label>
                        <span>{p.customerPartName || "—"}</span>
                      </div>
                    </div>
                    <div className="view-fields-grid">
                      <div className="view-field-card">
                        <label>MODIFIED BO PART NO</label>
                        <span>
                          {p.modifiedBOPartNo
                            ? <span className="view-badge pink">{p.modifiedBOPartNo}</span>
                            : "—"}
                        </span>
                      </div>
                      <div className="view-field-card">
                        <label>BO PART NAME</label>
                        <span>{p.boPartName || "—"}</span>
                      </div>
                    </div>

                    {Array.isArray(p.children) && p.children.length > 0 && (
                      <div className="parts-h-children">
                        {p.children.map((c, cidx) => (
                          <div className="parts-h-child" key={cidx}>
                            <div className="parts-h-child-header">
                              <span className="parts-h-badge child"><IconChildTag /> Child Part {cidx + 1}</span>
                              {c.customerPartNo && <span className="parts-h-name">{c.customerPartNo}</span>}
                            </div>
                            <div className="view-fields-grid">
                              <div className="view-field-card">
                                <label>CUSTOMER PART NO</label>
                                <span>{c.customerPartNo || "—"}</span>
                              </div>
                              <div className="view-field-card">
                                <label>CUSTOMER PART NAME</label>
                                <span>{c.customerPartName || "—"}</span>
                              </div>
                            </div>
                            <div className="view-fields-grid">
                              <div className="view-field-card">
                                <label>MODIFIED BO PART NO</label>
                                <span>
                                  {c.modifiedBOPartNo
                                    ? <span className="view-badge pink">{c.modifiedBOPartNo}</span>
                                    : "—"}
                                </span>
                              </div>
                              <div className="view-field-card">
                                <label>BO PART NAME</label>
                                <span>{c.boPartName || "—"}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              /* Legacy single-part enquiries: fall back to partMapping exactly as before */
              <>
                <div className="view-fields-grid">
                  <div className="view-field-card">
                    <label>CUSTOMER PART NO</label>
                    <span>{enquiry.partMapping?.customerPartNo || "—"}</span>
                  </div>
                  <div className="view-field-card">
                    <label>CUSTOMER PART NAME</label>
                    <span>{enquiry.partMapping?.customerPartName || "—"}</span>
                  </div>
                </div>
                <div className="view-fields-grid">
                  <div className="view-field-card">
                    <label>MODIFIED BO PART NO</label>
                    <span>
                      {enquiry.partMapping?.modifiedBOPartNo
                        ? <span className="view-badge pink">{enquiry.partMapping.modifiedBOPartNo}</span>
                        : "—"}
                    </span>
                  </div>
                  <div className="view-field-card">
                    <label>BO PART NAME</label>
                    <span>{enquiry.partMapping?.boPartName || "—"}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ─── PO Number Details ─── */}
          <div className="view-card-section po-bg">
            <div className="view-card-blob po-card-blob" />
            <div className="view-card-header">
              <span className="view-card-icon po-icon"><IconBox /></span>
              <span className="view-card-title">
                PO Number Details{hasMultiPO ? ` (${enquiry.poDetailsList.length} supplier${enquiry.poDetailsList.length > 1 ? "s" : ""})` : ""}
              </span>
            </div>

            {hasMultiPO ? (
              <div className="parts-hierarchy">
                {enquiry.poDetailsList.map((po, idx) => (
                  <div className="parts-h-parent" key={idx}>
                    <div className="parts-h-parent-header">
                      <span className="parts-h-badge parent"><IconParentTag /> Supplier {idx + 1}</span>
                      {po.supplierName && <span className="parts-h-name">{po.supplierName}</span>}
                      {po.linkedPartNo && (
                        <span className="view-badge pink" style={{ marginLeft: 8 }}>
                          for part: {po.linkedPartNo}
                        </span>
                      )}
                    </div>
                    <div className="view-fields-grid">
                      <div className="view-field-card">
                        <label>SUPPLIER NAME</label>
                        <span>{po.supplierName || "—"}</span>
                      </div>
                      <div className="view-field-card">
                        <label>PO NUMBER</label>
                        <span>
                          {po.poNumber
                            ? <span className="view-badge green">{po.poNumber}</span>
                            : "—"}
                        </span>
                      </div>
                    </div>
                    <div className="view-fields-grid">
                      <div className="view-field-card">
                        <label>DATE OF ISSUE</label>
                        <span className="view-date-val"><IconCal /> {formatDateShort(po.dateOfIssue)}</span>
                      </div>
                      <div className="view-field-card">
                        <label>APPLIES TO</label>
                        <span>{po.linkedPartNo || "Whole enquiry"}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : hasPartSuppliers ? (
              // ── Suppliers assigned per Part (the "Assign Suppliers to Parts" section) ──
              <div className="parts-hierarchy">
                {partSuppliersList.map((ps, pIdx) => (
                  <div className="parts-h-parent" key={pIdx}>
                    <div className="parts-h-parent-header">
                      <span className="parts-h-badge parent"><IconParentTag /> Part</span>
                      {ps.customerPartNo && <span className="parts-h-name">{ps.customerPartNo}</span>}
                    </div>
                    {ps.suppliers.map((s, sIdx) => (
                      <div key={sIdx} style={{ marginTop: sIdx > 0 ? 10 : 0 }}>
                        <div className="view-fields-grid">
                          <div className="view-field-card">
                            <label>SUPPLIER NAME</label>
                            <span>{s.name || "—"}</span>
                          </div>
                          <div className="view-field-card">
                            <label>PO NUMBER</label>
                            <span>
                              {s.poNumber
                                ? <span className="view-badge green">{s.poNumber}</span>
                                : "—"}
                            </span>
                          </div>
                        </div>
                        <div className="view-fields-grid">
                          <div className="view-field-card">
                            <label>DATE OF ISSUE</label>
                            <span className="view-date-val"><IconCal /> {formatDateShort(s.dateOfIssue)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="view-fields-grid">
                  <div className="view-field-card">
                    <label>SUPPLIER NAME</label>
                    <span>{enquiry.poDetails?.supplierName || "—"}</span>
                  </div>
                  <div className="view-field-card">
                    <label>PO NUMBER</label>
                    <span>
                      {enquiry.poDetails?.poNumber
                        ? <span className="view-badge green">{enquiry.poDetails.poNumber}</span>
                        : "—"}
                    </span>
                  </div>
                </div>
                <div className="view-fields-grid">
                  <div className="view-field-card">
                    <label>DATE OF ISSUE</label>
                    <span className="view-date-val"><IconCal /> {formatDateShort(enquiry.poDetails?.dateOfIssue)}</span>
                  </div>
                  <div className="view-field-card">
                    <label>LAST EDITED</label>
                    <span className="view-meta-info">
                      <span className="view-meta-chip"><IconUser /> {enquiry.generatedBy || "—"}</span>
                      <span className="view-meta-chip"><IconClock /> {formatDateShort(enquiry.createdAt)}</span>
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ─── Generation Information ─── */}
          <div className="view-card-section gen-bg">
            <div className="view-card-header">
              <span className="view-card-icon gen-icon"><IconGen /></span>
              <span className="view-card-title">Generation Information</span>
            </div>
            <div className="view-fields-grid">
              <div className="view-field-card">
                <label>GENERATED BY</label>
                <span className="view-gen-val"><IconUser /> {enquiry.generatedBy || "—"}</span>
              </div>
              <div className="view-field-card">
                <label>GENERATED ON</label>
                <span className="view-gen-val"><IconCal /> {formatDateShort(enquiry.createdAt)}</span>
              </div>
            </div>
          </div>

          <hr className="modal-divider" />

          {/* ─── Complete Edit History ─── */}
          <div className="view-history-section">
            <div className="view-history-header">
              <span className="view-history-icon"><IconHistory /></span>
              <span>Complete Edit History</span>
            </div>
            <div className="view-history-timeline">
              {editHistory.length === 0 ? (
                <p className="history-empty">No edit history available.</p>
              ) : (
                editHistory.map((item, idx) => (
                  <div className="history-card" key={idx}>
                    <span className={`history-badge ${item.sectionColor}`}>{item.section}</span>
                    <p className="history-desc">{item.description}</p>
                    <div className="history-meta">
                      <span className="history-chip"><IconUser /> {item.user}</span>
                      <span className="history-chip"><IconClock /> {item.time}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="modal-cancel-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
