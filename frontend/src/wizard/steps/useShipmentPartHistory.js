// frontend/src/wizard/steps/useShipmentPartHistory.js
//
// NEW FILE — Smart Part Number Auto-Suggestion (Shipment History source)
// ─────────────────────────────────────────────────────────────────────────
// Purpose: build an in-memory, deduped "latest record per Part Number"
// index from the EXISTING Shipment List data, so the New/Edit Shipment
// form can offer VS-Code-style autocomplete suggestions without touching
// any existing API, schema, or business logic.
//
// Data source: GET /shipment  (the same "fetchAllShipments" endpoint the
// Shipments List page already uses — see frontend/src/pages/ShipmentsList.js).
// We simply request a larger pageSize on that already-existing endpoint.
// No new API route, no new DB collection, no schema change.
//
// The fetch happens ONCE per browser session (module-level cache + promise)
// so every Part Number field on the form (across multiple part rows, and
// across mounts of Step1) shares a single network call instead of each
// row/instance re-fetching independently.

import { useEffect, useRef, useState, useCallback } from "react";
import API from "../../services/api";

// ── Module-level cache (shared across all component instances) ───────────
let _cachePromise = null;
let _cachedIndex = null;

function normalizePartRow(p) {
  if (!p) return null;
  const part_no = p.part_no ?? p.partNo ?? p.part_number ?? p.partNumber ?? "";
  if (!String(part_no).trim()) return null;
  return {
    part_no: String(part_no).trim(),
    part_desc: p.part_desc ?? p.partDesc ?? p.description ?? "",
    part_qty: p.part_qty ?? p.qty ?? p.quantity ?? "",
    part_box_size: p.part_box_size ?? p.box_size ?? p.boxSize ?? "",
    part_no_of_boxes: p.part_no_of_boxes ?? p.no_of_boxes ?? p.noOfBoxes ?? "",
    part_net_unit: p.part_net_unit ?? p.net_wt ?? p.net_weight ?? "",
    part_gross: p.part_gross ?? p.gross_wt ?? p.gross_weight ?? "",
    part_total_net_wt: p.part_total_net_wt ?? p.total_net_wt ?? "",
  };
}

// Build the "latest per part number" index from a list of shipments.
// Shipments arrive newest-first (backend sorts by createdAt desc), so the
// FIRST time we encounter a given part number, that occurrence is already
// the most recent one — later occurrences of the same part number are
// simply skipped, which naturally implements both "recent record priority"
// and "no duplicate suggestions" at the same time.
function buildIndex(shipments) {
  const map = new Map(); // key: UPPERCASE part_no -> suggestion record
  const order = []; // preserves first-seen (= most recent) order

  for (const shp of shipments || []) {
    const parts = Array.isArray(shp.parts) ? shp.parts : [];
    for (const rawPart of parts) {
      const part = normalizePartRow(rawPart);
      if (!part) continue;
      const key = part.part_no.toUpperCase();
      if (map.has(key)) continue; // already have a more recent one

      const record = {
        ...part,
        supplier_name: shp.supplier_name || "",
        customer: shp.customer || "",
        invoice_no: shp.invoice_no || "",
        last_shipment: shp.bl_no || shp.enquiry_no || "",
      };
      map.set(key, record);
      order.push(key);
    }
  }

  return { map, order };
}

async function loadShipmentHistoryIndex() {
  if (_cachedIndex) return _cachedIndex;
  if (_cachePromise) return _cachePromise;

  _cachePromise = API.get("/shipment?page=1&pageSize=500")
    .then((res) => {
      const shipments = Array.isArray(res.data) ? res.data : res.data?.data || [];
      _cachedIndex = buildIndex(shipments);
      return _cachedIndex;
    })
    .catch((err) => {
      console.error("Smart Part Suggestion: failed to load shipment history", err);
      _cachedIndex = { map: new Map(), order: [] };
      return _cachedIndex;
    })
    .finally(() => {
      _cachePromise = null;
    });

  return _cachePromise;
}

// Exposed for callers (e.g. after a shipment is saved) who want fresher
// suggestions without waiting for a full page reload. Optional — not
// required for the feature to work.
export function invalidateShipmentPartHistoryCache() {
  _cachedIndex = null;
  _cachePromise = null;
}

const MAX_RESULTS = 8;

export default function useShipmentPartHistory() {
  const [ready, setReady] = useState(!!_cachedIndex);
  const indexRef = useRef(_cachedIndex);

  useEffect(() => {
    let cancelled = false;
    loadShipmentHistoryIndex().then((idx) => {
      if (cancelled) return;
      indexRef.current = idx;
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // startsWith matches first, then contains matches — both case-insensitive.
  const search = useCallback((query) => {
    const idx = indexRef.current;
    if (!idx || !query) return [];
    const q = query.trim().toUpperCase();
    if (!q) return [];

    const startsWith = [];
    const contains = [];

    for (const key of idx.order) {
      if (key.startsWith(q)) {
        startsWith.push(idx.map.get(key));
      } else if (key.includes(q)) {
        contains.push(idx.map.get(key));
      }
      if (startsWith.length >= MAX_RESULTS) break;
    }

    return [...startsWith, ...contains].slice(0, MAX_RESULTS);
  }, []);

  return { ready, search };
}
