import React, { useState, useEffect, useRef, useCallback } from "react";
import API from "../../services/api";

const INCOTERMS = ["DAP", "EXW", "CIF", "CIP", "CFR", "CPT", "DAT", "DDP", "FAS", "FCA", "FOB"];

// ─── Debounce helper ───────────────────────────────────────────────────────────
function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function Step1({ initial = {}, onNext, onUpdate = () => {} }) {
  const [form, setForm] = useState({
    enquiry_no: "",
    ff: "",
    invoice_no: "",
    invoice_date: "",
    incoterm: "",
    mode: "Sea",
    // Customer and Supplier come AFTER Part Details (auto-filled from part master)
    customer: "",
    supplier_name: "",
    sb_no: "",
    sb_date: "",
    dispatch_date: "",
    // Dynamic Parts Array
    parts: initial.parts || [
      {
        part_no: "",
        part_desc: "",
        part_qty: 0,
        part_net_unit: 0,
        part_gross: 0,
        part_total_net_wt: 0,
        part_box_size: "",
        part_no_of_boxes: 0,
      },
    ],
    // Calculated Totals
    total_net_wt: 0,
    total_gross_wt: 0,
    total_no_of_boxes: 0,
    ...initial,
  });

  // Per-part autocomplete state: array of { query, suggestions, loading, showDropdown }
  const [partAC, setPartAC] = useState(() =>
    (initial.parts || [{}]).map(() => ({
      query: "",
      suggestions: [],
      loading: false,
      showDropdown: false,
    }))
  );

  // Per-part supplier options (when multiple suppliers exist for a part number)
  const [partSuppliers, setPartSuppliers] = useState(() =>
    (initial.parts || [{}]).map(() => [])
  );

  const dropdownRefs = useRef([]);

  /* ─── Close dropdowns on outside click ─── */
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

  /* ─── Auto-fetch enquiry number on Create mode ─── */
  useEffect(() => {
    if (!form.enquiry_no) {
      API.get("/shipment/enquiry-number")
        .then((res) => {
          if (res.data?.enquiryNo) {
            setForm((prev) => ({ ...prev, enquiry_no: res.data.enquiryNo }));
          }
        })
        .catch((err) => console.error("Failed to fetch enquiry number:", err));
    }
  }, []);

  /* ─── Totals Calculation ─── */
  useEffect(() => {
    let aggregateNet = 0;
    let aggregateGross = 0;
    let aggregateBoxes = 0;
    let aggregateQty = 0;

    form.parts.forEach((p) => {
      aggregateNet   += Number(p.part_qty || 0) * Number(p.part_net_unit || 0);
      aggregateGross += Number(p.part_gross || 0);
      aggregateBoxes += Number(p.part_no_of_boxes || 0);
      aggregateQty   += Number(p.part_qty || 0);
    });

    const updatedForm = {
      ...form,
      total_qty: aggregateQty,
      total_net_wt: aggregateNet.toFixed(2),
      total_gross_wt: aggregateGross.toFixed(2),
      total_no_of_boxes: aggregateBoxes,
    };

    setForm(updatedForm);
    onUpdate(updatedForm);
  }, [form.parts]);

  /* ─── Autocomplete search for a specific part row ─── */
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
        next[index] = {
          ...next[index],
          suggestions: res.data || [],
          loading: false,
          showDropdown: true,
        };
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

  /* ─── When a suggestion is selected from the dropdown ─── */
  const selectPartSuggestion = useCallback(
    (index, suggestion) => {
      const { part_number, part_description, customer_name, suppliers } = suggestion;

      // Update the part row with auto-filled values
      const updatedParts = [...form.parts];
      updatedParts[index] = {
        ...updatedParts[index],
        part_no: part_number,
        part_desc: part_description,
      };

      // Auto-fill customer at the top level (from first part selected, or last selected)
      const updatedForm = {
        ...form,
        parts: updatedParts,
        customer: customer_name || form.customer,
      };

      // Handle supplier logic
      const newPartSuppliers = [...partSuppliers];
      newPartSuppliers[index] = suppliers || [];

      if (suppliers && suppliers.length === 1) {
        // Single supplier — auto-fill
        updatedForm.supplier_name = suppliers[0];
      } else if (!suppliers || suppliers.length === 0) {
        // No supplier data — leave as-is
      }
      // If multiple suppliers: leave supplier_name blank; dropdown will show

      setForm(updatedForm);
      setPartSuppliers(newPartSuppliers);

      // Close the autocomplete dropdown and update query display
      setPartAC((prev) => {
        const next = [...prev];
        next[index] = {
          ...next[index],
          query: part_number,
          showDropdown: false,
          suggestions: [],
        };
        return next;
      });
    },
    [form, partSuppliers]
  );

  /* ─── Part field change handler ─── */
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

  /* ─── Part number input handler (drives autocomplete) ─── */
  const handlePartNoInput = (index, e) => {
    const value = e.target.value;

    // Update the query shown in the input
    setPartAC((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], query: value };
      return next;
    });

    // Also update the actual form field so manual entry still works
    const updatedParts = [...form.parts];
    updatedParts[index] = { ...updatedParts[index], part_no: value };
    setForm((prev) => ({ ...prev, parts: updatedParts }));

    // Trigger search
    searchPartNumber(index, value);
  };

  const addPart = () => {
    setForm((prev) => ({
      ...prev,
      parts: [
        ...prev.parts,
        {
          part_no: "",
          part_desc: "",
          part_qty: 0,
          part_net_unit: 0,
          part_gross: 0,
          part_total_net_wt: 0,
          part_box_size: "",
          part_no_of_boxes: 0,
        },
      ],
    }));
    setPartAC((prev) => [
      ...prev,
      { query: "", suggestions: [], loading: false, showDropdown: false },
    ]);
    setPartSuppliers((prev) => [...prev, []]);
  };

  const removePart = (index) => {
    setForm((prev) => ({
      ...prev,
      parts: prev.parts.filter((_, i) => i !== index),
    }));
    setPartAC((prev) => prev.filter((_, i) => i !== index));
    setPartSuppliers((prev) => prev.filter((_, i) => i !== index));
  };

  const change = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // Collect all unique suppliers across all parts for the top-level supplier dropdown
  const allSuppliersForForm = [...new Set(
    partSuppliers.flat().filter(Boolean)
  )];

  return (
    <div className="step-form">
      <h3 className="step-title">Step 1 — Shipment Details</h3>

      {/* ── Row 1: Enquiry No + FF ── */}
      <div className="form-grid">
        <div className="field">
          <label>Enquiry No</label>
          <input className="input" value={form.enquiry_no} readOnly />
        </div>
        <div className="field">
          <label>FF</label>
          <input
            className="input"
            name="ff"
            value={form.ff}
            onChange={change}
            placeholder="Freight Forwarder"
          />
        </div>
      </div>

      {/* ── Row 2: Invoice No + Invoice Date ── */}
      <div className="form-grid">
        <div className="field">
          <label>Invoice No</label>
          <input className="input" name="invoice_no" value={form.invoice_no} onChange={change} />
        </div>
        <div className="field">
          <label>Invoice Date</label>
          <input className="input" type="date" name="invoice_date" value={form.invoice_date} onChange={change} />
        </div>
      </div>

      {/* ── Row 3: Incoterm + Mode ── */}
      <div className="form-grid">
        <div className="field">
          <label>Incoterm</label>
          <select className="input" name="incoterm" value={form.incoterm} onChange={change}>
            <option value="">Select Incoterm</option>
            {INCOTERMS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Mode</label>
          <select className="input" name="mode" value={form.mode} onChange={change}>
            <option>Sea</option>
            <option>Air</option>
            <option>Road</option>
            <option>Rail</option>
          </select>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
           PART DETAILS — moved up before Customer / Supplier
         ══════════════════════════════════════════════════════════ */}
      <div className="parts-container" style={{ marginTop: "30px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            borderBottom: "2px solid #333",
            paddingBottom: "10px",
          }}
        >
          <h4>Part Details</h4>
          <button type="button" className="btn primary" onClick={addPart}>
            + Add Part
          </button>
        </div>

        {form.parts.map((part, index) => {
          const ac = partAC[index] || { query: "", suggestions: [], loading: false, showDropdown: false };
          const suppliers = partSuppliers[index] || [];

          return (
            <div
              key={index}
              style={{
                border: "1px solid #eee",
                padding: "20px",
                margin: "15px 0",
                borderRadius: "8px",
                position: "relative",
              }}
            >
              {form.parts.length > 1 && (
                <button
                  onClick={() => removePart(index)}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "10px",
                    color: "red",
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                  }}
                >
                  ✖ Remove
                </button>
              )}

              {/* Row 1: Part No (autocomplete), Part Desc (auto-fill), Box Size, No. of Boxes */}
              <div className="form-grid">

                {/* ── Part Number Autocomplete ── */}
                <div
                  className="field"
                  style={{ position: "relative" }}
                  ref={(el) => (dropdownRefs.current[index] = el)}
                >
                  <label>Part Number</label>
                  <input
                    className="input"
                    name="part_no"
                    value={ac.query || part.part_no}
                    onChange={(e) => handlePartNoInput(index, e)}
                    placeholder="Type to search…"
                    autoComplete="off"
                  />
                  {ac.loading && (
                    <span
                      style={{
                        position: "absolute",
                        right: "10px",
                        top: "34px",
                        fontSize: "12px",
                        color: "#888",
                      }}
                    >
                      Searching…
                    </span>
                  )}
                  {ac.showDropdown && ac.suggestions.length > 0 && (
                    <ul
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        zIndex: 100,
                        background: "#fff",
                        border: "1px solid #ccc",
                        borderRadius: "4px",
                        maxHeight: "200px",
                        overflowY: "auto",
                        margin: 0,
                        padding: 0,
                        listStyle: "none",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                      }}
                    >
                      {ac.suggestions.map((s) => (
                        <li
                          key={s.part_number}
                          onMouseDown={() => selectPartSuggestion(index, s)}
                          style={{
                            padding: "8px 12px",
                            cursor: "pointer",
                            borderBottom: "1px solid #f0f0f0",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background = "#f5f5f5")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background = "transparent")
                          }
                        >
                          <strong>{s.part_number}</strong>
                          {s.part_description && (
                            <span style={{ color: "#666", marginLeft: "8px", fontSize: "12px" }}>
                              {s.part_description}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* ── Part Description — auto-filled, still editable ── */}
                <div className="field">
                  <label>
                    Part Description
                    {part.part_desc && part.part_no && (
                      <span
                        style={{
                          fontSize: "11px",
                          color: "#4CAF50",
                          marginLeft: "6px",
                        }}
                      >
                        ✓ Auto-filled
                      </span>
                    )}
                  </label>
                  <input
                    className="input"
                    name="part_desc"
                    value={part.part_desc}
                    onChange={(e) => handlePartChange(index, e)}
                    style={
                      part.part_desc && part.part_no
                        ? { background: "#f0fff4" }
                        : {}
                    }
                  />
                </div>

                <div className="field">
                  <label>Box Size</label>
                  <input
                    className="input"
                    name="part_box_size"
                    value={part.part_box_size}
                    onChange={(e) => handlePartChange(index, e)}
                    placeholder="e.g. 10x10x12"
                  />
                </div>

                <div className="field">
                  <label>No. of Boxes</label>
                  <input
                    className="input"
                    type="number"
                    name="part_no_of_boxes"
                    value={part.part_no_of_boxes}
                    onChange={(e) => handlePartChange(index, e)}
                    placeholder="0"
                    min="0"
                  />
                </div>
              </div>

              {/* Row 2: Qty, Net Wt/Unit, Total Net Wt (auto), Gross Wt */}
              <div className="form-grid" style={{ marginTop: "10px" }}>
                <div className="field">
                  <label>Quantity</label>
                  <input
                    className="input"
                    type="number"
                    name="part_qty"
                    value={part.part_qty}
                    onChange={(e) => handlePartChange(index, e)}
                  />
                </div>
                <div className="field">
                  <label>Net Wt / Unit (Kg)</label>
                  <input
                    className="input"
                    type="number"
                    name="part_net_unit"
                    value={part.part_net_unit}
                    onChange={(e) => handlePartChange(index, e)}
                  />
                </div>
                <div className="field">
                  <label>
                    Total Net Wt (Kg)
                    <span style={{ fontSize: "11px", color: "#888", marginLeft: "6px" }}>
                      (Qty × Net Wt/Unit)
                    </span>
                  </label>
                  <input
                    className="input"
                    type="number"
                    name="part_total_net_wt"
                    value={part.part_total_net_wt}
                    onChange={(e) => handlePartChange(index, e)}
                    style={{ background: "#f0f7ff" }}
                  />
                </div>
                <div className="field">
                  <label>Gross Wt (Kg)</label>
                  <input
                    className="input"
                    type="number"
                    name="part_gross"
                    value={part.part_gross}
                    onChange={(e) => handlePartChange(index, e)}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Whole Shipment Totals ── */}
      <div
        className="totals-section"
        style={{
          background: "#f4f7f6",
          padding: "20px",
          borderRadius: "8px",
          border: "1px solid #ddd",
          marginTop: "20px",
        }}
      >
        <h4 style={{ marginBottom: "15px" }}>Whole Shipment Totals</h4>
        <div className="form-grid">
          <div className="field">
            <label>Total Net Weight (Kg)</label>
            <input
              className="input"
              value={form.total_net_wt}
              readOnly
              style={{ fontWeight: "bold" }}
            />
          </div>
          <div className="field">
            <label>Total Gross Weight (Kg)</label>
            <input
              className="input"
              value={form.total_gross_wt}
              readOnly
              style={{ fontWeight: "bold" }}
            />
          </div>
          <div className="field">
            <label>Total No. of Boxes</label>
            <input
              className="input"
              value={form.total_no_of_boxes}
              readOnly
              style={{ fontWeight: "bold" }}
            />
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
           CUSTOMER NAME — auto-filled from part master
         ══════════════════════════════════════════════════════════ */}
      <div className="form-grid" style={{ marginTop: "20px" }}>
        <div className="field">
          <label>
            Customer Name
            {form.customer && (
              <span style={{ fontSize: "11px", color: "#4CAF50", marginLeft: "6px" }}>
                ✓ Auto-filled
              </span>
            )}
          </label>
          <input
            className="input"
            name="customer"
            value={form.customer}
            onChange={change}
            style={form.customer ? { background: "#f0fff4" } : {}}
            placeholder="Auto-filled on part selection"
          />
        </div>

        {/* ── Supplier Name — single auto-fill OR searchable dropdown ── */}
        <div className="field">
          <label>Supplier Name</label>
          {allSuppliersForForm.length > 1 ? (
            /* Multiple suppliers — show searchable select */
            <select
              className="input"
              name="supplier_name"
              value={form.supplier_name}
              onChange={change}
            >
              <option value="">Select Supplier</option>
              {allSuppliersForForm.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          ) : (
            /* Single supplier or no suggestions yet — free-text (auto-filled if one supplier) */
            <input
              className="input"
              name="supplier_name"
              value={form.supplier_name}
              onChange={change}
              style={
                allSuppliersForForm.length === 1 ? { background: "#f0fff4" } : {}
              }
              placeholder="Auto-filled or type manually"
            />
          )}
          {allSuppliersForForm.length === 1 && (
            <span style={{ fontSize: "11px", color: "#4CAF50" }}>✓ Auto-filled</span>
          )}
          {allSuppliersForForm.length > 1 && (
            <span style={{ fontSize: "11px", color: "#FF9800" }}>
              Multiple suppliers — please select one
            </span>
          )}
        </div>
      </div>

      {/* ── SB Info ── */}
      <div className="form-grid" style={{ marginTop: "20px" }}>
        <div className="field">
          <label>SB No</label>
          <input className="input" name="sb_no" value={form.sb_no} onChange={change} />
        </div>
        <div className="field">
          <label>SB Date</label>
          <input
            className="input"
            type="date"
            name="sb_date"
            value={form.sb_date}
            onChange={change}
          />
        </div>
      </div>

      <div className="actions" style={{ marginTop: "30px" }}>
        <button className="btn primary" onClick={onNext}>
          Save & Next
        </button>
      </div>
    </div>
  );
}