// frontend/src/pages/Logistics.js
import React from "react";
import { useParams } from "react-router-dom";
import Wizard from "../wizard/Wizard";

export default function Logistics() {
  const { id } = useParams(); // ✅ REQUIRED

  return (
    <div>
      <div className="card">
        <h2>Logistics — New / Edit Shipment</h2>
        <p className="muted">
          Add new shipments or edit existing shipments using the wizard.
        </p>
      </div>

      <div style={{ height: 12 }} />

      {/* ✅ PASS ID WITHOUT CHANGING BEHAVIOR */}
      <Wizard id={id} />
    </div>
  );
}
