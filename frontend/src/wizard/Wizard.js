import React, { useState, useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";

import Step1 from "./steps/Step1";
import Step4 from "./steps/Step4";

const STEPS = [
  { id: 1, title: "Shipment & Tracking" },
  { id: 2, title: "Review & Save" },
];

const S = `
  /* All rules scoped strictly to .erp-wizard — no wildcard * leakage */
  .erp-wizard, .erp-wizard div, .erp-wizard span, .erp-wizard header,
  .erp-wizard button, .erp-wizard input, .erp-wizard label {
    box-sizing: border-box;
  }
  .erp-wizard {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    background: #F1F5F9;
    /* Do NOT use min-height:100vh — it blocks the rest of the app layout */
    display: flex;
    flex-direction: column;
  }

  /* ══════════════════════════════════════════════════════════════════
     COMPACT HEADER — brand + stepper merged into a single bar instead
     of two stacked rows (dark header row + separate white stepper row).
     Only visual: same elements, same click handlers, same conditional
     classes (active/done) — just laid out side-by-side in one line.
     ══════════════════════════════════════════════════════════════════ */
  .erp-wizard .hdr {
    background: #0F172A; color: white;
    padding: 0 16px; height: 38px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px;
    /* NOT sticky/fixed — would overlay sidebar and other modules */
    box-shadow: 0 1px 4px rgba(0,0,0,0.4);
  }
  .erp-wizard .hdr-brand { display: flex; align-items: center; gap: 7px; flex-shrink: 0; }
  .erp-wizard .hdr-logo {
    width: 20px; height: 20px; background: #2563EB; border-radius: 5px;
    display: flex; align-items: center; justify-content: center;
    font-size: 9px; font-weight: 800; color: white;
  }
  .erp-wizard .hdr-title { font-size: 12px; font-weight: 700; line-height: 1.2; }
  .erp-wizard .hdr-sub { font-size: 9.5px; color: #94A3B8; line-height: 1.2; }

  /* Stepper now lives inline inside the dark header bar, so it uses
     dark-background-friendly colors instead of the previous white
     card + slate-text treatment. */
  .erp-wizard .stepper {
    display: flex; align-items: center;
    flex-shrink: 0;
  }
  .erp-wizard .stp {
    display: flex; align-items: center; gap: 4px;
    padding: 0 12px 0 0;
    cursor: pointer; position: relative;
  }
  .erp-wizard .stp:not(:last-child)::after {
    content: '›'; position: absolute; right: 3px;
    color: #475569; font-size: 12px;
  }
  .erp-wizard .stp-num {
    width: 16px; height: 16px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 8.5px; font-weight: 800;
    background: #1E293B; color: #94A3B8;
  }
  .erp-wizard .stp.active .stp-num { background: #2563EB; color: white; }
  .erp-wizard .stp.done .stp-num { background: #10B981; color: white; }
  .erp-wizard .stp-lbl { font-size: 10.5px; color: #94A3B8; font-weight: 500; white-space: nowrap; }
  .erp-wizard .stp.active .stp-lbl { color: #93C5FD; font-weight: 700; }
  .erp-wizard .stp.done .stp-lbl { color: #6EE7B7; }

  .erp-wizard .content { flex: 1; padding: 12px 16px 24px; max-width: 960px; width: 100%; margin: 0 auto; }
  @media (max-width: 700px) {
    .erp-wizard .content { padding: 8px 10px 20px; }
    .erp-wizard .hdr { flex-wrap: wrap; height: auto; padding: 6px 12px; row-gap: 4px; }
    .erp-wizard .stp-lbl { display: none; }
  }
`;

// ✅ RECEIVE ID FROM PARENT
export default function Wizard({ id }) {
  const location = useLocation();
  const navigate = useNavigate();

  // location.state is populated when navigating from ShipmentsList with { state: shipment }
  const editData = location.state || {};

  const [step, setStep]       = useState(1);
  const [data, setData]       = useState(editData);
  const [loading, setLoading] = useState(false);
  const [fetchErr, setFetchErr] = useState("");

  // ── PREFILL FIX: if id exists but state is empty, fetch from backend ─────
  // This covers the case where the user lands directly on /shipment/edit/:id
  // without location.state (e.g. page refresh or direct link).
   const [saving, setSaving]     = useState(false);
  const [justSaved, setJustSaved] = useState(false);
   const [formKey, setFormKey]   = useState(0);
  useEffect(() => {
    if (!id) return;                                      // create mode — nothing to fetch
    if (Object.keys(editData).length > 0) {
      // state was passed from ShipmentsList — use it directly, no need to fetch
      setData(editData);
      return;
    }
    // No state passed — fetch from API
    setLoading(true);
    axios
      .get(`${process.env.REACT_APP_API_URL}/shipment/${id}`)
      .then((res) => {
        setData(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch shipment for edit:", err);
        setFetchErr("Could not load shipment data. Please go back and try again.");
        setLoading(false);
      });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = useCallback((part) => {
    setData((prev) => ({ ...prev, ...part }));
  }, []);

  /* ==========================
     SAVE SHIPMENT (CREATE / EDIT)
     ========================== */
  async function saveFinal() {
     if (saving || justSaved) return;
    console.log("saveFinal called");
    console.log("Shipment ID:", id);
    console.log("Payload:", data);
 setSaving(true);
    try {
      let res;

      // ✅ EDIT MODE
      if (id) {
        res = await axios.patch(
          `${process.env.REACT_APP_API_URL}/shipment/${id}`,
          data,
          { headers: { "Content-Type": "application/json" } },
        );
        alert("Shipment updated successfully ✔️");
        navigate("/shipments");
      }

      // ✅ CREATE MODE
      else {
        res = await axios.post(
          `${process.env.REACT_APP_API_URL}/shipment/`,
          data,
          { headers: { "Content-Type": "application/json" } },
        );
        alert("Shipment created successfully ✔️");
        setData({});
        setStep(1);
        setJustSaved(false);
        setFormKey((k) => k + 1);
      }

      console.log("Server response:", res.data);
    } catch (err) {
      console.error("SAVE ERROR FULL:", err);
      if (err.response) {
        alert(`Save failed: HTTP ${err.response.status} - ${err.response.data?.message || "Unknown error"}`);
      } else if (err.request) {
        alert("Save failed: Backend not responding");
      } else {
        alert("Save failed: " + err.message);
      }
     } finally {
      setSaving(false);
  }
  }
  return (
    <>
      <style>{S}</style>
      <div className="erp-wizard">

        {/* ── HEADER + STEPPER (merged into a single compact bar) ── */}
        <header className="hdr">
          <div className="hdr-brand">
            <div className="hdr-logo">ERP</div>
            <div>
              <div className="hdr-title">Centralized ERP</div>
              <div className="hdr-sub">
                Shipment Management — {id ? `Editing #${data.enquiry_no || id}` : "New Shipment"}
              </div>
            </div>
          </div>

          <div className="stepper">
            {STEPS.map((s) => (
              <div
                key={s.id}
                className={`stp ${step === s.id ? "active" : step > s.id ? "done" : ""}`}
                onClick={() => { if (s.id < step) setStep(s.id); }}
              >
                <div className="stp-num">{step > s.id ? "✓" : s.id}</div>
                <span className="stp-lbl">{s.title}</span>
              </div>
            ))}
          </div>
        </header>

        {/* ── CONTENT ── */}
        <div className="content">
          {/* Loading state while fetching shipment by ID */}
          {loading && (
            <div style={{ padding: 40, textAlign: "center", color: "#64748B", fontSize: 13 }}>
              Loading shipment data…
            </div>
          )}

          {/* Fetch error */}
          {!loading && fetchErr && (
            <div style={{ padding: 20, background: "#FEE2E2", color: "#991B1B", borderRadius: 8, fontSize: 13 }}>
              {fetchErr}
            </div>
          )}

          {/* Step content — only render when data is ready */}
          {!loading && !fetchErr && (
            <>
              {/* Step1 contains shipment details + tracking + email  (merged Step2) */}
              {step === 1 && (
                <Step1 key={formKey} initial={data} onNext={() => setStep(2)} onUpdate={update} />
              )}

              {/* Step4 is step 2 in the wizard (Review & Save) */}
              {step === 2 && (
                <Step4 data={data} onPrev={() => setStep(1)} onSave={saveFinal} />
              )}
            </>
          )}
        </div>

      </div>
    </>
  );
}
