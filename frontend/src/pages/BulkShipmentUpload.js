import React, { useState } from "react";
import API from "../services/api";
import "./BulkShipmentUpload.css";

export default function BulkShipmentUpload({ visible, setVisible, onDone }) {
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  if (!visible) return null; // Don't render if not visible

  async function upload() {
    if (!file) return alert("Please select an Excel or CSV file");

    setLoading(true);
    setMsg("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      await API.post("/shipment/bulk-upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMsg("✅ Upload successful");
      setFile(null);
      onDone?.();
      // Automatically close after short delay
      setTimeout(() => setVisible(false), 1500);
    } catch (err) {
      console.error(err);
      setMsg("❌ Upload failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bulk-upload-overlay">
      <div className="bulk-upload-modal">
        {/* HEADER WITH CROSS BUTTON */}
        <div className="bulk-upload-header">
          <h4 className="bulk-upload-heading">📂 Bulk Upload Transactions</h4>
          <button
            className="close-btn"
            onClick={() => setVisible(false)}
            disabled={loading}
            title="Close"
          >
            ✖
          </button>
        </div>

        {/* BODY */}
        <div className="bulk-upload-body">
          <div className="file-input-wrapper">
            <input
              type="file"
              accept=".xlsx,.csv"
              onChange={(e) => setFile(e.target.files[0])}
              id="fileInput"
            />
            <label htmlFor="fileInput" className="file-label">
              {file ? file.name : "Choose CSV / Excel file"}
            </label>
          </div>

          <button className="upload-btn" onClick={upload} disabled={loading}>
            {loading ? "Uploading..." : "Upload"}
          </button>

          {msg && (
            <p className={`msg ${msg.includes("❌") ? "error" : "success"}`}>
              {msg}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
