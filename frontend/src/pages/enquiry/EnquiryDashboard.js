import React, { useState, useEffect, useCallback, useRef } from "react"; // ✅ NEW: useRef
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { toast } from "react-toastify";
import API from "../../services/api";
import EnquiryStats from "../../components/enquiry/EnquiryStats";
import EnquiryFilters from "../../components/enquiry/EnquiryFilters";
import EnquiryTable from "../../components/enquiry/EnquiryTable";
import CreateEnquiryModal from "../../components/enquiry/CreateEnquiryModal";
import ViewEnquiryModal from "../../components/enquiry/ViewEnquiryModal";
import { exportEnquiriesToExcel } from "../../utils/exportEnquiryExcel"; // ✅ NEW
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

// ✅ NEW — Global search helpers --------------------------------------------
// Flattens EVERY value of an enquiry (parent parts, child parts, suppliers,
// PO numbers, descriptions, dates...) into one lowercase searchable string.
const SEARCH_SKIP_KEYS = new Set(["_id", "__v", "editHistory", "updatedAt", "boNumberMode", "isChildPart", "sectionColor"]);
const SEARCH_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const SEARCH_ISO_DATE = /^\d{4}-\d{2}-\d{2}/;
function searchDateForms(str) {
  const d = new Date(str);
  if (isNaN(d)) return [];
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  // same formats the table shows: 2026-03-11 and 11-Mar-26 (+ dd/mm/yyyy)
  return [`${yyyy}-${mm}-${dd}`, `${dd}-${SEARCH_MONTHS[d.getMonth()]}-${String(yyyy).slice(-2)}`, `${dd}/${mm}/${yyyy}`];
}
// ✅ NEW — normalise so "AB-123", "ab 123", "AB–123" (en-dash), "AB/123", "AB123" and
// text pasted with hidden/non-breaking characters all find each other.
const searchNorm = (str) => String(str).normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/g, "").toLowerCase();
const searchCompact = (str) => searchNorm(str).replace(/[^\p{L}\p{N}]+/gu, "");
// ✅ NEW — one entry per enquiry: text for the global search bar PLUS dedicated
// lists of ALL inquiry nos / PO nos / part nos / supplier names (parent parts,
// child parts, every per-part supplier & PO) for the Search inquiry / PO / part boxes.
const makeSearchIdx = (values) => {
  const v = values.filter((x) => x !== null && x !== undefined && x !== "").map(String);
  const list = v.map(searchCompact).filter(Boolean);
  return {
    text: v.map(searchNorm).join(" | "),
    compact: list.join("|"), // "|" keeps values separate
    list, // ✅ NEW: each value on its own, for exact-number matching
  };
};
// ✅ NEW — true when the typed text equals one whole value (e.g. the full part / PO number)
const matchExactIdx = (idx, query) => {
  const qc = searchCompact(query);
  return !!qc && idx.list.includes(qc);
};
function matchSearchIdx(idx, query) {
  const qn = searchNorm(query);
  const terms = qn.split(/\s+/).filter(Boolean);
  const qc = searchCompact(qn);
  if (!terms.length) return true;
  const allTerms = terms.every((t) => {
    const tc = searchCompact(t);
    return idx.text.includes(t) || (tc && idx.compact.includes(tc));
  });
  return allTerms || !!(qc && idx.compact.includes(qc));
}
// ✅ NEW — when a search / PO / part / supplier filter is active, show ONLY the matching
// rows of an enquiry (matching parent/child parts and matching supplier+PO lines) instead of
// every row of it. Returns a trimmed COPY for display; the untouched original is kept in a
// hidden `__full` property so View / Edit / PDF always use the complete record.
function pruneEnquiryForSearch(enq, crit) {
  if (!(crit.search || crit.po || crit.part || crit.sup)) return enq;
  const arr = (x) => (Array.isArray(x) ? x : []);
  const parts = arr(enq.parts);
  if (parts.length === 0) return enq; // legacy single-part record: nothing to trim

  const psMap = {};
  arr(enq.partSuppliers).forEach((ps) => {
    psMap[ps.customerPartNo] = arr(ps.suppliers).map((s) =>
      typeof s === "string"
        ? { name: s, poNumber: "", dateOfIssue: "" }
        : { name: s?.name || "", poNumber: s?.poNumber || "", dateOfIssue: s?.dateOfIssue || "" }
    );
  });
  const hasPartSuppliers = Object.values(psMap).some((l) => l.length > 0);

  // enquiry-level values (customer, inquiry no, dates, generated by...) — match every row.
  // poDetails is hidden by the table when per-part suppliers exist, so it is excluded then.
  const enqLevel = {};
  Object.keys(enq).forEach((k) => {
    if (["parts", "partMapping", "partSuppliers", "itemDescription"].includes(k)) return;
    if (k === "poDetails" && hasPartSuppliers) return;
    enqLevel[k] = enq[k];
  });
  const enqVals = collectSearchText(enqLevel);
  const partVals = (p) => (p ? [p.customerPartNo, p.customerPartName, p.modifiedBOPartNo, p.boPartName] : []);
  const matchVals = (vals, q) => matchSearchIdx(makeSearchIdx(vals), q);

  // If the typed text is a COMPLETE part / PO / supplier value somewhere in this enquiry,
  // only rows holding exactly that value are shown (not longer / similar numbers).
  const allNodes = parts.flatMap((p) => [p, ...arr(p.children)]);
  const allSups = allNodes.flatMap((n) => psMap[n.customerPartNo] || []);
  const exactPart = !!crit.part && allNodes.some((n) => matchExactIdx(makeSearchIdx(partVals(n)), crit.part));
  const exactPo = !!crit.po && allSups.some((x) => matchExactIdx(makeSearchIdx([x.poNumber]), crit.po));
  const exactSup = !!crit.sup && allSups.some((x) => matchExactIdx(makeSearchIdx([x.name]), crit.sup));
  const test = (vals, q, exact) => (exact ? matchExactIdx(makeSearchIdx(vals), q) : matchVals(vals, q));
  // global bar: same rule — a complete value typed (part no, PO, inquiry no, name...) matches only that value
  const exactSearch =
    !!crit.search &&
    matchExactIdx(
      makeSearchIdx([
        ...enqVals,
        ...allNodes.flatMap(partVals),
        ...allNodes.map((n) => n.itemDescription || enq.itemDescription),
        ...allSups.flatMap((x) => collectSearchText(x)),
      ]),
      crit.search
    );

  const evalNode = (node, parent) => {
    const sups = psMap[node.customerPartNo] || [];
    let kept = sups;
    // PO / Supplier boxes: strict, per supplier line
    if (hasPartSuppliers && (crit.po || crit.sup)) {
      kept = sups.filter(
        (x) => (!crit.po || test([x.poNumber], crit.po, exactPo)) && (!crit.sup || test([x.name], crit.sup, exactSup))
      );
      if (kept.length === 0) return { keep: false, suppliers: [] };
    }
    // Part box: only the row that itself holds the number
    if (crit.part && !test(partVals(node), crit.part, exactPart)) return { keep: false, suppliers: kept };
    // Global bar: a matching parent also shows its related children
    if (crit.search) {
      const partCtx = parent ? [...partVals(parent), ...partVals(node)] : partVals(node);
      const base = [...enqVals, ...partCtx, node.itemDescription || enq.itemDescription];
      const supVals = (list) => list.flatMap((x) => collectSearchText(x));
      if (!test([...base, ...supVals(kept)], crit.search, exactSearch)) return { keep: false, suppliers: kept };
      // narrow to the supplier line(s) the text actually hit; if it hit part/enquiry fields keep all
      const strict = kept.filter((x) => test([...base, ...supVals([x])], crit.search, exactSearch));
      if (strict.length > 0) kept = strict;
    }
    return { keep: true, suppliers: kept };
  };

  const newSup = {};
  const newParts = [];
  parts.forEach((parent) => {
    const pe = evalNode(parent, null);
    const kids = arr(parent.children)
      .map((ch) => ({ ch, e: evalNode(ch, parent) }))
      .filter((x) => x.e.keep);
    kids.forEach((x) => {
      newSup[x.ch.customerPartNo] = x.e.suppliers;
    });
    if (pe.keep) {
      newParts.push({ ...parent, children: kids.map((x) => x.ch) });
      newSup[parent.customerPartNo] = pe.suppliers;
    } else {
      // parent itself doesn't match: show ONLY the matching child row(s), on their own
      kids.forEach((x) => newParts.push({ ...x.ch, children: [] }));
    }
  });
  if (newParts.length === 0) return enq; // matched via cross-row text: show the enquiry whole

  const out = {
    ...enq,
    parts: newParts,
    partSuppliers: arr(enq.partSuppliers).map((ps) =>
      Object.prototype.hasOwnProperty.call(newSup, ps.customerPartNo) ? { ...ps, suppliers: newSup[ps.customerPartNo] } : ps
    ),
  };
  // no kept row has a supplier -> don't let the table fall back to the (first-supplier) general PO
  if (hasPartSuppliers && !Object.values(newSup).some((l) => l.length > 0)) {
    out.poDetails = { supplierName: "", poNumber: "", dateOfIssue: null };
  }
  Object.defineProperty(out, "__full", { value: enq, enumerable: false });
  return out;
}
function buildSearchIndex(enq) {
  const arr = (x) => (Array.isArray(x) ? x : []);
  const partFields = (p) => (p ? [p.customerPartNo, p.customerPartName, p.modifiedBOPartNo, p.boPartName] : []);
  const partVals = [
    ...partFields(enq.partMapping),
    ...arr(enq.parts).flatMap((p) => [...partFields(p), ...arr(p.children).flatMap(partFields)]),
    ...arr(enq.partSuppliers).map((ps) => ps.customerPartNo),
  ];
  const sups = arr(enq.partSuppliers).flatMap((ps) => arr(ps.suppliers));
  const poVals = [
    enq.poDetails?.poNumber,
    ...arr(enq.poDetailsList).map((x) => x?.poNumber),
    ...sups.map((s) => (typeof s === "string" ? "" : s?.poNumber)),
  ];
  const supVals = [
    enq.poDetails?.supplierName,
    ...arr(enq.poDetailsList).map((x) => x?.supplierName),
    ...sups.map((s) => (typeof s === "string" ? s : s?.name)),
  ];
  return {
    enq,
    all: makeSearchIdx(collectSearchText(enq)),
    inq: makeSearchIdx([enq.enquiryNumber]),
    po: makeSearchIdx(poVals),
    part: makeSearchIdx(partVals),
    sup: makeSearchIdx(supVals),
  };
}
function collectSearchText(value, out = []) {
  if (value === null || value === undefined || typeof value === "boolean") return out;
  if (Array.isArray(value)) {
    value.forEach((v) => collectSearchText(v, out));
    return out;
  }
  if (typeof value === "object") {
    Object.entries(value).forEach(([k, v]) => {
      if (!SEARCH_SKIP_KEYS.has(k)) collectSearchText(v, out);
    });
    return out;
  }
  const str = String(value);
  out.push(str);
  if (SEARCH_ISO_DATE.test(str)) out.push(...searchDateForms(str));
  return out;
}

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
  const [isExporting, setIsExporting] = useState(false); // ✅ NEW
  const searchCacheRef = useRef(null); // ✅ NEW — all enquiries, pre-indexed for search
  const searchReqRef = useRef(0);      // ✅ NEW — ignores out-of-date search responses

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
      // ✅ NEW — GLOBAL SEARCH: whatever is typed is matched against every field of
      // every enquiry in the database (parent + child parts, suppliers, POs, dates...),
      // not just the current page. Other filters/sort still apply as before.
      const reqId = ++searchReqRef.current;
      const searchText = (filters.search || "").trim();
      const inqText = (filters.inquiryNumber || "").trim();
      const poText = (filters.poNumber || "").trim();
      const partText = (filters.partNumber || "").trim();
      const supText = (filters.supplierName || "").trim();
      if (searchText || inqText || poText || partText || supText) {
        // Search bar + Search inquiry / PO / part boxes + Supplier dropdown are matched
        // here (not on the server) so child parts and every per-part supplier / PO count.
        const baseParams = {
          ...(filters.customerName && { customerName: filters.customerName }),
          ...(filters.rfqDateFrom && { rfqDateFrom: filters.rfqDateFrom }),
          ...(filters.rfqDateTo && { rfqDateTo: filters.rfqDateTo }),
          ...(filters.generatedBy && { generatedBy: filters.generatedBy }),
          ...(sortField && { sortField, sortOrder }),
        };
        const cacheKey = JSON.stringify(baseParams);
        const cache = searchCacheRef.current;
        let indexed;
        if (cache && cache.key === cacheKey && (page > 1 || Date.now() - cache.time < 60000)) {
          indexed = cache.list; // typing more letters re-filters instantly, no refetch
        } else {
          const all = [];
          let p = 1;
          let tp = 1;
          do {
            const r = await API.get("/enquiry", { params: { ...baseParams, page: p, limit: 500 } });
            all.push(...(r.data.enquiries || []));
            tp = r.data.totalPages || 1;
            p += 1;
          } while (p <= tp);
          indexed = all.map(buildSearchIndex);
          searchCacheRef.current = { key: cacheKey, time: Date.now(), list: indexed };
        }
        if (reqId !== searchReqRef.current) return; // a newer keystroke superseded this one
        let pool = indexed.filter(
          (idx) =>
            (!searchText || matchSearchIdx(idx.all, searchText)) &&
            (!inqText || matchSearchIdx(idx.inq, inqText)) &&
            (!poText || matchSearchIdx(idx.po, poText)) &&
            (!partText || matchSearchIdx(idx.part, partText)) &&
            (!supText || matchSearchIdx(idx.sup, supText))
        );
        // a complete inquiry / PO / part / supplier value was typed -> only enquiries holding exactly it
        [["all", searchText], ["inq", inqText], ["po", poText], ["part", partText], ["sup", supText]].forEach(([k, q]) => {
          if (!q) return;
          const exact = pool.filter((idx) => matchExactIdx(idx[k], q));
          if (exact.length > 0) pool = exact;
        });
        const matched = pool.map((x) => x.enq);
        const crit = { search: searchText, inq: inqText, po: poText, part: partText, sup: supText };
        const slice = matched
          .slice((page - 1) * LIMIT, page * LIMIT)
          .map((enq) => pruneEnquiryForSearch(enq, crit)); // ✅ NEW: show only matching rows
        setEnquiries((prev) => (page === 1 ? slice : [...prev, ...slice]));
        setTotal(matched.length);
        setTotalPages(Math.max(1, Math.ceil(matched.length / LIMIT)));
        return;
      }

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
    searchCacheRef.current = null; // ✅ NEW — drop cached search data after create/update
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
      setSelectedEnquiry(enq.__full || enq); // fallback to table data  // ✅ NEW: full record
    }
    setShowViewModal(true);
  };

  // Edit
  const handleEdit = (enq) => {
    setEditData(enq.__full || enq); // ✅ NEW: never edit a search-trimmed copy
    setShowCreateModal(true);
  };

  // Download PDF
  const handleDownload = (enq) => {
    enq = enq.__full || enq; // ✅ NEW: PDF uses the full record
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
        ["Item Description", (Array.isArray(enq.parts) && enq.parts[0]?.itemDescription) || enq.itemDescription || "—"],
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

  // ✅ NEW — Export ALL enquiries (ignores filters/pagination) to .xlsx
  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const count = await exportEnquiriesToExcel(API);
      toast.success(`Exported ${count} enquiries to Excel`);
    } catch (err) {
      console.error("Export Excel error:", err);
      toast.error("Failed to export Excel");
    } finally {
      setIsExporting(false);
    }
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

        {/* ✅ NEW — Export Excel button (above table) */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={isExporting}
            style={{
              padding: "8px 16px",
              background: "#15803D",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: isExporting ? "not-allowed" : "pointer",
              opacity: isExporting ? 0.7 : 1,
            }}
          >
            {isExporting ? "Exporting..." : "Export Excel"}
          </button>
        </div>

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
