import React, { useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";

import Step1 from "./steps/Step1";
import Step2 from "./steps/Step2";
import Step4 from "./steps/Step4";

const STEPS = [
  { id: 1, title: "Shipment Details" },
  { id: 2, title: "Tracking" },
  { id: 3, title: "Review & Save" },
];

// ✅ RECEIVE ID FROM PARENT
export default function Wizard({ id }) {
  const location = useLocation();
  const navigate = useNavigate();

  // ✅ If editing, data comes from ShipmentsList
  const editData = location.state || {};

  const [step, setStep] = useState(1);
  const [data, setData] = useState(editData);

  const update = useCallback((part) => {
    setData((prev) => ({ ...prev, ...part }));
  }, []);

  /* ==========================
     SAVE SHIPMENT (CREATE / EDIT)
     ========================== */
  async function saveFinal() {
    console.log("saveFinal called");
    console.log("Shipment ID:", id);
    console.log("Payload:", data);

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
      }

      console.log("Server response:", res.data);
    } catch (err) {
      console.error("SAVE ERROR FULL:", err);

      if (err.response) {
        alert(
          `Save failed: HTTP ${err.response.status} - ${
            err.response.data?.message || "Unknown error"
          }`,
        );
      } else if (err.request) {
        alert("Save failed: Backend not responding");
      } else {
        alert("Save failed: " + err.message);
      }
    }
  }

  return (
    <div className="wizard">
      {/* Stepper */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {STEPS.map((s) => (
          <div
            key={s.id}
            className={s.id === step ? "active" : ""}
            style={{ padding: 10, borderRadius: 8 }}
          >
            <strong>{s.id}</strong> {s.title}
          </div>
        ))}
      </div>

      {/* Steps */}
      <div className="card">
        {step === 1 && (
          <Step1 initial={data} onNext={() => setStep(2)} onUpdate={update} />
        )}

        {step === 2 && (
          <Step2
            initial={data}
            onNext={() => setStep(3)}
            onPrev={() => setStep(1)}
            onUpdate={update}
          />
        )}

        {step === 3 && (
          <Step4 data={data} onPrev={() => setStep(2)} onSave={saveFinal} />
        )}
      </div>
    </div>
  );
}
