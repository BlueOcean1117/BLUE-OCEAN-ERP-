import React, { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { toast } from "react-toastify";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api/v1";

const MODULES = [
  { key: "enquiry", label: "Enquiry" },
  { key: "invoice", label: "Invoice" },
  { key: "logistics", label: "Logistics" },
];

const defaultModule = () => ({
  visible: false,
  actions: { view: false, create: false, edit: false, delete: false },
});

export default function EmployeeAccessControl() {
  const { getToken } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [empDetail, setEmpDetail] = useState(null);
  const [modules, setModules] = useState({});
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  const authHeader = { headers: { Authorization: `Bearer ${getToken()}` } };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const res = await axios.get(`${API_URL}/admin/employees`, authHeader);
      if (res.data.success) setEmployees(res.data.employees);
    } catch (err) {
      toast.error("Failed to load employees");
    }
  };

  const handleSelectEmployee = async (empId) => {
    if (!empId) { setSelectedEmployee(null); setEmpDetail(null); setModules({}); return; }
    setSelectedEmployee(empId);
    try {
      const res = await axios.get(`${API_URL}/admin/permissions/${empId}`, authHeader);
      if (res.data.success) {
        setEmpDetail(res.data.employee);
        // Ensure all modules present
        const mods = {};
        MODULES.forEach(({ key }) => {
          mods[key] = res.data.modules[key] || defaultModule();
        });
        setModules(mods);
      }
    } catch (err) {
      toast.error("Failed to load permissions");
    }
  };

  const toggleVisible = (mod) => {
    setModules((prev) => {
      const updated = { ...prev, [mod]: { ...prev[mod], visible: !prev[mod].visible } };
      if (!updated[mod].visible) {
        // hide module → disable all actions
        updated[mod].actions = { view: false, create: false, edit: false, delete: false };
      } else {
        // show module → at least enable view
        updated[mod].actions = { ...updated[mod].actions, view: true };
      }
      return updated;
    });
  };

  const toggleAction = (mod, action) => {
    setModules((prev) => ({
      ...prev,
      [mod]: { ...prev[mod], actions: { ...prev[mod].actions, [action]: !prev[mod].actions[action] } },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await axios.patch(`${API_URL}/admin/permissions/${selectedEmployee}`, { modules }, authHeader);
      if (res.data.success) {
        toast.success("Permissions saved successfully!");
        fetchEmployees();
        setShowConfirm(false);
      }
    } catch (err) {
      toast.error("Failed to save permissions");
    }
    setSaving(false);
  };

  const filtered = employees.filter(
    (e) =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.department.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <h2 style={styles.title}>Employee Access Control</h2>
        <p style={styles.subtitle}>Manage module permissions for each employee</p>
      </div>

      <div style={styles.layout}>
        {/* Left Panel: Employee List */}
        <div style={styles.leftPanel}>
          <input
            placeholder="Search by name or department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.searchInput}
          />
          <div style={styles.empList}>
            {filtered.map((emp) => (
              <div
                key={emp.id}
                onClick={() => handleSelectEmployee(emp.id)}
                style={{
                  ...styles.empCard,
                  background: selectedEmployee === emp.id ? "#1e3a5f" : "#f8fafc",
                  color: selectedEmployee === emp.id ? "#fff" : "#0f172a",
                  border: selectedEmployee === emp.id ? "2px solid #1e3a5f" : "2px solid #e2e8f0",
                }}
              >
                <div style={styles.empAvatar}>{emp.name.charAt(0).toUpperCase()}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{emp.name}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>{emp.department} · {emp.role}</div>
                  <div style={{ fontSize: 11, marginTop: 2, opacity: 0.6 }}>{emp.enabledModules || "No modules"}</div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: 20, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>No employees found</div>
            )}
          </div>
        </div>

        {/* Right Panel: Permissions */}
        <div style={styles.rightPanel}>
          {!selectedEmployee ? (
            <div style={styles.emptyState}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
              </svg>
              <p style={{ color: "#94a3b8", marginTop: 12 }}>Select an employee to manage permissions</p>
            </div>
          ) : (
            <>
              {empDetail && (
                <div style={styles.empInfo}>
                  <div style={styles.empInfoItem}><span style={styles.infoLabel}>Name</span><span style={styles.infoVal}>{empDetail.name}</span></div>
                  <div style={styles.empInfoItem}><span style={styles.infoLabel}>Employee ID</span><span style={styles.infoVal}>{empDetail.employeeId}</span></div>
                  <div style={styles.empInfoItem}><span style={styles.infoLabel}>Department</span><span style={styles.infoVal}>{empDetail.department}</span></div>
                  <div style={styles.empInfoItem}><span style={styles.infoLabel}>Role</span><span style={styles.infoVal}>{empDetail.role}</span></div>
                </div>
              )}

              <div style={styles.sectionTitle}>Module Permissions</div>

              {MODULES.map(({ key, label }) => (
                <div key={key} style={styles.moduleCard}>
                  <div style={styles.moduleHeader}>
                    <span style={styles.moduleName}>{label}</span>
                    <label style={styles.toggleWrap}>
                      <input
                        type="checkbox"
                        checked={modules[key]?.visible || false}
                        onChange={() => toggleVisible(key)}
                        style={{ display: "none" }}
                      />
                      <div style={{
                        ...styles.toggle,
                        background: modules[key]?.visible ? "#22c55e" : "#e2e8f0",
                      }}>
                        <div style={{ ...styles.toggleKnob, left: modules[key]?.visible ? 22 : 2 }} />
                      </div>
                    </label>
                  </div>

                  {modules[key]?.visible && (
                    <div style={styles.actionsRow}>
                      {["view", "create", "edit", "delete"].map((action) => (
                        <label key={action} style={styles.actionCheck}>
                          <input
                            type="checkbox"
                            checked={modules[key]?.actions?.[action] || false}
                            onChange={() => toggleAction(key, action)}
                            style={{ marginRight: 6 }}
                          />
                          {action.charAt(0).toUpperCase() + action.slice(1)}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              <button
                onClick={() => setShowConfirm(true)}
                style={styles.saveBtn}
              >
                Save Permissions
              </button>
            </>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3 style={{ margin: "0 0 12px" }}>Confirm Changes</h3>
            <p style={{ color: "#64748b", margin: "0 0 24px", fontSize: 14 }}>
              Save permission changes for <strong>{empDetail?.name}</strong>?
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button onClick={() => setShowConfirm(false)} style={styles.cancelBtn}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={styles.confirmBtn}>
                {saving ? "Saving..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrapper: { padding: "28px 32px", maxWidth: 1200, margin: "0 auto" },
  header: { marginBottom: 28 },
  title: { margin: "0 0 6px", fontSize: 26, fontWeight: 700, color: "#0f172a" },
  subtitle: { margin: 0, color: "#64748b", fontSize: 14 },
  layout: { display: "flex", gap: 24 },
  leftPanel: { width: 300, flexShrink: 0 },
  rightPanel: { flex: 1, background: "#fff", borderRadius: 12, padding: 24, border: "1px solid #e2e8f0", minHeight: 400 },
  searchInput: {
    width: "100%", padding: "10px 14px", border: "1.5px solid #e2e8f0",
    borderRadius: 8, fontSize: 14, marginBottom: 12, boxSizing: "border-box", outline: "none",
  },
  empList: { display: "flex", flexDirection: "column", gap: 8 },
  empCard: {
    display: "flex", alignItems: "center", gap: 12,
    padding: "12px 14px", borderRadius: 10, cursor: "pointer",
    transition: "all 0.15s", userSelect: "none",
  },
  empAvatar: {
    width: 36, height: 36, borderRadius: "50%",
    background: "#1e3a5f", color: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontWeight: 700, fontSize: 16, flexShrink: 0,
  },
  emptyState: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 300 },
  empInfo: {
    display: "grid", gridTemplateColumns: "1fr 1fr",
    gap: "12px 24px", background: "#f8fafc",
    borderRadius: 10, padding: 18, marginBottom: 24,
  },
  empInfoItem: { display: "flex", flexDirection: "column", gap: 2 },
  infoLabel: { fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" },
  infoVal: { fontSize: 14, fontWeight: 600, color: "#0f172a" },
  sectionTitle: { fontWeight: 700, fontSize: 15, color: "#0f172a", marginBottom: 14 },
  moduleCard: { border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "16px 18px", marginBottom: 12 },
  moduleHeader: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  moduleName: { fontWeight: 600, fontSize: 15, color: "#1e293b" },
  toggleWrap: { cursor: "pointer" },
  toggle: {
    width: 44, height: 24, borderRadius: 12,
    position: "relative", transition: "background 0.2s",
  },
  toggleKnob: {
    position: "absolute", top: 2, width: 20, height: 20,
    borderRadius: "50%", background: "#fff",
    boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
    transition: "left 0.2s",
  },
  actionsRow: { display: "flex", gap: 20, marginTop: 14, flexWrap: "wrap" },
  actionCheck: { display: "flex", alignItems: "center", fontSize: 14, color: "#374151", cursor: "pointer", fontWeight: 500 },
  saveBtn: {
    marginTop: 20, padding: "13px 32px",
    background: "#1e3a5f", color: "#fff",
    border: "none", borderRadius: 8, fontSize: 15,
    fontWeight: 600, cursor: "pointer",
  },
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999,
  },
  modal: { background: "#fff", borderRadius: 12, padding: "32px 36px", width: 380, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" },
  cancelBtn: {
    padding: "10px 22px", border: "1.5px solid #e2e8f0",
    borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600,
  },
  confirmBtn: {
    padding: "10px 22px", border: "none",
    borderRadius: 8, background: "#1e3a5f", color: "#fff",
    cursor: "pointer", fontSize: 14, fontWeight: 600,
  },
};
