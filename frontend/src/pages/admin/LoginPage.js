import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import axios from "axios";
import { toast } from "react-toastify";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api/v1";

export default function LoginPage() {
  const [mode, setMode] = useState("welcome"); // "welcome" | "login" | "register"
  const { login } = useAuth();
  const navigate = useNavigate();

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.brand}>
          <div style={S.brandIcon}>⚙</div>
          <div style={S.brandName}>Blue Ocean ERP</div>
        </div>

        {mode === "welcome" && <WelcomeScreen onLogin={() => setMode("login")} onRegister={() => setMode("register")} />}
        {mode === "login"   && <LoginForm onBack={() => setMode("welcome")} onSuccess={(emp, perms, token) => { login(emp, perms, token); navigate("/"); }} />}
        {mode === "register"&& <RegisterForm onBack={() => setMode("welcome")} onSuccess={() => { toast.success("Registration successful. Please login."); setMode("login"); }} />}
      </div>
    </div>
  );
}

/* ─── Welcome Screen ─── */
function WelcomeScreen({ onLogin, onRegister }) {
  return (
    <div style={S.section}>
      <h2 style={S.title}>Welcome to ERP System</h2>
      <p style={S.subtitle}>Manage your business operations in one place</p>
      <div style={S.btnGroup}>
        <button style={S.primaryBtn} onClick={onLogin}>Sign In</button>
        <div style={S.dividerRow}><span style={S.dividerLine}/><span style={S.dividerText}>New User?</span><span style={S.dividerLine}/></div>
        <button style={S.outlineBtn} onClick={onRegister}>Register / Sign Up</button>
      </div>
    </div>
  );
}

/* ─── Login Form ─── */
function LoginForm({ onBack, onSuccess }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/auth/login`, form);
      if (res.data.success) {
        onSuccess(res.data.employee, res.data.permissions, res.data.token);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Login failed");
    }
    setLoading(false);
  };

  return (
    <div style={S.section}>
      <button style={S.backBtn} onClick={onBack}>← Back</button>
      <h2 style={S.title}>Sign In</h2>
      <p style={S.subtitle}>Enter your credentials to continue</p>
      <form onSubmit={handleSubmit} style={S.form}>
        <Field label="Email Address" type="email" value={form.email} onChange={v => setForm({...form, email: v})} placeholder="you@company.com" required />
        <div style={S.fieldWrap}>
          <label style={S.label}>Password</label>
          <div style={S.passWrap}>
            <input type={showPass ? "text" : "password"} value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="••••••••" required style={{...S.input, paddingRight: 44}} />
            <button type="button" onClick={() => setShowPass(p => !p)} style={S.eyeBtn}>{showPass ? "🙈" : "👁"}</button>
          </div>
        </div>
        <button type="submit" disabled={loading} style={{...S.primaryBtn, marginTop: 8}}>
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
      <p style={S.switchText}>Don't have an account? <button style={S.linkBtn} onClick={onBack}>Register here</button></p>
    </div>
  );
}

/* ─── Register Form ─── */
function RegisterForm({ onBack, onSuccess }) {
  const [form, setForm] = useState({
    name: "", employeeId: "", email: "", phone: "",
    department: "", designation: "", password: "", confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    if (form.password !== form.confirmPassword) { toast.error("Passwords do not match"); return; }
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/auth/register`, form);
      if (res.data.success) onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || "Registration failed");
    }
    setLoading(false);
  };

  const set = (key) => (v) => setForm(f => ({...f, [key]: v}));

  return (
    <div style={S.section}>
      <button style={S.backBtn} onClick={onBack}>← Back</button>
      <h2 style={S.title}>Create Account</h2>
      <p style={S.subtitle}>Fill in your details to get started</p>
      <form onSubmit={handleSubmit} style={S.form}>
        <div style={S.grid2}>
          <Field label="Full Name"      value={form.name}        onChange={set("name")}        placeholder="Shreya Atole"    required />
          <Field label="Employee ID"    value={form.employeeId}  onChange={set("employeeId")}  placeholder="EMP001"          required />
          <Field label="Email Address"  type="email" value={form.email} onChange={set("email")} placeholder="you@company.com" required />
          <Field label="Phone Number"   type="tel"   value={form.phone} onChange={set("phone")} placeholder="+91 9876543210" />
          <Field label="Department"     value={form.department}  onChange={set("department")}  placeholder="Production"       required />
          <Field label="Designation"    value={form.designation} onChange={set("designation")} placeholder="Sr. Engineer" />
        </div>

        <div style={S.grid2}>
          <div style={S.fieldWrap}>
            <label style={S.label}>Password <span style={{color:"#ef4444"}}>*</span></label>
            <div style={S.passWrap}>
              <input type={showPass ? "text" : "password"} value={form.password} onChange={e => setForm(f=>({...f,password:e.target.value}))} placeholder="Min 8 characters" required style={{...S.input, paddingRight:44}} />
              <button type="button" onClick={() => setShowPass(p=>!p)} style={S.eyeBtn}>{showPass ? "🙈" : "👁"}</button>
            </div>
            {form.password && form.password.length < 8 && <span style={S.errTxt}>Min 8 characters</span>}
          </div>
          <div style={S.fieldWrap}>
            <label style={S.label}>Confirm Password <span style={{color:"#ef4444"}}>*</span></label>
            <input type={showPass ? "text" : "password"} value={form.confirmPassword} onChange={e => setForm(f=>({...f,confirmPassword:e.target.value}))} placeholder="Re-enter password" required style={{...S.input, ...(form.confirmPassword && form.password !== form.confirmPassword ? {borderColor:"#ef4444"} : {})}} />
            {form.confirmPassword && form.password !== form.confirmPassword && <span style={S.errTxt}>Passwords do not match</span>}
          </div>
        </div>

        <button type="submit" disabled={loading} style={{...S.primaryBtn, marginTop:4}}>
          {loading ? "Creating Account..." : "Register"}
        </button>
      </form>
      <p style={S.switchText}>Already have an account? <button style={S.linkBtn} onClick={onBack}>Sign in here</button></p>
    </div>
  );
}

/* ─── Reusable Field ─── */
function Field({ label, type="text", value, onChange, placeholder, required }) {
  return (
    <div style={S.fieldWrap}>
      <label style={S.label}>{label}{required && <span style={{color:"#ef4444"}}> *</span>}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required} style={S.input} />
    </div>
  );
}

/* ─── Styles ─── */
const S = {
  page: {
    minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
    background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)",
    padding: "24px 16px",
  },
  card: {
    background: "#fff", borderRadius: 16, width: "100%", maxWidth: 560,
    boxShadow: "0 24px 80px rgba(0,0,0,0.35)", overflow: "hidden",
  },
  brand: {
    background: "#1e3a5f", padding: "22px 32px", display: "flex", alignItems: "center", gap: 12,
  },
  brandIcon: { fontSize: 22, color: "#60a5fa" },
  brandName: { fontSize: 20, fontWeight: 700, color: "#fff", letterSpacing: "-0.3px" },
  section: { padding: "36px 40px 40px" },
  title: { margin: "0 0 6px", fontSize: 26, fontWeight: 700, color: "#0f172a" },
  subtitle: { margin: "0 0 28px", color: "#64748b", fontSize: 14 },
  form: { display: "flex", flexDirection: "column", gap: 18 },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 20px" },
  fieldWrap: { display: "flex", flexDirection: "column", gap: 5 },
  label: { fontSize: 13, fontWeight: 600, color: "#374151" },
  input: {
    padding: "11px 14px", border: "1.5px solid #e2e8f0", borderRadius: 8,
    fontSize: 14, outline: "none", color: "#0f172a", width: "100%", boxSizing: "border-box",
    transition: "border-color 0.2s",
  },
  passWrap: { position: "relative" },
  eyeBtn: {
    position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
    background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: 2,
  },
  errTxt: { fontSize: 12, color: "#ef4444", marginTop: 2 },
  btnGroup: { display: "flex", flexDirection: "column", gap: 14, marginTop: 8 },
  primaryBtn: {
    padding: "14px", background: "#1e3a5f", color: "#fff",
    border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600,
    cursor: "pointer", width: "100%", letterSpacing: "0.2px",
  },
  outlineBtn: {
    padding: "14px", background: "#fff", color: "#1e3a5f",
    border: "2px solid #1e3a5f", borderRadius: 8, fontSize: 15, fontWeight: 600,
    cursor: "pointer", width: "100%",
  },
  dividerRow: { display: "flex", alignItems: "center", gap: 10 },
  dividerLine: { flex: 1, height: 1, background: "#e2e8f0" },
  dividerText: { fontSize: 13, color: "#94a3b8", whiteSpace: "nowrap" },
  backBtn: {
    background: "none", border: "none", color: "#64748b", cursor: "pointer",
    fontSize: 13, fontWeight: 600, padding: "0 0 16px", display: "block",
  },
  switchText: { marginTop: 20, textAlign: "center", fontSize: 13, color: "#64748b" },
  linkBtn: { background: "none", border: "none", color: "#1e3a5f", fontWeight: 700, cursor: "pointer", fontSize: 13 },
};
