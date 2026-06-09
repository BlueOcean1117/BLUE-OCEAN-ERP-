import React, { useEffect, useState, useRef } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import API from "../services/api";
import "./ShipmentsList.css";
import { useNavigate, useLocation } from "react-router-dom";
import BulkShipmentUpload from "./BulkShipmentUpload";
import { toast } from "react-toastify";

export default function ShipmentsList() {
  const navigate = useNavigate();
  const location = useLocation();

  const isFirstLoad = useRef(true);

  // Pagination + search
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(0);

  // Data
  const [rows, setRows] = useState([]);
  const [filteredRows, setFilteredRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [descValues, setDescValues] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [showStatusAction, setShowStatusAction] = useState(false);
  const [backendStatus, setBackendStatus] = useState("checking");

  // --- LOG DETAIL STATE ---
  const [selectedLog, setSelectedLog] = useState(null); 

  // Bulk Upload Modal
  const [visibleBulkUploadModal, setVisibleBulkUploadModal] = useState(false);

  // ---------- INITIAL LOAD ----------
  useEffect(() => {
    API.get("/health")
      .then(() => setBackendStatus("connected"))
      .catch(() => setBackendStatus("disconnected"))
      .finally(fetchAll);
  }, []);

  // ---------- FETCH SHIPMENTS ----------
  function fetchAll() {
    setLoading(true);
    setError("");
    const query = `?page=${page}&pageSize=${pageSize}&search=${search}`;

    API.get(`/shipment${query}`)
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : [];
        const totalCount = Number(res.headers?.["x-total-count"]);
        setRows(data);
        setFilteredRows(data);
        setTotal(Number.isFinite(totalCount) ? totalCount : data.length);
      })
      .catch((err) => {
        console.error("Failed to load shipments:", err);
        setError("Failed to load shipments");
        setRows([]);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    setFilteredRows(rows);
  }, [rows]);

  useEffect(() => {
    fetchAll();
  }, [page, pageSize, search]);

  // ---------- STATUS UPDATE ----------
  async function updateStatus(id, status) {
    try {
      await API.patch(`/shipment/${id}`, { status });
      fetchAll();
    } catch {
      toast.error("Status update failed");
    }
  }

  const handleBulkDone = (results) => {
    setVisibleBulkUploadModal(false);
    toast.success(`Uploaded ${results.inserted} shipments!`);
    if(results.skippedDuplicates > 0) {
      toast.info(`Skipped ${results.skippedDuplicates} duplicates.`);
    }
    fetchAll();
  };

  // ---------- EXPORT EXCEL ----------
  function exportExcel() {
    const exportData = filteredRows.map(r => ({
      "Enquiry No": r.enquiry_no,
      "FF": r.ff || "N/A",
      "Invoice No": r.invoice_no || "N/A",
      "Invoice Date": r.invoice_date ? new Date(r.invoice_date).toLocaleDateString() : "N/A",
      "Supplier Name": r.supplier_name,
      "Customer": r.customer,
      "Incoterm": r.incoterm || "N/A",
      "Mode": r.mode,
      "ETD": r.etd ? new Date(r.etd).toLocaleDateString() : "N/A",
      "BL No": r.bl_no || "N/A",
      "Container No": r.container_no || "N/A",
      "POL": r.pol || "N/A",
      "Parts": r.parts?.map(p => p.part_no || p.part_number).join(", ") || (r.part_no || r.part_number || "N/A"),
      "Part Names": r.parts?.map(p => p.part_desc || p.part_name).join(", ") || (r.part_desc || r.part_name || "N/A"),
      // 🚀 FIXED: Pointing to correct backend database total keys
       "Total Boxes": r.total_no_of_boxes || 0,
      "Total Parts Count": r.total_parts_count || 0,
      "Total Net Wt": r.total_net_weight || r.net_wt || 0,
      "Total Gross Wt": r.total_gross_weight || r.gross_wt || 0
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Shipments");
    XLSX.writeFile(wb, "shipments.xlsx");
  }

  // ---------- EXPORT PDF ----------
  function exportPDF() {
    const doc = new jsPDF("l", "pt", "a1"); 
    doc.autoTable({
      head: [
        ["Enquiry No", "FF", "Invoice No", "Invoice Date", "Supplier", "Incoterm", "Mode", "ETD", "BL No", "Container", "POL", "Parts", "Part Names", "Total No of Boxes", "Net Wt", "Gross Wt"],
      ],
      body: filteredRows.map((r) => [
        r.enquiry_no,
        r.ff || "N/A",
        r.invoice_no || "N/A",
        r.invoice_date ? new Date(r.invoice_date).toLocaleDateString() : "N/A",
        r.supplier_name, 
        r.incoterm || "N/A",
        r.mode, 
        r.etd ? new Date(r.etd).toLocaleDateString() : "N/A",
        r.bl_no || "N/A",
        r.container_no || "N/A",
        r.pol || "N/A",
        r.parts?.map(p => p.part_no || p.part_number).join(", ") || (r.part_no || r.part_number || "N/A"),
        r.parts?.map(p => p.part_desc || p.part_name).join(", ") || (r.part_desc || r.part_name || "N/A"),
        // 🚀 FIXED: Linked to exact db variables
        r.total_no_of_boxes || 0,
        r.total_net_weight || r.net_wt || 0, 
        r.total_gross_weight || r.gross_wt || 0,
      ]),
    });
    doc.save("shipments.pdf");
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="shipments-page">
      <div className="shipments-header">
        <div>
          <h2>Shipments List</h2>
          <div className="backend-status">
            Backend Status:
            <span className={`status-${backendStatus}`}>
              {backendStatus === "connected" && "🟢 Connected"}
              {backendStatus === "disconnected" && "🔴 Disconnected"}
              {backendStatus === "checking" && "🔵 Checking..."}
            </span>
          </div>
        </div>

        <div className="actions">
          <button className="btn excel" onClick={exportExcel}>Export Excel</button>
          <button className="btn pdf" onClick={exportPDF}>Export PDF</button>
          <button className="btn upload" onClick={() => setVisibleBulkUploadModal(true)}>Upload Bulk</button>
        </div>
      </div>

      {visibleBulkUploadModal && (
        <BulkShipmentUpload visible={visibleBulkUploadModal} setVisible={setVisibleBulkUploadModal} onDone={handleBulkDone} />
      )}

      {selectedLog && (
        <div className="modal-overlay" onClick={() => setSelectedLog(null)}>
          <div className="log-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Shipment Details: {selectedLog.enquiry_no}</h3>
              <button className="close-x" onClick={() => setSelectedLog(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="info-section">
                <h4>Logistics Details</h4>
                <div className="info-grid">
                   <p><strong>Supplier:</strong> {selectedLog.supplier_name}</p>
                   <p><strong>Customer:</strong> {selectedLog.customer}</p>
                   <p><strong>Incoterm:</strong> {selectedLog.incoterm || "N/A"}</p>
                   <p><strong>Mode:</strong> {selectedLog.mode}</p>
                   <p><strong>ETD:</strong> {selectedLog.etd ? new Date(selectedLog.etd).toLocaleDateString() : "N/A"}</p>
                   <p><strong>BL No:</strong> {selectedLog.bl_no || "N/A"}</p>
                   <p><strong>Container No:</strong> {selectedLog.container_no || "N/A"}</p>
                   <p><strong>POL:</strong> {selectedLog.pol || "N/A"}</p>
                   {/* 🚀 FIXED modal field name */}
                    <p><strong>Total Boxes:</strong>     {selectedLog.total_no_of_boxes  || 0}</p>
                   <p><strong>Total Net Wt:</strong> {selectedLog.total_net_weight || selectedLog.net_wt || 0} Kg</p>
                    <p><strong>Total Gross Wt:</strong>  {selectedLog.total_gross_weight || selectedLog.gross_wt || 0} Kg</p>
                </div>
              </div>

              <div className="info-section">
                <h4>Part Breakdown</h4>
                <table className="mini-table">
                  <thead>
                    <tr>
                      <th>Part No</th>
                      <th>Description</th>
                      <th>Qty</th>
                      <th>Box Size</th>
                      <th>Gross Wt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedLog.parts && selectedLog.parts.length > 0 ? selectedLog.parts : [selectedLog]).map((p, i) => (
                      <tr key={i}>
                        <td>{p.part_no || p.part_number || "N/A"}</td>
                        <td>{p.part_desc || p.part_name || "N/A"}</td>
                        {/* 🚀 FIXED dynamic breakdown variable names mapping */}
                        <td>{p.quantity || p.part_qty || p.qty || 0}</td>
                        <td>{p.box_size || p.part_box_size || "N/A"}</td>
                        <td>{p.gross_wt || p.part_gross || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="search-bar">
        <input placeholder="Search by Enquiry / Part No / BL No/Supplier/Customer" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className="reset" onClick={() => setSearch("")}>Reset</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Enquiry No</th>
              <th>FF</th>
              <th>Invoice No</th>
              <th>Invoice Date</th>
              <th>Supplier</th>
              <th>Customer</th>
              <th>Incoterm</th>
              <th>Mode</th>
              <th colSpan={2}>Parts</th>
              <th>Total Boxes </th>
              <th>Total Net Wt</th>
              <th>Total Gross Wt</th>
              <th>ETD</th>
              <th>BL No</th>
              <th>Container No</th>
              <th>POL</th>
              <th>Action</th>
              <th>Delivery Status</th>
              <th onClick={() => setShowStatusAction((p) => !p)} style={{ cursor: "pointer" }}>
                Invalid {showStatusAction ? "▲" : "▼"}
              </th>
              <th>Manual Desc</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => (
              <tr key={r._id} className={r.status === "CANCELLED" ? "row-cancelled" : ""}>
                <td 
                  style={{ color: "#007bff", cursor: "pointer", textDecoration: "underline", fontWeight: "bold" }}
                  onClick={() => setSelectedLog(r)}
                >
                  {r.enquiry_no}
                </td>
                <td>{r.ff || "N/A"}</td>
                <td>{r.invoice_no || "N/A"}</td>
                <td>{r.invoice_date ? new Date(r.invoice_date).toLocaleDateString() : "N/A"}</td>
                <td>{r.supplier_name}</td>
                <td>{r.customer}</td>
                <td>{r.incoterm || "N/A"}</td>
                <td><span className={`badge ${r.mode?.toLowerCase()}`}>{r.mode}</span></td>
                
                <td colSpan={2} style={{ verticalAlign: "top", padding: "8px 6px" }}>
                  {r.parts && r.parts.length > 0
                    ? r.parts.map((p, i) => (
                        <div key={i} style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "10px",
                          padding: "5px 8px",
                          marginBottom: i < r.parts.length - 1 ? "5px" : 0,
                          background: i % 2 === 0 ? "#f8f9ff" : "#fff",
                          border: "1px solid #e3e8f0",
                          borderRadius: "6px",
                          minWidth: "320px",
                        }}>
                          <span style={{
                            minWidth: "18px", height: "18px", borderRadius: "50%",
                            background: "#4a6cf7", color: "#fff",
                            fontSize: "10px", fontWeight: "700",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0, marginTop: "2px"
                          }}>{i + 1}</span>
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <span style={{ fontWeight: "600", fontSize: "13px", color: "#1a1a2e" }}>
                              {p.part_no || p.part_number || "N/A"}
                            </span>
                            <span style={{ fontSize: "12px", color: "#555" }}>
                              {p.part_desc || p.part_name || "N/A"}
                            </span>
                          </div>
                        </div>
                      ))
                    : (
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <span style={{ fontWeight: "600", fontSize: "13px" }}>{r.part_no || r.part_number || "N/A"}</span>
                        <span style={{ fontSize: "12px", color: "#555" }}>{r.part_desc || r.part_name || "N/A"}</span>
                      </div>
                    )}
                </td>

                {/* 🚀 FIXED: Directly displays pre-calculated totals from backend now */}
                <td>{r.total_no_of_boxes  != null ? r.total_no_of_boxes  : 0}</td>
                 <td>{r.total_net_weight   != null ? r.total_net_weight   : (r.net_wt   || 0)}</td>
                <td>{r.total_gross_weight != null ? r.total_gross_weight : (r.gross_wt || 0)}</td>
 
                {/* ✅ ETD now shows real data — populated by Fix 5 in controller */}
                <td>{r.etd ? new Date(r.etd).toLocaleDateString() : "N/A"}</td>
 
                <td>{r.bl_no || "N/A"}</td>
                <td>{r.container_no || "N/A"}</td>
                <td>{r.pol || "N/A"}</td>
                
                <td>
                  <button className="edit-btn" 
                  disabled={r.status === "CANCELLED"} 
                  onClick={() => navigate(`/logistics/${r._id}`, { state: r })}>✏️</button>
                </td>
                <td>
                  <select
                    className={`delivery-select ${r.delivery_status || "IN_PROCESS"}`}
                    value={r.delivery_status || "IN_PROCESS"}
                    onChange={async (e) => {
                      try {
                        await API.patch(`/shipment/delivery-status/${r._id}`, { delivery_status: e.target.value });
                        fetchAll();
                      } catch { toast.error("Failed to update delivery status"); }
                    }}
                  >
                    <option value="IN_PROCESS">In Process</option>
                    <option value="IN_TRANSIT">In Transit</option>
                    <option value="DELIVERED">Final Delivered</option>
                  </select>
                </td>
                <td>
                  {showStatusAction && (r.status === "CANCELLED" ? (
                    <button className="btn-undo" onClick={() => updateStatus(r._id, "ACTIVE")}>Undo</button>
                  ) : (
                    <button className="btn-cancel" onClick={() => updateStatus(r._id, "CANCELLED")}>Cancel</button>
                  ))}
                </td>
                <td>
                  <input
                    type="text"
                    className="desc-input"
                    placeholder="Add description"
                    value={descValues[r._id] ?? r.manual_desc ?? ""}
                    onChange={(e) => setDescValues((prev) => ({ ...prev, [r._id]: e.target.value }))}
                  />
                  <button
                    className="btn small"
                    disabled={savingId === r._id}
                    onClick={async () => {
                      try {
                        setSavingId(r._id);
                        await API.patch(`/shipment/manual-desc/${r._id}`, { manual_desc: descValues[r._id] });
                        toast.success("Description saved ✅");
                        fetchAll();
                      } catch { toast.error("Failed to save description ❌"); } 
                      finally { setSavingId(null); }
                    }}
                  >
                    {savingId === r._id ? "Saving..." : "Save"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button disabled={page === 1} onClick={() => setPage(page - 1)}>⬅ Prev</button>
        <span>Page <strong>{page}</strong> of {totalPages}</span>
        <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next ➡</button>
        <select value={pageSize} onChange={(e) => { setPageSize(e.target.value === "all" ? 10000 : Number(e.target.value)); setPage(1); }}>
          <option value="5">5</option><option value="10">10</option><option value="20">20</option><option value="50">50</option><option value="100">100</option><option value="all">All Entries</option>
        </select>
      </div>
    </div>
  );
}