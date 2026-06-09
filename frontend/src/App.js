// src/App.js
import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  NavLink,
  useLocation,
} from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Logistics from "./pages/Logistics";
import Reports from "./pages/Reports";
import ShipmentsList from "./pages/ShipmentsList";
import EnquiryDashboard from "./pages/enquiry/EnquiryDashboard";
import InvoicePage from "./pages/invoice/InvoicePage";
import "./index.css";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const LOGISTICS_PATHS = ["/", "/logistics", "/shipments", "/reports"];

function AppLayout() {
  const location = useLocation();
  const isEnquiry = location.pathname === "/enquiry";
  const isInvoice = location.pathname.startsWith("/admin/invoice");
  const isLogisticsRoute = LOGISTICS_PATHS.some((p) =>
    p === "/" ? location.pathname === "/" : location.pathname.startsWith(p)
  );

  const [sidebarOpen, setSidebarOpen] = useState(!isEnquiry);
  const [logisticsOpen, setLogisticsOpen] = useState(isLogisticsRoute);

  // Auto-collapse sidebar on enquiry page
  useEffect(() => {
    setSidebarOpen(!isEnquiry);
  }, [isEnquiry]);

  // Auto-expand logistics submenu when on a logistics route
  useEffect(() => {
    if (isLogisticsRoute) setLogisticsOpen(true);
  }, [isLogisticsRoute]);

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);

  const handleLogisticsClick = () => {
    if (!sidebarOpen) {
      // If sidebar is collapsed, open it and expand submenu
      setSidebarOpen(true);
      setLogisticsOpen(true);
    } else {
      setLogisticsOpen((prev) => !prev);
    }
  };

  return (
    <div className="app-root">
      {/* Sidebar */}
      <aside className={`sidebar${sidebarOpen ? "" : " closed"}`}>
        <div className="sidebar-header">
          {sidebarOpen && <div className="brand">Blue Ocean ERP</div>}
          <button className="sidebar-toggle" onClick={toggleSidebar} title="Toggle sidebar">
            <span style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ display: "block", width: "18px", height: "2px", background: "#fff", borderRadius: "2px" }} />
              <span style={{ display: "block", width: "18px", height: "2px", background: "#fff", borderRadius: "2px" }} />
              <span style={{ display: "block", width: "18px", height: "2px", background: "#fff", borderRadius: "2px" }} />
            </span>
          </button>
        </div>

        <nav className="nav">
          {/* ── Enquiry (standalone) ── */}
          <NavLink to="/enquiry" className="nav-item" title="Enquiry">
            <span className="nav-icon">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </span>
            {sidebarOpen && <span className="nav-label">Enquiry</span>}
          </NavLink>

          {/* ── Invoice (standalone) ── */}
          <NavLink to="/admin/invoice" className="nav-item" title="Invoice">
            <span className="nav-icon">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2V8z" />
                <path d="M14 2v6h6" />
                <path d="M8 12h8" />
                <path d="M8 16h6" />
              </svg>
            </span>
            {sidebarOpen && <span className="nav-label">Invoice</span>}
          </NavLink>

          {/* ── Logistics (parent) ── */}
          <div className="nav-group">
            <div
              className={`nav-group-header${isLogisticsRoute ? " active" : ""}`}
              onClick={handleLogisticsClick}
              title="Logistics"
            >
              <span className="nav-icon">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="3" width="15" height="13"/>
                  <path d="M16 8h4l3 3v5h-7V8z"/>
                  <circle cx="5.5" cy="18.5" r="2.5"/>
                  <circle cx="18.5" cy="18.5" r="2.5"/>
                </svg>
              </span>
              {sidebarOpen && (
                <>
                  <span className="nav-label">Logistics</span>
                  <span className={`nav-chevron${logisticsOpen ? " open" : ""}`}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                </>
              )}
            </div>

            {/* Submenu — only when sidebar is open */}
            {sidebarOpen && (
              <div className={`nav-submenu${logisticsOpen ? " open" : ""}`}>
                <NavLink to="/" end className="nav-sub-item" title="Dashboard">
                  <span className="nav-sub-icon">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                      <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
                    </svg>
                  </span>
                  <span>Dashboard</span>
                </NavLink>
                <NavLink to="/logistics" className="nav-sub-item" title="New Shipment">
                  <span className="nav-sub-icon">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
                    </svg>
                  </span>
                  <span>New Shipment</span>
                </NavLink>
                <NavLink to="/shipments" className="nav-sub-item" title="Shipments List">
                  <span className="nav-sub-icon">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
                    </svg>
                  </span>
                  <span>Shipments List</span>
                </NavLink>
                <NavLink to="/reports" className="nav-sub-item" title="Reports">
                  <span className="nav-sub-icon">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 20V10M12 20V4M6 20v-6"/>
                    </svg>
                  </span>
                  <span>Reports</span>
                </NavLink>
              </div>
            )}
          </div>
        </nav>
      </aside>

      {/* Main */}
      <main className={`main${sidebarOpen ? "" : " sidebar-closed"}`}>
        {/* Topbar */}
        <header className="topbar">
          <h1>Centralized ERP</h1>
          <div className="actions">
            <button className="btn primary">Export</button>
            <button className="btn">User</button>
          </div>
        </header>

        {/* Page content */}
        <div className={`content${isEnquiry ? " content-enquiry" : ""}${isInvoice ? " content-invoice" : ""}`}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/logistics" element={<Logistics />} />
            <Route path="/logistics/:id" element={<Logistics />} />
            <Route path="/shipments" element={<ShipmentsList />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/enquiry" element={<EnquiryDashboard />} />
            <Route path="/admin/invoice" element={<InvoicePage />} />
          </Routes>
        </div>
      </main>

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppLayout />
    </Router>
  );
}

