// frontend/src/pages/dashboard/useDashboardData.js
//
// Data layer for the Logistics Dashboard. Fetches the full shipment list
// via the EXISTING "GET /shipment" endpoint (same one ShipmentsList.js
// uses — just a larger pageSize) and derives every KPI, chart, table, and
// alert from those real records. No mock data, no new database, no new
// endpoint.
//
// A few fields requested in the dashboard brief (PO Number, Payment
// Status, Sea/Origin/Destination Charges, Forwarder confirmation status,
// a distinct "Destination" field, Total Shipment Value) are NOT currently
// captured anywhere in the Shipment schema or form. Rather than invent
// numbers for these, every metric below that would depend on them is
// marked `tracked: false` so the UI can render an honest
// "No data available" state instead of a fabricated figure.

import { useCallback, useEffect, useMemo, useState } from "react";
import API from "../../services/api";

const PAGE_SIZE = 2000; // large enough to cover the whole shipment list for dashboard purposes

// ── Status logic — kept IDENTICAL to ShipmentsList.js so a shipment shows
// the same status here as it does in the Shipment List module. ───────────
export function calcDeliveryStatus(shipment) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const etd = shipment.etd ? new Date(shipment.etd) : null;
  const final = shipment.final_delivery_date ? new Date(shipment.final_delivery_date) : null;
  if (etd) etd.setHours(0, 0, 0, 0);
  if (final) final.setHours(0, 0, 0, 0);

  if (!etd && !final) return shipment.delivery_status || "IN_PROCESS";
  if (final && today >= final) return "DELIVERED";
  if (etd && today >= etd) return "IN_TRANSIT";
  return "IN_PROCESS";
}

export const STATUS_META = {
  IN_PROCESS: { label: "In Process", color: "#92400E", bg: "#FEF9C3", border: "#FDE68A" },
  IN_TRANSIT: { label: "In Transit", color: "#1E40AF", bg: "#DBEAFE", border: "#BFDBFE" },
  DELIVERED: { label: "Delivered", color: "#065F46", bg: "#D1FAE5", border: "#6EE7B7" },
  DELAYED: { label: "Delayed", color: "#991B1B", bg: "#FEE2E2", border: "#FCA5A5" },
};

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthKey(d) {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key) {
  const [y, m] = key.split("-");
  return `${MONTH_LABELS[Number(m) - 1]} ${y}`;
}

function daysBetween(a, b) {
  const MS = 1000 * 60 * 60 * 24;
  return Math.round((new Date(b) - new Date(a)) / MS);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + Math.round(days));
  return d;
}

function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function quantile(sortedArr, q) {
  const pos = (sortedArr.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sortedArr[base + 1] !== undefined) {
    return sortedArr[base] + rest * (sortedArr[base + 1] - sortedArr[base]);
  }
  return sortedArr[base];
}

// ── Avg Transit Time — outlier removal (spec item 5.7: "Remove abnormal
// delays/outliers"). Standard IQR fence; skipped for tiny samples where
// it would be meaningless / could wipe out the whole set. ────────────────
function removeOutliers(values) {
  if (values.length < 4) return values;
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  const cleaned = values.filter((v) => v >= lower && v <= upper);
  return cleaned.length > 0 ? cleaned : values;
}

// ── Avg Transit Time — cohort selection (spec item 5, "Advanced
// Calculation Logic"). Walks the priority list Mode → Origin → Customer →
// Supplier and uses the FINEST level that still has enough historical
// samples to be meaningful, falling back one level at a time. Mode is
// never relaxed — SEA and AIR are never mixed (spec item 2 / 9). ────────
const MIN_COHORT_SAMPLES = 3;
function pickTransitCohort(pool, target) {
  const { mode, origin, customer, supplier } = target;
  const sameMode = pool.filter((s) => s.shipmentType === mode);
  const levels = [
    (s) => origin && s.origin === origin && customer && s.customer === customer && supplier && s.supplier === supplier,
    (s) => origin && s.origin === origin && customer && s.customer === customer,
    (s) => origin && s.origin === origin && supplier && s.supplier === supplier,
    (s) => origin && s.origin === origin,
  ];
  for (const test of levels) {
    const matches = sameMode.filter(test);
    if (matches.length >= MIN_COHORT_SAMPLES) return matches;
  }
  // Broadest (but still same-mode-only) fallback: every historical shipment of this mode.
  return sameMode;
}

// ── Avg Transit Time — full calculation for a given mode + cohort target.
// Only DELIVERED, non-cancelled shipments with both ETD and a delivery
// date count toward the average (spec items 3/4). Returns null if there's
// simply no usable history yet, so the UI can show an honest empty state.
function calcTransitStats(pool, target) {
  const cohort = pickTransitCohort(pool, target).filter(
    (s) => s.status === "DELIVERED" && s.rawStatus !== "CANCELLED" && s.etd && s.deliveryDate
  );
  const rawDays = cohort.map((s) => daysBetween(s.etd, s.deliveryDate)).filter((d) => d >= 0);
  const cleanDays = removeOutliers(rawDays);
  if (cleanDays.length === 0) return null;
  return {
    avgDays: round1(mean(cleanDays)),
    sampleCount: cleanDays.length,
  };
}

// ── Shipment Type normalization (Dashboard fix request, item 4) ──────────
// The dropdown must show ONLY "Air" and "Sea", while grouping every raw
// database variant ("AirX", "Air-samples", "sea", "SEA", "Sea FCL", ...)
// under the correct bucket. Match is a case-insensitive "contains" check —
// exactly mirrors the backend spec ("shipmentType contains 'air'/'sea'").
export function normalizeShipmentType(rawMode) {
  const m = String(rawMode || "").toLowerCase();
  if (m.includes("air")) return "Air";
  if (m.includes("sea")) return "Sea";
  return null; // unrecognized / not tracked — excluded from the Air/Sea dropdown
}

function topN(map, n = 5) {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([label, count]) => ({ label, count }));
}

export default function useDashboardData() {
  const [raw, setRaw] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastFetched, setLastFetched] = useState(null);

  const [filters, setFilters] = useState({
    search: "",
    status: "ALL",
    customer: "ALL",
    supplier: "ALL",
    origin: "ALL",
    mode: "ALL",
    dateFrom: "",
    dateTo: "",
  });

  const fetchAll = useCallback(() => {
    setLoading(true);
    setError("");
    return API.get(`/shipment?page=1&pageSize=${PAGE_SIZE}`)
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : res.data?.data || [];
        setRaw(data);
        setLastFetched(new Date());
      })
      .catch((err) => {
        console.error("Dashboard: failed to load shipments", err);
        setError("Failed to load shipment data. Please try refreshing.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── Normalize once per fetch ────────────────────────────────────────────
  const shipments = useMemo(() => {
    return raw.map((s) => {
      const parts = Array.isArray(s.parts) ? s.parts : [];
      const partNos = parts.map((p) => p.part_no).filter(Boolean);
      const missingBl = !s.bl_no;
      const missingInvoice = !s.invoice_no;
      const missingEtd = !s.etd;
      return {
        id: s._id,
        ref: s.enquiry_no || "",
        customer: s.customer || "",
        supplier: s.supplier_name || "",
        blNo: s.bl_no || "",
        invoiceNo: s.invoice_no || "",
        poNo: null, // not tracked in schema
        partNos,
        origin: s.pol || "", // closest available field to "origin" (Port of Loading)
        destination: null, // not tracked in schema
        etd: s.etd || null,
        deliveryDate: s.final_delivery_date || null,
        mode: s.mode || "",
        shipmentType: normalizeShipmentType(s.mode), // "Air" | "Sea" | null — see normalizeShipmentType above
        ff: s.ff || "",
        paymentStatus: null, // not tracked in schema
        seaCharge: null, // not tracked in schema
        shipmentValue: null, // not tracked in schema
        createdAt: s.createdAt || null,
        rawStatus: s.status || "ACTIVE", // ACTIVE / CANCELLED / DELETED — distinct from computed delivery status
        status: calcDeliveryStatus(s),
        missingBl,
        missingInvoice,
        missingEtd,
        totalNetWeight: s.total_net_weight ?? 0,
        totalGrossWeight: s.total_gross_weight ?? 0,
        totalBoxes: s.total_no_of_boxes ?? 0,
      };
    });
  }, [raw]);

  // ── Filter option lists (derived from real data — never hardcoded) ──────
  const filterOptions = useMemo(() => {
    const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort();
    return {
      customers: uniq(shipments.map((s) => s.customer)),
      suppliers: uniq(shipments.map((s) => s.supplier)),
      origins: uniq(shipments.map((s) => s.origin)),
      // Dropdown shows ONLY "Air" / "Sea" (never raw DB values like "AirX",
      // "sea", "Air-samples") — see normalizeShipmentType above. Only
      // include a bucket if at least one shipment actually falls into it.
      modes: ["Air", "Sea"].filter((type) => shipments.some((s) => s.shipmentType === type)),
    };
  }, [shipments]);

  // ── Apply filters ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return shipments.filter((s) => {
      if (filters.status !== "ALL" && s.status !== filters.status) return false;
      if (filters.customer !== "ALL" && s.customer !== filters.customer) return false;
      if (filters.supplier !== "ALL" && s.supplier !== filters.supplier) return false;
      if (filters.origin !== "ALL" && s.origin !== filters.origin) return false;
      if (filters.mode !== "ALL" && s.shipmentType !== filters.mode) return false;
      if (filters.dateFrom && (!s.createdAt || new Date(s.createdAt) < new Date(filters.dateFrom))) return false;
      if (filters.dateTo && (!s.createdAt || new Date(s.createdAt) > new Date(filters.dateTo))) return false;
      if (q) {
        const hay = [s.ref, s.customer, s.supplier, s.blNo, s.invoiceNo, ...s.partNos].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [shipments, filters]);

  // ── Avg Transit Time — dynamic shipment detection (spec item 1) ─────────
  // Whenever the user searches/selects a QMRel Number, Shipment (BL/
  // Invoice), or Part Number in the existing Dashboard search box, that
  // shipment becomes the "in focus" shipment the Avg Transit Time card
  // calculates for. An exact match on the identifier wins; otherwise, if
  // the search narrows the list down, the most relevant (most recent)
  // result is used. Empty search / no match => no shipment in focus =>
  // card falls back to its previous general (all shipments) behavior.
  const selectedShipment = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    if (!q) return null;

    const exact = shipments.find(
      (s) =>
        s.ref.toLowerCase() === q ||
        s.blNo.toLowerCase() === q ||
        s.invoiceNo.toLowerCase() === q ||
        s.partNos.some((p) => p.toLowerCase() === q)
    );
    if (exact) return exact;

    if (filtered.length === 0) return null;
    const [mostRecent] = [...filtered].sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    );
    return mostRecent;
  }, [filters.search, shipments, filtered]);

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = filtered.length;
    const byStatus = { IN_PROCESS: 0, IN_TRANSIT: 0, DELIVERED: 0, DELAYED: 0 };
    filtered.forEach((s) => { byStatus[s.status] = (byStatus[s.status] || 0) + 1; });

    const finalized = byStatus.DELIVERED + byStatus.DELAYED;
    const onTimePct = finalized > 0 ? Math.round((byStatus.DELIVERED / finalized) * 100) : null;

    // Only DELIVERED shipments count toward Transit Time — a shipment that
    // is still IN_PROCESS/IN_TRANSIT/DELAYED may already have a *planned*
    // final_delivery_date sitting in the future; including those inflated
    // the average with days that haven't actually elapsed yet (the
    // "152.4 Days" bug). Cancelled shipments are excluded via `filtered`
    // never containing a computed DELIVERED status for them in the first
    // place, since calcDeliveryStatus only returns DELIVERED once today's
    // date has actually reached final_delivery_date.
    //
    // Avg Transit Time — dynamic, mode-aware calculation.
    // When a shipment is in focus (selectedShipment, from the search box —
    // see above), the average is computed ONLY from historical shipments
    // of that shipment's own mode (SEA/AIR are never mixed), narrowed by
    // origin/customer/supplier where enough history exists (spec item 5).
    // With no shipment in focus, this falls back to the previous
    // behavior — every currently-filtered delivered shipment, unchanged.
    let avgTransitDays = null;
    let avgTransitMeta = null;

    if (selectedShipment) {
      // The single "most relevant" match might itself be missing its Mode
      // field even though other matches for the same search share one —
      // e.g. searching a Part Number that appears across several
      // shipments. Don't let one incomplete record block the feature:
      // fall back to any matched record that does have a recognized mode.
      const focusMode =
        selectedShipment.shipmentType ||
        (filtered.find((s) => s.shipmentType) || {}).shipmentType ||
        null;

      if (focusMode) {
        const stats = calcTransitStats(shipments, {
          mode: focusMode,
          origin: selectedShipment.origin,
          customer: selectedShipment.customer,
          supplier: selectedShipment.supplier,
        });
        if (stats) {
          avgTransitDays = stats.avgDays;
          avgTransitMeta = {
            mode: focusMode,
            shipmentRef: selectedShipment.ref,
            sampleCount: stats.sampleCount,
          };
          if (selectedShipment.status === "DELIVERED" && selectedShipment.etd && selectedShipment.deliveryDate) {
            // Already delivered — show actual vs. average (spec item 8).
            const actualDays = daysBetween(selectedShipment.etd, selectedShipment.deliveryDate);
            avgTransitMeta.actualDays = actualDays;
            avgTransitMeta.diffDays = Math.round((actualDays - stats.avgDays) * 10) / 10;
          } else if (selectedShipment.etd) {
            // Still in transit — predict ETA from ETD + average (spec item 7).
            avgTransitMeta.etaDate = addDays(selectedShipment.etd, stats.avgDays);
          }
        } else {
          // Mode IS known, but the entire system has zero DELIVERED
          // shipments of that mode with both ETD and a delivery date —
          // a genuine data gap, not a bug. Say so explicitly instead of
          // the generic message, so it's obvious why there's no number.
          avgTransitMeta = { mode: focusMode, noHistory: true };
        }
      }
    }

    if (avgTransitDays === null && !(avgTransitMeta && avgTransitMeta.noHistory)) {
      const transitSamples = filtered
        .filter((s) => s.status === "DELIVERED" && s.rawStatus !== "CANCELLED" && s.etd && s.deliveryDate)
        .map((s) => daysBetween(s.etd, s.deliveryDate))
        .filter((d) => d >= 0);
      avgTransitDays = transitSamples.length > 0 ? round1(mean(transitSamples)) : null;
    }

    return {
      total,
      inTransit: byStatus.IN_TRANSIT,
      delivered: byStatus.DELIVERED,
      pendingOrDelayed: byStatus.IN_PROCESS + byStatus.DELAYED,
      pendingCount: byStatus.IN_PROCESS,
      delayedCount: byStatus.DELAYED,
      onTimePct, // null => "No data available" (no finalized shipments yet)
      avgTransitDays, // null => "No data available" (no shipment has both ETD + delivery date)
      avgTransitMeta, // null when no shipment is in focus; otherwise mode/count/ETA/actual-vs-avg detail for the sub line
      paymentPendingTracked: false,
      shipmentValueTracked: false,
      byStatus,
    };
  }, [filtered, shipments, selectedShipment]);

  // ── Charts ───────────────────────────────────────────────────────────────
  const charts = useMemo(() => {
    // Status distribution (donut)
    const statusDistribution = Object.entries(kpis.byStatus).map(([key, count]) => ({
      key, label: STATUS_META[key].label, count, color: STATUS_META[key].color,
    }));

    // Monthly shipment count (bar) — by createdAt
    const monthMap = {};
    filtered.forEach((s) => {
      if (!s.createdAt) return;
      const k = monthKey(s.createdAt);
      if (!k) return;
      monthMap[k] = (monthMap[k] || 0) + 1;
    });
    const monthKeys = Object.keys(monthMap).sort();
    const monthlyShipments = monthKeys.map((k) => ({ month: monthLabel(k), count: monthMap[k] }));

    // Delivery trend over time (line) — delivered shipments by month of delivery date
    const deliveredMonthMap = {};
    filtered.forEach((s) => {
      if (s.status !== "DELIVERED" || !s.deliveryDate) return;
      const k = monthKey(s.deliveryDate);
      if (!k) return;
      deliveredMonthMap[k] = (deliveredMonthMap[k] || 0) + 1;
    });
    const deliveredKeys = Object.keys(deliveredMonthMap).sort();
    const deliveryTrend = deliveredKeys.map((k) => ({ month: monthLabel(k), count: deliveredMonthMap[k] }));

    // Delay analysis — delayed shipments grouped by supplier
    const delayBySupplier = {};
    filtered.forEach((s) => {
      if (s.status !== "DELAYED") return;
      const key = s.supplier || "Unknown supplier";
      delayBySupplier[key] = (delayBySupplier[key] || 0) + 1;
    });

    // Top customers by shipment count
    const byCustomer = {};
    filtered.forEach((s) => {
      const key = s.customer || "Unknown customer";
      byCustomer[key] = (byCustomer[key] || 0) + 1;
    });

    return {
      statusDistribution,
      monthlyShipments,
      deliveryTrend,
      delayBySupplier: topN(delayBySupplier, 5),
      topCustomers: topN(byCustomer, 5),
    };
  }, [filtered, kpis.byStatus]);

  // ── Detail cards (section 5) ─────────────────────────────────────────────
  const detailCards = useMemo(() => {
    const groupBy = (fn) => {
      const map = {};
      filtered.forEach((s) => {
        const key = fn(s) || "Unspecified";
        map[key] = (map[key] || 0) + 1;
      });
      return topN(map, 6);
    };
    return {
      byCustomer: groupBy((s) => s.customer),
      byDestination: { tracked: false, items: [] }, // not tracked in schema
      bySupplier: groupBy((s) => s.supplier),
      byMonth: charts.monthlyShipments.map((m) => ({ label: m.month, count: m.count })),
      byDeliveryStatus: Object.entries(kpis.byStatus).map(([k, count]) => ({
        label: STATUS_META[k].label, count,
      })),
      byPaymentStatus: { tracked: false, items: [] }, // not tracked in schema
    };
  }, [filtered, charts.monthlyShipments, kpis.byStatus]);

  // ── Tables (section 4) ────────────────────────────────────────────────────
  const tables = useMemo(() => {
    const sortByCreatedDesc = (arr) =>
      [...arr].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    return {
      recent: sortByCreatedDesc(filtered).slice(0, 8),
      pending: sortByCreatedDesc(filtered.filter((s) => s.status === "IN_PROCESS")).slice(0, 8),
      delayed: sortByCreatedDesc(filtered.filter((s) => s.status === "DELAYED")).slice(0, 8),
      paymentPending: { tracked: false, items: [] }, // not tracked in schema
    };
  }, [filtered]);

  // ── Alerts / exceptions (section 6) ──────────────────────────────────────
  const alerts = useMemo(() => {
    const missingDocs = filtered.filter((s) => s.missingBl || s.missingInvoice);
    const missingEtd = filtered.filter((s) => s.missingEtd);
    return {
      delayed: { tracked: true, count: kpis.delayedCount },
      missingDocs: { tracked: true, count: missingDocs.length },
      missingEtd: { tracked: true, count: missingEtd.length },
      pendingApprovals: { tracked: false },
      unpaid: { tracked: false },
      overdue: { tracked: false }, // no distinct "actual vs planned" delivery field to compute this from
    };
  }, [filtered, kpis.delayedCount]);

  return {
    loading,
    error,
    lastFetched,
    refresh: fetchAll,
    filters,
    setFilters,
    filterOptions,
    filteredCount: filtered.length,
    totalCount: shipments.length,
    kpis,
    charts,
    detailCards,
    tables,
    alerts,
    filteredShipments: filtered,
  };
}
