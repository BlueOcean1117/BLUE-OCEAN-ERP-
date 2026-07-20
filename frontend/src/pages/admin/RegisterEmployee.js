import React, { useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api/v1";

export default function RegisterEmployee() {
  const { getToken } = useAuth();
  const [form, setForm] = useState({ name: "", employeeId: "", department: "", role: "employee", email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/auth/register`, form, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.data.success) {
        toast.success("Employee registered successfully!");
        setForm({ name: "", employeeId: "", department: "", role: "employee", email: "", password: "" });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Registration failed");
    }
    setLoading(false);
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <h2 style={styles.title}>Register Employee</h2>
        <p style={styles.subtitle}>Add a new employee to the ERP system</p>
      </div>
      <div style={styles.card}>
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.grid}>
            <Field label="Full Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Shreya Atole" required />
            <Field label="Employee ID" value={form.employeeId} onChange={(v) => setForm({ ...form, employeeId: v })} placeholder="EMP001" required />
            <Field label="Department" value={form.department} onChange={(v) => setForm({ ...form, department: v })} placeholder="Production" required />
            <div style={styles.field}>
              <label style={styles.label}>Role</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} style={styles.input}>
                <option value="employee">Employee</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <Field label="Email Address" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} placeholder="emp@company.com" required />
            <Field label="Password" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} placeholder="Min 6 characters" required />
          </div>
          <button type="submit" disabled={loading} style={styles.btn}>
            {loading ? "Registering..." : "Register Employee"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, type = "text", value, onChange, placeholder, required }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>{label}</label>
      <input
        type={type} value={value} placeholder={placeholder} required={required}
        onChange={(e) => onChange(e.target.value)}
        style={{ padding: "11px 14px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 14, outline: "none", color: "#0f172a" }}
      />
    </div>
  );
}

const styles = {
  wrapper: { padding: "28px 32px", maxWidth: 800, margin: "0 auto" },
  header: { marginBottom: 24 },
  title: { margin: "0 0 6px", fontSize: 26, fontWeight: 700, color: "#0f172a" },
  subtitle: { margin: 0, color: "#64748b", fontSize: 14 },
  card: { background: "#fff", borderRadius: 12, padding: 32, border: "1px solid #e2e8f0" },
  form: { display: "flex", flexDirection: "column", gap: 24 },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px 24px" },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 14, fontWeight: 600, color: "#374151" },
  input: { padding: "11px 14px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 14, outline: "none", color: "#0f172a" },
  btn: {
    alignSelf: "flex-start", padding: "13px 32px",
    background: "#1e3a5f", color: "#fff",
    border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: "pointer",
  },
};
