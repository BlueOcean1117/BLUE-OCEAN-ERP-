import React, { useState, useEffect, useCallback } from "react";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { toast } from "react-toastify";
import API from "../../services/api";
import EnquiryStats from "../../components/enquiry/EnquiryStats";
import EnquiryFilters from "../../components/enquiry/EnquiryFilters";
import EnquiryTable from "../../components/enquiry/EnquiryTable";
import CreateEnquiryModal from "../../components/enquiry/CreateEnquiryModal";
import ViewEnquiryModal from "../../components/enquiry/ViewEnquiryModal";
import "../../styles/enquiry.css";

const LIMIT = 4;

export default function EnquiryDashboard() {
  const [stats, setStats] = useState({});
  const [enquiries, setEnquiries] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState("");
  const [sortOrder, setSortOrder] = useState("asc");

  const [filters, setFilters] = useState({});
  const [filterOptions, setFilterOptions] = useState({
    customers: [],
    suppliers: [],
    generatedByList: [],
  });

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedEnquiry, setSelectedEnquiry] = useState(null);
  const [editData, setEditData] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await API.get("/enquiry/stats");
      setStats(res.data);
    } catch (err) {
      console.error("Stats fetch error:", err);
    }
  }, []);

  // Fetch filter options
  const fetchFilterOptions = useCallback(async () => {
    try {
      const res = await API.get("/enquiry/filters");
      setFilterOptions(res.data);
    } catch (err) {
      console.error("Filter options error:", err);
    }
  }, []);

  // Fetch enquiries
  const fetchEnquiries = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: LIMIT,
        ...(filters.customerName && { customerName: filters.customerName }),
        ...(filters.supplierName && { supplierName: filters.supplierName }),
        ...(filters.rfqDateFrom && { rfqDateFrom: filters.rfqDateFrom }),
        ...(filters.rfqDateTo && { rfqDateTo: filters.rfqDateTo }),
        ...(filters.inquiryNumber && { inquiryNumber: filters.inquiryNumber }),
        ...(filters.poNumber && { poNumber: filters.poNumber }),
        ...(filters.partNumber && { partNumber: filters.partNumber }),
        ...(filters.generatedBy && { generatedBy: filters.generatedBy }),
        ...(filters.search && { search: filters.search }),
        ...(sortField && { sortField, sortOrder }),
      };

      const res = await API.get("/enquiry", { params });
      setEnquiries(res.data.enquiries);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    } catch (err) {
      console.error("Fetch enquiries error:", err);
      toast.error("Failed to fetch enquiries");
    } finally {
      setLoading(false);
    }
  }, [page, filters, sortField, sortOrder]);

  useEffect(() => {
    fetchStats();
    fetchFilterOptions();
  }, [fetchStats, fetchFilterOptions]);

  useEffect(() => {
    fetchEnquiries();
  }, [fetchEnquiries]);

  // Reset page on filter change
  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    setPage(1);
  };

  // Sort handler
  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Create / Update
  const handleSubmit = async (payload) => {
    setIsSubmitting(true);
    try {
      if (editData) {
        await API.put(`/enquiry/update/${editData._id}`, payload);
        toast.success("Enquiry updated successfully");
      } else {
        await API.post("/enquiry/create", payload);
        toast.success("Enquiry created successfully");
      }
      setShowCreateModal(false);
      setEditData(null);
      fetchEnquiries();
      fetchStats();
      fetchFilterOptions();
    } catch (err) {
      const msg = err.response?.data?.message || "Operation failed";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // View — fetch fresh data by ID so editHistory is always current
  const handleView = async (enq) => {
    try {
      const res = await API.get(`/enquiry/${enq._id}`);
      setSelectedEnquiry(res.data);
    } catch {
      setSelectedEnquiry(enq); // fallback to table data
    }
    setShowViewModal(true);
  };

  // Edit
  const handleEdit = (enq) => {
    setEditData(enq);
    setShowCreateModal(true);
  };

  // Download PDF
  const handleDownload = (enq) => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.setTextColor(37, 84, 232);
    doc.text("Enquiry Details", 14, 20);

    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Enquiry Number: ${enq.enquiryNumber || "N/A"}`, 14, 30);
    doc.text(
      `Generated: ${new Date(enq.createdAt).toLocaleDateString()}`,
      14,
      36
    );

    doc.autoTable({
      startY: 45,
      head: [["Field", "Value"]],
      body: [
        ["Customer Name", enq.customerName || "—"],
        [
          "Customer RFQ Date",
          enq.customerRFQDate
            ? new Date(enq.customerRFQDate).toLocaleDateString()
            : "—",
        ],
        ["Email Subject", enq.emailSubject || "—"],
        ["Item Description", enq.itemDescription || "—"],
        ["Customer Part No", enq.partMapping?.customerPartNo || "—"],
        ["Customer Part Name", enq.partMapping?.customerPartName || "—"],
        ["Modified BO Part No", enq.partMapping?.modifiedBOPartNo || "—"],
        ["BO Part Name", enq.partMapping?.boPartName || "—"],
        ["Supplier Name", enq.poDetails?.supplierName || "—"],
        ["PO Number", enq.poDetails?.poNumber || "—"],
        ["LOI Number", enq.poDetails?.loiNumber || "—"],
        [
          "Date of Issue",
          enq.poDetails?.dateOfIssue
            ? new Date(enq.poDetails.dateOfIssue).toLocaleDateString()
            : "—",
        ],
        ["Generated By", enq.generatedBy || "—"],
      ],
      styles: { fontSize: 10 },
      headStyles: { fillColor: [37, 84, 232] },
    });

    doc.save(`Enquiry_${enq.enquiryNumber || "details"}.pdf`);
  };

  const lastUpdated = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="enquiry-page">
      {/* Header */}
      {/* <div className="enquiry-header">
        <div className="enquiry-header-left">
          <h1>ERP Management System</h1>
          <p>Complete Unified Enquiry Management Dashboard</p>
        </div>
        <div className="enquiry-header-right">
          Last updated: {lastUpdated}
        </div>
      </div> */}

      <div className="enquiry-content">
        {/* Title Row */}
        <div className="enquiry-title-row">
          <div>
            <h2>Unified Enquiry Management</h2>
            <p>
              Complete view of BO Records, PO Numbers &amp; Part Number Mappings
            </p>
          </div>
          <button
            className="enquiry-create-btn"
            onClick={() => {
              setEditData(null);
              setShowCreateModal(true);
            }}
          >
            + Create New Enquiry
          </button>
        </div>

        {/* Statistics */}
        <EnquiryStats stats={stats} />

        {/* Filters */}
        <EnquiryFilters
          filters={filters}
          onFilterChange={handleFilterChange}
          filterOptions={filterOptions}
        />

        {/* Table */}
        {loading ? (
          <div className="enquiry-loading">Loading enquiries...</div>
        ) : (
          <EnquiryTable
            enquiries={enquiries}
            total={total}
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            onSort={handleSort}
            sortField={sortField}
            sortOrder={sortOrder}
            onView={handleView}
            onEdit={handleEdit}
            onDownload={handleDownload}
            limit={LIMIT}
          />
        )}
      </div>

      {/* Create / Edit Modal */}
      <CreateEnquiryModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setEditData(null);
        }}
        onSubmit={handleSubmit}
        editData={editData}
        isSubmitting={isSubmitting}
      />

      {/* View Modal */}
      <ViewEnquiryModal
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setSelectedEnquiry(null);
        }}
        enquiry={selectedEnquiry}
      />
    </div>
  );
}
