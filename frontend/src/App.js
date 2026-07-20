// src/App.js
import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  NavLink,
  useLocation,
  useNavigate,
  Navigate,
} from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Logistics from "./pages/Logistics";
import Reports from "./pages/Reports";
import ShipmentsList from "./pages/ShipmentsList";
import EnquiryDashboard from "./pages/enquiry/EnquiryDashboard";
import InvoicePage from "./pages/invoice/InvoicePage";
import LoginPage from "./pages/admin/LoginPage";
import EmployeeAccessControl from "./pages/admin/EmployeeAccessControl";
import RegisterEmployee from "./pages/admin/RegisterEmployee";
import { ModuleProtectedRoute, AdminRoute, AuthRoute, UnauthorizedPage } from "./components/ProtectedRoute";
import { AuthProvider, useAuth } from "./context/AuthContext";
import "./index.css";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const LOGISTICS_PATHS = ["/", "/logistics", "/shipments", "/reports"];

/* ─── Loading Spinner ─── */
function FullPageSpinner() {
  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:"#0f172a" }}>
      <div style={{ fontSize:22, color:"#60a5fa", fontWeight:700, marginBottom:16 }}>Blue Ocean ERP</div>
      <div style={{ width:36, height:36, border:"3px solid rgba(255,255,255,0.15)", borderTop:"3px solid #60a5fa", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function AppLayout() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { user, loading, isAdmin, canAccess, logout } = useAuth();

  const isEnquiry      = location.pathname === "/enquiry";
  const isInvoice      = location.pathname.startsWith("/admin/invoice");
  const isLogisticsRoute = LOGISTICS_PATHS.some((p) =>
    p === "/" ? location.pathname === "/" : location.pathname.startsWith(p)
  );

  const [sidebarOpen,   setSidebarOpen]   = useState(true);
  const [logisticsOpen, setLogisticsOpen] = useState(isLogisticsRoute);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);

  useEffect(() => { setSidebarOpen(!isEnquiry); }, [isEnquiry]);
  useEffect(() => { if (isLogisticsRoute) setLogisticsOpen(true); }, [isLogisticsRoute]);

  const toggleSidebar = () => setSidebarOpen((p) => !p);

  const handleLogisticsClick = () => {
    if (!sidebarOpen) { setSidebarOpen(true); setLogisticsOpen(true); }
    else setLogisticsOpen((p) => !p);
  };

  const handleLogout = () => {
    logout();
    toast.info("Logged out successfully");
    navigate("/login");
  };

  // Show spinner while checking token
  if (loading) return <FullPageSpinner />;

  // Not logged in → only auth routes
  if (!user) {
    return (
      <>
        <Routes>
          <Route path="*" element={<LoginPage />} />
        </Routes>
        <ToastContainer position="top-right" autoClose={3000} />
      </>
    );
  }

  return (
    <div className="app-root">
      {/* ─── Sidebar ─── */}
      <aside className={`sidebar${sidebarOpen ? "" : " closed"}`}>
        <div className="sidebar-header">
          {sidebarOpen && <div className="brand">Blue Ocean ERP</div>}
          <button className="sidebar-toggle" onClick={toggleSidebar} title="Toggle sidebar">
            <span style={{ display:"flex", flexDirection:"column", gap:"4px" }}>
              {[0,1,2].map(i => <span key={i} style={{ display:"block", width:"18px", height:"2px", background:"#fff", borderRadius:"2px" }} />)}
            </span>
          </button>
        </div>

        <nav className="nav">
          {/* Enquiry */}
          {(isAdmin() || canAccess("enquiry")) && (
            <NavLink to="/enquiry" className="nav-item" title="Enquiry">
              <span className="nav-icon">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              </span>
              {sidebarOpen && <span className="nav-label">Enquiry</span>}
            </NavLink>
          )}

          {/* Invoice */}
          {(isAdmin() || canAccess("invoice")) && (
            <NavLink to="/admin/invoice" className="nav-item" title="Invoice">
              <span className="nav-icon">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2V8z"/>
                  <path d="M14 2v6h6"/><path d="M8 12h8"/><path d="M8 16h6"/>
                </svg>
              </span>
              {sidebarOpen && <span className="nav-label">Invoice</span>}
            </NavLink>
          )}

          {/* Logistics */}
          {(isAdmin() || canAccess("logistics")) && (
            <div className="nav-group">
              <div className={`nav-group-header${isLogisticsRoute ? " active" : ""}`} onClick={handleLogisticsClick} title="Logistics">
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
              {sidebarOpen && (
                <div className={`nav-submenu${logisticsOpen ? " open" : ""}`}>
                  <NavLink to="/" end className="nav-sub-item"><span className="nav-sub-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg></span><span>Dashboard</span></NavLink>
                  <NavLink to="/logistics" className="nav-sub-item"><span className="nav-sub-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg></span><span>New Shipment</span></NavLink>
                  <NavLink to="/shipments" className="nav-sub-item"><span className="nav-sub-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg></span><span>Shipments List</span></NavLink>
                  <NavLink to="/reports" className="nav-sub-item"><span className="nav-sub-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg></span><span>Reports</span></NavLink>
                </div>
              )}
            </div>
          )}

          {/* Admin section */}
          {isAdmin() && (
            <div className="nav-group">
              <div className="nav-group-header" onClick={() => { if(!sidebarOpen){setSidebarOpen(true);setAdminMenuOpen(true);}else setAdminMenuOpen(p=>!p); }} title="Admin">
                <span className="nav-icon">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                </span>
                {sidebarOpen && (
                  <>
                    <span className="nav-label">Admin</span>
                    <span className={`nav-chevron${adminMenuOpen ? " open" : ""}`}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </span>
                  </>
                )}
              </div>
              {sidebarOpen && (
                <div className={`nav-submenu${adminMenuOpen ? " open" : ""}`}>
                  <NavLink to="/admin/access-control" className="nav-sub-item">
                    <span className="nav-sub-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg></span>
                    <span>Access Control</span>
                  </NavLink>
                  <NavLink to="/admin/register" className="nav-sub-item">
                    <span className="nav-sub-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg></span>
                    <span>Register Employee</span>
                  </NavLink>
                </div>
              )}
            </div>
          )}
        </nav>

       

        {/* User info at bottom of sidebar */}
        {sidebarOpen && (
          <div style={{ padding:"16px 18px", borderTop:"1px solid rgba(255,255,255,0.1)", marginTop:"auto" }}>
            <div style={{ fontSize:13, color:"rgba(255,255,255,0.5)", marginBottom:4 }}>Logged in as</div>
            <div style={{ fontSize:14, fontWeight:600, color:"#fff", marginBottom:2 }}>{user?.name}</div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", textTransform:"capitalize", marginBottom:10 }}>{user?.role} · {user?.department}</div>
            <button onClick={handleLogout} style={{ width:"100%", padding:"8px", background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:6, color:"#fff", fontSize:13, cursor:"pointer", fontWeight:500 }}>
              Sign Out
            </button>
          </div>
        )}
      </aside>

      {/* ─── Main ─── */}
      <main className={`main${sidebarOpen ? "" : " sidebar-closed"}`}>
        <header className="topbar">
          <h1>Centralized ERP</h1>
          <div className="actions">
            <button className="btn primary">Export</button>
            <span style={{ fontSize:13, color:"#64748b", fontWeight:600, background:"#f1f5f9", padding:"6px 12px", borderRadius:6 }}>
              {user?.role === "admin" ? "👑" : "👤"} {user?.name}
            </span>
          </div>
        </header>

        <div className={`content${isEnquiry ? " content-enquiry" : ""}${isInvoice ? " content-invoice" : ""}`}>
          <Routes>
            <Route path="/login"        element={<Navigate to="/" replace />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />

            <Route path="/"             element={<AuthRoute><ModuleProtectedRoute module="logistics"><Dashboard /></ModuleProtectedRoute></AuthRoute>} />
            <Route path="/logistics"    element={<AuthRoute><ModuleProtectedRoute module="logistics"><Logistics /></ModuleProtectedRoute></AuthRoute>} />
            <Route path="/logistics/:id" element={<AuthRoute><ModuleProtectedRoute module="logistics"><Logistics /></ModuleProtectedRoute></AuthRoute>} />
            <Route path="/shipments"    element={<AuthRoute><ModuleProtectedRoute module="logistics"><ShipmentsList /></ModuleProtectedRoute></AuthRoute>} />
            <Route path="/reports"      element={<AuthRoute><ModuleProtectedRoute module="logistics"><Reports /></ModuleProtectedRoute></AuthRoute>} />
            <Route path="/enquiry"      element={<AuthRoute><ModuleProtectedRoute module="enquiry"><EnquiryDashboard /></ModuleProtectedRoute></AuthRoute>} />
            <Route path="/admin/invoice" element={<AuthRoute><ModuleProtectedRoute module="invoice"><InvoicePage /></ModuleProtectedRoute></AuthRoute>} />
            

            <Route path="/admin/access-control" element={<AdminRoute><EmployeeAccessControl /></AdminRoute>} />
            <Route path="/admin/register"       element={<AdminRoute><RegisterEmployee /></AdminRoute>} />
          </Routes>
        </div>
      </main>

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppLayout />
      </Router>
    </AuthProvider>
  );
}
