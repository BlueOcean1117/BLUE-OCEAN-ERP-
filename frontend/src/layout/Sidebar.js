import React from "react";
import { Link } from "react-router-dom";

export default function Sidebar() {
  return (
    <div style={{ width: 220, background: "#0f172a", color: "#fff", padding: 20 }}>
      <h3>ERP</h3>

      <nav style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Link to="/dashboard" style={{ color: "#fff", textDecoration: "none" }}>
          Dashboard
        </Link>

        <Link to="/shipments" style={{ color: "#fff", textDecoration: "none" }}>
          Shipment List
        </Link>

        <Link to="/shipments/new" style={{ color: "#fff", textDecoration: "none" }}>
          New Shipment
        </Link>
      </nav>
    </div>
  );
}
