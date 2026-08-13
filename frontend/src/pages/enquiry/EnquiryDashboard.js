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

/* ============================================================================
   CHANGES IN THIS FILE (infinite-scroll support)
   ----------------------------------------------------------------------------
   Everything below is IDENTICAL to your original EnquiryDashboard.js except
   for the specific lines marked "// [INFINITE SCROLL]". Nothing about API
   endpoints, params, filters, sort, view/edit/download, or modals changed.

   1. LIMIT increased from 4 -> 20.
      Same /enquiry endpoint, same params shape — just asking for a bigger
      page per request so scrolling doesn't fire a network call every few
      rows. Pure constant tweak, purely for UX; safe to tune back down.

   2. Added `loadingMore` state, separate from the existing `loading` state.
      `loading` still means "full-page loader" (first load, or after a
      filter/sort/create/update reset). `loadingMore` means "fetching the
      next chunk while scrolling" — used to show a small inline spinner
      at the bottom of the list instead of blanking the whole table.

   3. fetchEnquiries: same request, but the result is now APPENDED to
      `enquiries` when page > 1, and REPLACES it when page === 1 — this is
      what turns "click Next to swap 4 rows" into "scroll to load more
      rows into the same list."

   4. handleSort now also calls setPage(1), so changing sort restarts the
      list from the top (replace) instead of appending page-2-sorted-by-X
      onto page-1-sorted-by-Y. This matches how the old Previous/Next UI
      behaved (sorting always showed page 1 of the new order).

   5. handleSubmit (create/update) now calls a small resetAndRefetch()
      helper instead of calling fetchEnquiries() directly, so that after
      creating/editing an enquiry the list reloads cleanly from the top
      (page 1) rather than re-appending whatever page you'd scrolled to.

   Nothing else — no new endpoints, no new params, no changed response
   shape, no changed filter/search/sort logic.
   ============================================================================ */

const LIMIT = 20; // [INFINITE SCROLL] was 4

export default function EnquiryDashboard() {
  const [stats, setStats] = useState({});
  const [enquiries, setEnquiries] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false); // [INFINITE SCROLL]
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
    // [INFINITE SCROLL] page 1 = full reload (filters/sort/initial),
    // page > 1 = "load more" triggered by scrolling near the bottom.
    const isLoadMore = page > 1;
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
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

      // [INFINITE SCROLL] append on load-more, replace on fresh load
      setEnquiries((prev) =>
        page === 1 ? res.data.enquiries : [...prev, ...res.data.enquiries]
      );
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    } catch (err) {
      console.error("Fetch enquiries error:", err);
      toast.error("Failed to fetch enquiries");
    } finally {
      setLoading(false);
      setLoadingMore(false); // [INFINITE SCROLL]
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
    setPage(1); // [INFINITE SCROLL] restart list from top on re-sort
  };

  // [INFINITE SCROLL] Reload from page 1 after create/update, even if the
  // user had already scrolled to a later page — avoids re-appending a
  // stale page onto the freshly-mutated list.
  const resetAndRefetch = () => {
    if (page === 1) {
      fetchEnquiries();
    } else {
      setPage(1);
    }
  };

  // Create / Update
  const handleSubmit = async (payload) => {
    setIsSubmitting(true);
    try {
      // Count total suppliers being saved across all parts, for a clear
      // confirmation message — makes it obvious the data actually went out.
      const supplierCount = Array.isArray(payload.partSuppliers)
        ? payload.partSuppliers.reduce(
            (sum, ps) => sum + (Array.isArray(ps.suppliers) ? ps.suppliers.length : 0),
            0
          )
        : 0;

      let saved;
      if (editData) {
        const res = await API.put(`/enquiry/update/${editData._id}`, payload);
        saved = res.data;
        toast.success(
          `Enquiry updated — ${supplierCount} supplier${supplierCount === 1 ? "" : "s"} saved`
        );
      } else {
        const res = await API.post("/enquiry/create", payload);
        saved = res.data;
        toast.success(
          `Enquiry created — ${supplierCount} supplier${supplierCount === 1 ? "" : "s"} saved`
        );
      }

      // Sanity check: compare what we sent vs what the server actually
      // persisted and echoed back. If they don't match, warn immediately
      // instead of letting it look like a silent success.
      const savedCount = Array.isArray(saved?.partSuppliers)
        ? saved.partSuppliers.reduce(
            (sum, ps) => sum + (Array.isArray(ps.suppliers) ? ps.suppliers.length : 0),
            0
          )
        : 0;
      if (savedCount !== supplierCount) {
        toast.warn(
          `Warning: sent ${supplierCount} supplier(s) but server saved ${savedCount}. Please re-check the enquiry.`
        );
      }

      setShowCreateModal(false);
      setEditData(null);
      resetAndRefetch(); // [INFINITE SCROLL] was: fetchEnquiries();
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
            loadingMore={loadingMore} // [INFINITE SCROLL]
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
        existingSuppliers={filterOptions.suppliers}
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
