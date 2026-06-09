// frontend/src/layout/Layout.js
import React from "react";
import { Outlet } from "react-router-dom";


export default function Layout() {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside style={{ width: 220, background: "#0f172a", color: "#fff", padding: 20 }}>
        <h3>ERP</h3>
        <p>Dashboard</p>
        <p>New Shipments</p>
         <p>ShipmentsList</p>
      </aside>

      <main style={{ flex: 1, padding: 20 }}>
        <Outlet />
      </main>
    </div>
  );
}
