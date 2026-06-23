// frontend/src/wizard/steps/Step2.js
import React, { useState, useEffect } from "react";
import API from "../../services/api";

const S = `
  .erp-step2 * { box-sizing: border-box; }
  .erp-step2 .card { background: white; border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px 14px; margin-bottom: 8px; }
  .erp-step2 .card-hdr { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid #F1F5F9; }
  .erp-step2 .card-title { font-size: 11px; font-weight: 700; color: #1E293B; text-transform: uppercase; letter-spacing: 0.4px; display: flex; align-items: center; gap: 6px; }
  .erp-step2 .badge { background: #EFF6FF; color: #2563EB; font-size: 9px; font-weight: 700; padding: 1px 6px; border-radius: 8px; }
  .erp-step2 .g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; }
  .erp-step2 .g-email { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: end; margin-bottom: 8px; }
  .erp-step2 .g-full { margin-bottom: 8px; }
  .erp-step2 .f { display: flex; flex-direction: column; gap: 3px; }
  .erp-step2 .f label { font-size: 10.5px; font-weight: 600; color: #475569; }
  .erp-step2 .f input, .erp-step2 .f textarea {
    height: 34px; border: 1px solid #CBD5E1; border-radius: 6px;
    padding: 0 9px; font-size: 12px; color: #1E293B; background: white;
    outline: none; width: 100%; transition: border-color 0.12s, box-shadow 0.12s;
  }
  .erp-step2 .f input:focus, .erp-step2 .f textarea:focus { border-color: #2563EB; box-shadow: 0 0 0 2px rgba(37,99,235,0.1); }
  .erp-step2 .f textarea { height: 54px; padding: 6px 9px; resize: none; font-size: 12px; }
  .erp-step2 .f input::placeholder, .erp-step2 .f textarea::placeholder { color: #9CA3AF; font-size: 11px; }
  .erp-step2 .file-row { border: 1px dashed #CBD5E1; border-radius: 6px; padding: 5px 10px; display: flex; align-items: center; gap: 6px; font-size: 11px; color: #64748B; background: #FAFAFA; margin-bottom: 8px; cursor: pointer; }
  .erp-step2 .img-thumb { width: 72px; height: 54px; object-fit: cover; border-radius: 6px; border: 1px solid #E2E8F0; }
  .erp-step2 .img-row { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
  .erp-step2 .btn-send { background: #059669; color: white; border: none; height: 34px; padding: 0 14px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap; }
  .erp-step2 .btn-send:hover { background: #047857; }
  .erp-step2 .step-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 4px; margin-bottom: 8px; }
  .erp-step2 .btn-back { height: 34px; padding: 0 14px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; background: white; color: #374151; border: 1px solid #D1D5DB; }
  .erp-step2 .btn-back:hover { background: #F9FAFB; }
  .erp-step2 .btn-next { height: 34px; padding: 0 20px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; border: none; background: #2563EB; color: white; }
  .erp-step2 .btn-next:hover { background: #1D4ED8; }
  @media (max-width: 700px) {
    .erp-step2 .g2, .erp-step2 .g-email { grid-template-columns: 1fr !important; }
  }
`;

export default function Step2({ initial = {}, onNext, onPrev, onUpdate }) {
  const [form, setForm] = useState({
    label_files: [],
    label_urls: initial.label_urls || [],
    etd: "",
    final_delivery_date: "",
    bl_no: "",
    container_no: "",
    pol: "",
    notify_email: "",
    email_message: "",
    ...initial,
  });

  useEffect(() => {
    onUpdate(form);
  }, [form, onUpdate]);

  function change(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    onUpdate({ ...form, [name]: value });
  }

  function sendMail() {
    if (!form.notify_email) {
      alert("Please enter recipient email");
      return;
    }

    API.post("/notification/send-tracking-email", {
      to: form.notify_email,
      subject: "Shipment Tracking Update",
      bl_no: form.bl_no,
      container_no: form.container_no,
      etd: form.etd,
      final_delivery_date: form.final_delivery_date,
      message: `
Shipment Tracking Details

BL No: ${form.bl_no}
Container No: ${form.container_no}
ETD: ${form.etd}
Final Delivery : ${form.final_delivery_date}
POL: ${form.pol}

Message:
${form.email_message || ""}
    `,
    })
      .then(() => alert("Email sent successfully ✅"))
      .catch(() => alert("Failed to send email ❌"));
  }

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    setForm((f) => ({ ...f, label_files: files }));
    onUpdate({ ...form, label_files: files });

    const fd = new FormData();
    files.forEach((file) => fd.append("files", file));
    try {
      const res = await API.post("/files/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setForm((f) => ({ ...f, label_urls: res.data }));
      onUpdate({ ...form, label_urls: res.data });
    } catch (err) {
      console.error("Upload failed", err);
    }
  }

  return (
    <div className="erp-step2">
      <style>{S}</style>

      {/* ── TRACKING DETAILS ── */}
      <div className="card">
        <div className="card-hdr">
          <div className="card-title">Tracking Details <span className="badge">STEP 2</span></div>
        </div>

        {/* File Upload */}
        <label className="file-row" style={{ cursor: "pointer" }}>
          <span>📎</span>
          <span>Upload Label Photos — Choose files or drag &amp; drop</span>
          <input type="file" accept="image/*" multiple onChange={handleFiles} style={{ display: "none" }} />
        </label>
        {form.label_urls?.length > 0 && (
          <div className="img-row">
            {form.label_urls.map((u, i) => (
              <img key={i} src={u.url || u} className="img-thumb" alt="label" />
            ))}
          </div>
        )}

        <div className="g2">
          <div className="f">
            <label>ETD (Estimated Time of Departure)</label>
            <input type="date" name="etd" value={form.etd} onChange={change} />
          </div>
          <div className="f">
            <label>Final Delivery</label>
            <input type="date" name="final_delivery_date" value={form.final_delivery_date} onChange={change} />
          </div>
        </div>

        <div className="g2">
          <div className="f">
            <label>BL No</label>
            <input name="bl_no" value={form.bl_no} onChange={change} placeholder="Bill of Lading No" />
          </div>
          <div className="f">
            <label>Container No</label>
            <input name="container_no" value={form.container_no} onChange={change} placeholder="Container Number" />
          </div>
        </div>

        <div className="g-full">
          <div className="f">
            <label>POL (Port of Loading)</label>
            <input type="text" name="pol" value={form.pol} onChange={change} placeholder="Enter Port of Loading" />
          </div>
        </div>
      </div>

      {/* ── SEND TRACKING EMAIL ── */}
      <div className="card">
        <div className="card-hdr">
          <div className="card-title">📧 Send Tracking Email</div>
        </div>

        <div className="g-email">
          <div className="f">
            <label>Recipient Email</label>
            <input
              type="email"
              name="notify_email"
              value={form.notify_email}
              onChange={change}
              placeholder="Recipient Email"
            />
          </div>
          <button className="btn-send" type="button" onClick={sendMail}>
            Send Email
          </button>
        </div>

        <div className="f">
          <label>Optional message</label>
          <textarea
            name="email_message"
            value={form.email_message}
            onChange={change}
            placeholder="Optional message"
          />
        </div>
      </div>

      <div className="step-footer">
        <button className="btn-back" type="button" onClick={onPrev}>
          ← Back
        </button>
        <button className="btn-next" type="button" onClick={onNext}>
          Save &amp; Next →
        </button>
      </div>
    </div>
  );
}
