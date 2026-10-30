import React, { useEffect, useState } from "react";
import API from "../services/api";
import { toast } from "react-toastify";
import { computeAllocation, splitEqually, mapShipmentParts } from "../utils/plAllocation"; // ✅ NEW — PO-wise allocation

// ─────────────────────────────────────────────────────────────────────────
// Document Generation modal
// Flow (updated):import React, { useEffect, useState } from "react";
import API from "../services/api";
import { toast } from "react-toastify";
import { computeAllocation, splitEqually, mapShipmentParts } from "../utils/plAllocation"; // ✅ NEW — PO-wise allocation

// ─────────────────────────────────────────────────────────────────────────
// Document Generation modal
// Flow (updated):
//   • EVD, End Use Letter, SCOMET, Cargo Security Declaration → clicking the
//     name generates & downloads the PDF directly. No verification/preview
//     page. Editable fields (Part Description, End User, HAWB, MAWB) fall
//     back to their existing shipment-derived defaults since there's no
//     longer a step to edit them before download.
//   • Authority Letter → unchanged: clicking the name still opens the
//     preview page (Invoice No./Date) with its own "Generate & Download"
//     button, per explicit instruction to keep that step for this one
//     document only. Its download is now a PDF as well.
// Still talks only to the existing /shipment/:id/document-types,
// /generate-document/:docType/preview and /generate-document/:docType
// endpoints — no existing shipment API call is touched.
// ─────────────────────────────────────────────────────────────────────────

const FIELD_LABELS = {
  part_desc: "Part Description",
  end_user: "End User / Customer",
  sector: "Sector",
  hawb: "HAWB #",
  mawb: "MAWB #",
};

// ✅ NEW — doc types that keep the verification/preview page. Everything
// else skips straight to generate + PDF download on click.
const KEEP_PREVIEW_FOR = new Set([]);

// ✅ NEW — fixed PDF filenames (mirrors backend PDF_FILENAMES)
const PDF_FILENAMES = {
  evd: "EVD.pdf",
  end_use_letter: "End_Use_Letter.pdf",
  scomet: "SCOMET_Declaration.pdf",
  authority_letter: "Authority_Letter.pdf",
  cargo_security_declaration: "Cargo_Security_Declaration.pdf",
  // ✅ NEW — Technologies
  tech_end_use_letter: "End_Use_Letter.pdf",
  tech_scomet: "SCOMET_Declaration.pdf",
  tech_authority_letter: "Authority_Letter.pdf",
  tech_cargo_security_declaration: "Cargo_Security_Declaration.pdf",
};

// ✅ NEW — shared error decoder (unchanged logic, pulled out so both the
// direct-download path and the existing preview path can use it)
// ✅ NEW — Packing List pallet distribution, mirrored exactly from
// utils/packingListGenerator.js (distributeQuantity/distributeWeight) so
// the live preview the user edits matches what the backend will compute
// if they don't touch a value. Pure, no API call — used when the "Number
// of Pallets" dropdown changes.
function plDistributeQuantity(totalQty, palletCount) {
  const n = Math.max(1, Number(palletCount) || 1);
  const total = Number(totalQty) || 0;
  const base = Math.floor(total / n);
  const remainder = total - base * n;
  const result = [];
  for (let i = 0; i < n; i++) result.push(base + (i < remainder ? 1 : 0));
  return result;
}
function plRound2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }
function plDistributeWeight(totalWeight, palletCount) {
  const n = Math.max(1, Number(palletCount) || 1);
  const total = Number(totalWeight) || 0;
  const base = plRound2(total / n);
  const result = new Array(n).fill(base);
  const sum = plRound2(base * n);
  const diff = plRound2(total - sum);
  if (diff !== 0) result[n - 1] = plRound2(result[n - 1] + diff);
  return result;
}
function plBuildPallets(qty, grossWt, dimensions, palletCount) {
  const qtys = plDistributeQuantity(qty, palletCount);
  const weights = plDistributeWeight(grossWt, palletCount);
  return qtys.map((q, i) => ({ qty: q, dimensions: dimensions || "", grossWt: weights[i] }));
}

// ✅ Fixed Packing List address defaults. Pre-filled every time, but every
// field stays editable in the details form before generating.
const PL_DEFAULT_EXPORTERS = {
  consulting: {
    name: "Blue Ocean Consulting",
    lines: [
      "One HQ, 3rd Floor, Office No.301, Sr No.44 Part &",
      "45 Part,Baner Balewadi Road, Balewadi, Pune",
      "411045, Maharashtra (State Code - 27), INDIA",
      "TEL: +91 9753210294",
    ],
  },
  technologies: {
    name: "Blue Ocean Technologies",
    lines: [
      "C-601, 24K Opula, Pimple Nilakh,",
      "Pune – 411027, Maharashtra, INDIA",
      "TEL: +91 9753210294",
    ],
  },
};
const PL_DEFAULT_CONSIGNEE = {
  companyName: "FECON LLC",
  lines: ["3460 Grant Drive,", "Lebanon, Ohio, 45036"],
  attn: "Roman Bunce",
  phone: "+1 513-696-4430",
  email: "rbunce@fecon.com",
};
const PL_DEFAULT_BUYER = {
  companyName: "FECON LLC",
  lines: ["3460 Grant Drive,", "Lebanon, Ohio, 45036"],
  attn: "Roman Bunce",
  phone: "+1 513-696-4430",
  email: "",
};

async function reportGenerateError(err) {
  if (err.response?.data instanceof Blob) {
    try {
      const text = await err.response.data.text();
      const parsed = JSON.parse(text);
      toast.error(parsed.message || "Failed to generate document");
    } catch {
      toast.error("Failed to generate document");
    }
  } else {
    toast.error(err.response?.data?.message || "Failed to generate document");
  }
}

export default function GenerateDocumentModal({ shipment, onClose }) {
  const [category, setCategory] = useState(null); // ✅ NEW — null | "consulting" | "technologies"
  const [docTypes, setDocTypes] = useState([]);
  const [selectedType, setSelectedType] = useState(null);
  const [preview, setPreview] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [loadingList, setLoadingList] = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [directGeneratingType, setDirectGeneratingType] = useState(null); // ✅ NEW
  const [downloadingAll, setDownloadingAll] = useState(false); // ✅ NEW

  // ✅ NEW — Label Document (6th option). Fully isolated state; nothing
  // above this touches or reads these.
  const [labelStep, setLabelStep] = useState(null); // null | "choose" | "form"
  const [labelMode, setLabelMode] = useState(null); // "single" | "multiple"
  const [poInputs, setPoInputs] = useState([""]);
  const [qtyInputs, setQtyInputs] = useState([""]); // ✅ NEW — quantity per PO (parallel to poInputs)
  const [labelGenerating, setLabelGenerating] = useState(false);
  // ✅ NEW — what was typed in the Packing List (PO Number, quantity, number
  // of boxes per PO). It is kept even after leaving the Packing List screens
  // and is used to pre-fill the Label Document's PO / Quantity fields and to
  // number its boxes. Empty until a Packing List PO Number has been entered.
  const [plLabelSeed, setPlLabelSeed] = useState([]); // [{ poNumber, qty (string), boxes (number) }]

  // ✅ NEW — Packing List (7th option). Fully isolated state; nothing above
  // this touches or reads these, and this never touches the Label/other
  // document state either.
  const [plStep, setPlStep] = useState(null); // null | "choose" | "form" | "edit"
  const [plMode, setPlMode] = useState(null); // "single" | "multiple"
  const [plLoading, setPlLoading] = useState(false);
  const [plShipment, setPlShipment] = useState(null); // full shipment record (existing GET /shipment/:id)
  const [plItems, setPlItems] = useState([]); // [{ ...lookup fields, palletCount, pallets:[{qty,dimensions,grossWt}] }]
  const [plHeader, setPlHeader] = useState(null); // header fields + consignee/buyer, seeded from lookup
  const [plGenerating, setPlGenerating] = useState(false);
  // ✅ NEW — PO-wise Part & Quantity Allocation (separate step "allocate").
  // { pos: [{ poNumber, poDate, packingListNo, qty:[per part], boxes:[per part | null=auto] }],
  //   confirmations: { repackParts: {[partIdx]: bool}, dedicatedBoxes: bool } }
  const [plAlloc, setPlAlloc] = useState(null);
  const [plAllocGenerating, setPlAllocGenerating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    API.get(`/shipment/${shipment._id}/document-types`)
      .then((res) => { if (!cancelled) setDocTypes(res.data || []); })
      .catch(() => { if (!cancelled) toast.error("Failed to load document types"); })
      .finally(() => { if (!cancelled) setLoadingList(false); });
    return () => { cancelled = true; };
  }, [shipment._id]);

  const selectDocType = (docType) => {
    setSelectedType(docType);
    setPreview(null);
    setLoadingPreview(true);
    API.get(`/shipment/${shipment._id}/generate-document/${docType}/preview`)
      .then((res) => {
        setPreview(res.data);
        setEditValues(res.data.editable || {});
      })
      .catch(() => toast.error("Failed to load document preview"))
      .finally(() => setLoadingPreview(false));
  };

  const downloadPdfBlob = (blobData, docType, label) => {
    const blob = new Blob([blobData], { type: "application/pdf" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = PDF_FILENAMES[docType] || `${label || "document"}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    toast.success("Document generated ✅");
  };

  // Existing flow — used only for Authority Letter now (still has its
  // preview page + "Generate & Download" button). Same endpoint, same
  // editable-field submission; only the response is now PDF.
  const handleGenerate = async () => {
    if (!selectedType) return;
    try {
      setGenerating(true);
      const res = await API.post(
        `/shipment/${shipment._id}/generate-document/${selectedType}?format=pdf`,
        { editableFields: editValues },
        { responseType: "blob" }
      );
      downloadPdfBlob(res.data, selectedType, preview?.label);
    } catch (err) {
      await reportGenerateError(err);
    } finally {
      setGenerating(false);
    }
  };

  // ✅ NEW — direct generate + download, no preview step. Used for every
  // doc type except the ones in KEEP_PREVIEW_FOR. Editable fields are not
  // collected here, so the backend falls back to its existing
  // shipment-derived defaults for them (same defaults the preview page
  // used to pre-fill).
  const handleDirectGenerate = async (docType, label) => {
    try {
      setDirectGeneratingType(docType);
      const res = await API.post(
        `/shipment/${shipment._id}/generate-document/${docType}?format=pdf`,
        { editableFields: {} },
        { responseType: "blob" }
      );
      downloadPdfBlob(res.data, docType, label);
    } catch (err) {
      await reportGenerateError(err);
    } finally {
      setDirectGeneratingType(null);
    }
  };

  const handleDocTypeClick = (docType, label) => {
    if (KEEP_PREVIEW_FOR.has(docType)) {
      selectDocType(docType);
    } else {
      handleDirectGenerate(docType, label);
    }
  };

  // ✅ NEW — generate all 5 documents as PDFs and download them bundled into
  // a single ZIP. Reuses the same generate-document pipeline server-side;
  // this just calls the new /generate-all-documents endpoint.
  const handleDownloadAll = async () => {
    try {
      setDownloadingAll(true);
      const res = await API.post(
        `/shipment/${shipment._id}/generate-all-documents?category=${category}`, // ✅ CHANGED
        {},
        { responseType: "blob" }
      );
      const skippedHeader = res.headers?.["x-skipped-documents"];
      if (skippedHeader) {
        toast.warn(`Some documents were skipped: ${decodeURIComponent(skippedHeader)}`);
      }
      const blob = new Blob([res.data], { type: "application/zip" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Documents_${shipment.enquiry_no || shipment._id}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("All documents generated ✅");
    } catch (err) {
      await reportGenerateError(err);
    } finally {
      setDownloadingAll(false);
    }
  };

  // ✅ NEW — Label Document handlers. Isolated from every handler above;
  // none of the existing 5-document logic is called or modified here.
  const startLabelFlow = () => {
    setLabelStep("choose");
    setLabelMode(null);
    setPoInputs([""]);
    setQtyInputs([""]); // ✅ NEW
  };

  const chooseLabelMode = (mode) => {
    // ✅ NEW — if PO Numbers were typed in the Packing List, start the Label
    // form with those PO Numbers and quantities (several POs → the
    // multiple-PO form, so none of them is left out). Otherwise unchanged.
    const seed = plLabelSeed;
    const effectiveMode = seed.length > 1 ? "multiple" : mode;
    setLabelMode(effectiveMode);
    if (seed.length > 0) {
      const rows = effectiveMode === "single" ? seed.slice(0, 1) : seed;
      setPoInputs(rows.map((r) => r.poNumber));
      setQtyInputs(rows.map((r) => r.qty));
    } else {
      setPoInputs([""]);
      setQtyInputs([""]); // ✅ NEW
    }
    setLabelStep("form");
  };

  const updatePoInput = (idx, value) => {
    setPoInputs((prev) => prev.map((v, i) => (i === idx ? value : v)));
  };

  // ✅ NEW — quantity for the PO at the same index
  const updateQtyInput = (idx, value) => {
    setQtyInputs((prev) => prev.map((v, i) => (i === idx ? value : v)));
  };

  const addPoInput = () => {
    setPoInputs((prev) => [...prev, ""]);
    setQtyInputs((prev) => [...prev, ""]); // ✅ NEW
  };
  const removePoInput = (idx) => {
    setPoInputs((prev) => prev.filter((_, i) => i !== idx));
    setQtyInputs((prev) => prev.filter((_, i) => i !== idx)); // ✅ NEW
  };

  const backToDocList = () => {
    setLabelStep(null);
    setLabelMode(null);
    setPoInputs([""]);
    setQtyInputs([""]); // ✅ NEW
  };

  const handleGenerateLabels = async () => {
    const poNumbers = poInputs.map((p) => p.trim()).filter(Boolean);
    if (poNumbers.length === 0) {
      toast.error("Enter at least one PO Number");
      return;
    }
    // ✅ NEW — quantities aligned 1:1 with poNumbers (same empty-PO filter, so no mismatch)
    const poQuantities = poInputs
      .map((p, i) => ({ po: p.trim(), qty: (qtyInputs[i] || "").trim() }))
      .filter((x) => x.po)
      .map((x) => x.qty);
    // ✅ NEW — number of boxes per PO as entered in the Packing List, aligned
    // 1:1 with poNumbers. Only sent when EVERY PO here was entered in the
    // Packing List; otherwise omitted and the label numbers its boxes the
    // way it always did.
    const boxCounts = poNumbers.map((po) => {
      const hit = plLabelSeed.find((r) => r.poNumber.trim().toLowerCase() === po.toLowerCase());
      return hit ? Number(hit.boxes) : null;
    });
    const poBoxes = boxCounts.every((n) => Number.isInteger(n) && n >= 0) ? boxCounts : undefined;
    try {
      setLabelGenerating(true);
      const res = await API.post(
        `/shipment/${shipment._id}/generate-label`,
        { poNumbers, poQuantities, poBoxes, category }, // ✅ CHANGED — poQuantities, poBoxes added
        { responseType: "blob" }
      );
      const contentType = res.headers?.["content-type"] || "";
      const isZip = contentType.includes("zip");
      const blob = new Blob([res.data], { type: isZip ? "application/zip" : "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = isZip ? `Labels_${Date.now()}.zip` : `Label_${poNumbers[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      const skippedHeader = res.headers?.["x-skipped-pos"];
      if (skippedHeader) {
        toast.warn(`Some PO Numbers were skipped: ${decodeURIComponent(skippedHeader)}`);
      }
      toast.success("Label document generated ✅");
    } catch (err) {
      // ✅ NEW — Label-specific error handling: surfaces the *actual* reason
      // (from the backend's `details` array — e.g. "PO Number not found.")
      // instead of just the generic top-level message, since that's the
      // whole point of this toast for debugging a specific PO.
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          const details = Array.isArray(parsed.details) ? parsed.details.join(" | ") : "";
          toast.error(details || parsed.message || "Failed to generate label");
        } catch {
          toast.error("Failed to generate label");
        }
      } else {
        const details = Array.isArray(err.response?.data?.details) ? err.response.data.details.join(" | ") : "";
        toast.error(details || err.response?.data?.message || "Failed to generate label");
      }
    } finally {
      setLabelGenerating(false);
    }
  };

  // ✅ NEW — Packing List handlers. Fully isolated from every handler above;
  // none of the existing 5-document or Label logic is called or modified
  // here, and no existing shipment API call is touched.

  // Mirrors utils/packingListGenerator.js's distributeQuantity/distributeWeight
  // exactly, so the client-side preview always matches what the backend will
  // actually print — the backend re-validates/re-derives anyway, this is
  // purely so the editable sections look right as soon as the dropdown
  // changes, before the user hits Generate.
  const plDistributeQty = (total, n) => {
    const count = Math.max(1, Number(n) || 1);
    const t = Number(total) || 0;
    const base = Math.floor(t / count);
    const remainder = t - base * count;
    return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
  };
  const plDistributeWeight = (total, n) => {
    const count = Math.max(1, Number(n) || 1);
    const t = Number(total) || 0;
    const base = Math.round((t / count) * 100) / 100;
    const arr = new Array(count).fill(base);
    const diff = Math.round((t - base * count) * 100) / 100;
    if (diff !== 0) arr[count - 1] = Math.round((arr[count - 1] + diff) * 100) / 100;
    return arr;
  };

  const startPackingListFlow = () => {
    setPlAlloc(null);
    setPlStep("choose");
    setPlMode(null);
    setPlShipment(null);
    setPlItems([]);
    setPlHeader(null);
  };

  const backToDocListFromPl = () => {
    setPlAlloc(null);
    setPlStep(null);
    setPlMode(null);
    setPlShipment(null);
    setPlItems([]);
    setPlHeader(null);
  };

  // Equal split of a gross weight across boxes in proportion to each box's
  // quantity (so an uneven 4/3/3 split gets 40%/30%/30% of the weight, not
  // three identical figures). Remainder from 2-dp rounding goes to the last
  // box so the weights always add up to the line total exactly.
  const plProportionalWeights = (qtys, totalWeight) => {
    const totalQty = qtys.reduce((s, q) => s + q, 0);
    const t = Number(totalWeight) || 0;
    if (totalQty <= 0) return plDistributeWeight(t, qtys.length);
    const w = qtys.map((q) => Math.round(((t * q) / totalQty) * 100) / 100);
    const diff = Math.round((t - w.reduce((s, x) => s + x, 0)) * 100) / 100;
    if (diff !== 0) w[w.length - 1] = Math.round((w[w.length - 1] + diff) * 100) / 100;
    return w;
  };

  // Builds the box rows for one line: total qty split equally (whole
  // numbers, first boxes take the remainder — 10 over 3 boxes → 4/3/3).
  const plBuildBoxes = (qty, grossWt, dimensions, n) => {
    const qtys = plDistributeQty(qty, n);
    const weights = plProportionalWeights(qtys, grossWt);
    return qtys.map((q, i) => ({ qty: q, dimensions: dimensions || "", grossWt: weights[i] }));
  };

  // ✅ NEW — Multiple PO Numbers ("+ Add PO Number") all clone the SAME
  // shipment total (addPlPoEntry sets every new entry's qty to the first
  // entry's qty), so they're identified here by sharing that same qty —
  // this is exactly the "+ Add PO Number" case and does NOT match the
  // separate "Multiple PO" top-level mode's one-line-per-part lines,
  // which normally each have a different part quantity and are left
  // completely untouched by everything below.
  // Lines that split ONE item across several PO entries share a
  // `splitGroup` id (assigned in addPlPoEntry). Only lines in the same
  // group are pooled; every other line stands alone, so different items /
  // unrelated POs are never combined. Mirrors the grouping in
  // generatePackingList (shipment.controller.js).
  const plGroupKey = (item, idx) => (item.splitGroup ? `group:${item.splitGroup}` : `line:${idx}`);
  const plGroupItems = (items) => {
    const groups = new Map(); // key -> [{ item, idx }]
    (items || []).forEach((item, idx) => {
      const key = plGroupKey(item, idx);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ item, idx });
    });
    return groups;
  };
  const plBoxSum = (item) => (item.pallets || []).reduce((s, p) => s + (Number(p.qty) || 0), 0);

  // ✅ NEW — recalculates every PO entry's box quantities (and
  // proportional weights) from the COMBINED box count across ALL PO
  // entries, instead of each entry's own box count independently —
  // e.g. 400 total / (PO1: 1 box + PO2: 1 box) = 200 per box, or
  // 400 total / (PO1: 1 box + PO2: 3 boxes) = 100 per box. Only called
  // from the explicit recalculation points below (box-count change,
  // add/remove PO, "Split equally") — never from a manual per-box edit,
  // so typed values keep sticking exactly as before in between.
  const redistributePlBoxesAcrossPOs = (items) => {
    const result = [...items];
    plGroupItems(items).forEach((members) => {
      if (members.length < 2) return;
      const first = members[0].item;
      const totalQty = Number(first.qty) || 0;
      const totalGrossWt = Number(first.grossWt) || 0;
      const boxCounts = members.map(({ item }) => (item.pallets || []).length || 1);
      const totalBoxes = boxCounts.reduce((s, n) => s + n, 0);
      if (totalBoxes <= 0) return;
      const flatQtys = plDistributeQty(totalQty, totalBoxes);
      const flatWeights = plProportionalWeights(flatQtys, totalGrossWt);
      let cursor = 0;
      members.forEach(({ item, idx }, m) => {
        const n = boxCounts[m];
        const qtys = flatQtys.slice(cursor, cursor + n);
        const weights = flatWeights.slice(cursor, cursor + n);
        cursor += n;
        result[idx] = {
          ...item,
          pallets: (item.pallets || []).map((p, i) => ({ ...p, qty: qtys[i], grossWt: weights[i] })),
        };
      });
    });
    return result;
  };

  // Turns the shipment's own parts (already stored on the Shipment List
  // record — no PO search, no new lookup) into Packing List lines.
  //   • single   → ONE line for the whole shipment, quantity = total
  //                shipment quantity.
  //   • multiple → one line per part, each with its own box split.
  const buildPlItems = (full, mode) => {
    const parts = Array.isArray(full.parts) ? full.parts : [];
    const toLine = (subset, fallbackDesc) => {
      const qty = subset.reduce((s, p) => s + (Number(p.quantity) || 0), 0);
      const netWt = subset.reduce(
        (s, p) => s + (Number(p.quantity) || 0) * (Number(p.net_wt_per_unit) || 0), 0);
      const grossWt = subset.reduce((s, p) => s + (Number(p.gross_wt) || 0), 0);
      const dimensions = subset.find((p) => p.box_size)?.box_size || "";
      return {
        poNumber: "",
        partNo: subset.map((p) => p.part_no).filter(Boolean).join(", "),
        description: subset.map((p) => p.part_desc || p.part_no).filter(Boolean).join(", ") || fallbackDesc,
        hsnCode: subset.find((p) => p.hsn_code)?.hsn_code || "",
        qty,
        unit: "pcs",
        netWt,
        grossWt,
        dimensions,
        palletCount: 1,
        pallets: plBuildBoxes(qty, grossWt, dimensions, 1),
      };
    };

    if (parts.length === 0) {
      // Shipment has no parts array — fall back to its stored totals.
      const qty = Number(full.total_parts_count ?? full.total_qty) || 0;
      if (qty <= 0) return [];
      const grossWt = Number(full.total_gross_weight ?? full.total_gross_wt) || 0;
      return [{
        poNumber: "", partNo: "", description: full.manual_desc || "", hsnCode: "",
        qty, unit: "pcs",
        netWt: Number(full.total_net_weight ?? full.total_net_wt) || 0,
        grossWt, dimensions: "", palletCount: 1,
        pallets: plBuildBoxes(qty, grossWt, "", 1),
      }];
    }

    const lines = mode === "single" ? [toLine(parts, "")] : parts.map((p) => toLine([p], ""));
    return lines.filter((l) => l.qty > 0);
  };

  // Shared by the existing One/Multiple PO flow and the new allocation flow.
  const buildPlHeaderFor = (full) => (
{
    category,
    packingListNo: full.invoice_no || "",
    packingListDate: new Date().toISOString().slice(0, 10),
    customerPoNumber: "",
    customerPoDate: "",
    pol: full.pol || "",
    portOfDischarge: full.port_of_discharge || "",
    finalDestination: full.final_destination || "",
    carrierBy: full.mode ? `By ${full.mode}` : "",
    containerNo: full.container_no || "",
    invoiceNo: full.invoice_no || "",
    invoiceDate: full.invoice_date || "",
    exporter: {
      name: (PL_DEFAULT_EXPORTERS[category] || PL_DEFAULT_EXPORTERS.consulting).name,
      lines: [...(PL_DEFAULT_EXPORTERS[category] || PL_DEFAULT_EXPORTERS.consulting).lines],
    },
    consignee: { ...PL_DEFAULT_CONSIGNEE, lines: [...PL_DEFAULT_CONSIGNEE.lines] },
    buyer: { ...PL_DEFAULT_BUYER, lines: [...PL_DEFAULT_BUYER.lines] },
  }
  );

  // Clicking One PO / Multiple PO. Reuses the existing shipment record
  // (GET /shipment/:id) and the existing Customer Address Book endpoint —
  // no PO number entry and no new search.
  const choosePlMode = async (mode) => {
    try {
      setPlLoading(true);
      const res = await API.get(`/shipment/${shipment._id}`);
      const full = res.data || shipment;

      const items = buildPlItems(full, mode);
      if (items.length === 0) {
        toast.error("This shipment has no quantity recorded, so boxes can't be split.");
        return;
      }

      setPlShipment(full);
      setPlMode(mode);
      setPlItems(items);
      setPlHeader(buildPlHeaderFor(full));
      setPlStep("edit");
    } catch (err) {
      await reportGenerateError(err);
    } finally {
      setPlLoading(false);
    }
  };

  // Switch One PO ↔ Multiple PO from inside the edit screen. Rebuilds the
  // lines from the same already-fetched shipment (no API call); header
  // edits are kept, box edits restart because the line structure changed.
  const switchPlMode = (mode) => {
    if (!plShipment || mode === plMode) return;
    const items = buildPlItems(plShipment, mode);
    if (items.length === 0) return;
    setPlMode(mode);
    setPlItems(items);
  };

  // "Number of Boxes" (1–10) changed for a line: regenerate exactly that
  // many QTY fields, auto-filled with an equal whole-number split. Changing
  // the count necessarily reshapes the fields, so earlier manual values for
  // THAT line are replaced; manual edits are otherwise always preserved.
  const changePlPalletCount = (itemIdx, newCount) => {
    setPlItems((prev) => {
      const next = prev.map((item, i) => {
        if (i !== itemIdx) return item;
        const n = Math.min(10, Math.max(1, Number(newCount) || 1));
        return {
          ...item,
          palletCount: n,
          pallets: plBuildBoxes(item.qty, item.grossWt, item.dimensions, n),
        };
      });
      // ✅ NEW — multiple PO entries sharing one shipment quantity:
      // recompute every entry's box quantities from the combined box
      // count across all of them (also covers the "Split equally" button,
      // which calls this same function with the line's current count).
      return redistributePlBoxesAcrossPOs(next);
    });
  };

  // Typing in a QTY (or dimensions / gross weight) field only touches that
  // one field — nothing else is re-distributed, so manual edits stick.
  const updatePlPalletField = (itemIdx, palletIdx, field, value) => {
    setPlItems((prev) =>
      prev.map((item, i) => {
        if (i !== itemIdx) return item;
        const pallets = item.pallets.map((p, pi) =>
          pi === palletIdx ? { ...p, [field]: value } : p
        );
        return { ...item, pallets };
      })
    );
  };

  // ✅ NEW — per-item PO Number (the field the Packing List Details section
  // was missing). Only touches the one item's poNumber; every other field
  // on that item, and every other item, is untouched.
  const updatePlItemPoNumber = (itemIdx, value) => {
    setPlItems((prev) =>
      prev.map((item, i) => (i === itemIdx ? { ...item, poNumber: value } : item))
    );
  };

  // ✅ NEW — "+ Add PO Number": appends a new, independent PO entry below
  // the existing ones. Reuses the already-fetched shipment's part/quantity
  // details (same totals as the first entry — no new shipment lookup) so
  // the new entry starts from real data, with its own blank PO Number and
  // its own default 1-box split; existing entries (PO number, box edits)
  // are untouched.
  const addPlPoEntry = () => {
    setPlItems((prev) => {
      const base = prev[0] || { qty: 0, grossWt: 0, netWt: 0, dimensions: "", description: "", partNo: "", unit: "pcs" };
      // Tag the cloned line and its source as one split group so their
      // boxes are validated together against the item's total quantity.
      const splitGroup = base.splitGroup || `sg_${Date.now()}`;
      const newItem = {
        splitGroup,
        poNumber: "",
        partNo: base.partNo,
        description: base.description,
        hsnCode: base.hsnCode,
        qty: base.qty,
        unit: base.unit || "pcs",
        netWt: base.netWt,
        grossWt: base.grossWt,
        dimensions: base.dimensions,
        palletCount: 1,
        pallets: plBuildBoxes(base.qty, base.grossWt, base.dimensions, 1),
      };
      // ✅ NEW — the new entry shares the first entry's total shipment
      // quantity, so recompute every entry's boxes from the now-combined
      // box count across all PO entries.
      return redistributePlBoxesAcrossPOs([
        ...prev.map((it, i) => (i === 0 && !it.splitGroup ? { ...it, splitGroup } : it)),
        newItem,
      ]);
    });
  };

  // ✅ NEW — removes one manually-added PO entry (never drops below 1).
  // If the remaining entries still share one shipment quantity, their box
  // split is recombined over the smaller total box count; if only one PO
  // entry is left, it goes back to representing the FULL shipment
  // quantity across its own boxes — the same as the original One PO
  // behavior — since there's no other PO left to split with.
  const removePlItem = (itemIdx) => {
    setPlItems((prev) => {
      if (prev.length <= 1) return prev;
      const removed = prev[itemIdx];
      const next = prev.filter((_, i) => i !== itemIdx);
      if (!removed.splitGroup) return next;
      const remaining = next.filter((it) => it.splitGroup === removed.splitGroup);
      if (remaining.length === 1) {
        // Only one line of that item left — it goes back to the FULL
        // quantity across its own boxes and stops being a split group.
        return next.map((it) => {
          if (it.splitGroup !== removed.splitGroup) return it;
          const { splitGroup, ...only } = it;
          return { ...only, pallets: plBuildBoxes(only.qty, only.grossWt, only.dimensions, only.palletCount) };
        });
      }
      return redistributePlBoxesAcrossPOs(next);
    });
  };

  const updatePlHeaderField = (field, value) => {
    setPlHeader((prev) => ({ ...prev, [field]: value }));
  };
  const updatePlConsigneeField = (block, field, value) => {
    setPlHeader((prev) => ({ ...prev, [block]: { ...prev[block], [field]: value } }));
  };

  // Validation: every box QTY must be a whole number ≥ 0, and the boxes
  // must add up exactly to the item's quantity. A line on its own is
  // checked against its own quantity; lines that split one item (same
  // splitGroup) are checked COLLECTIVELY — their combined boxes must equal
  // the item's total — never each line against the full quantity.
  // Keep in sync with generatePackingList (shipment.controller.js).
  const plValidationErrors = (() => {
    const errs = [];
    plGroupItems(plItems).forEach((members) => {
      let badInput = false;
      members.forEach(({ item, idx }) => {
        const label = item.poNumber ? `PO ${item.poNumber}` : item.description || `Line ${idx + 1}`;
        const raw = (item.pallets || []).map((p) => String(p.qty ?? "").trim());
        const badIdx = raw.findIndex((v) => v === "" || !/^\d+$/.test(v));
        if (badIdx !== -1) {
          errs.push(`${label}: Box ${badIdx + 1} QTY must be a whole number (0 or more).`);
          badInput = true;
        }
      });
      if (badInput) return;
      const expected = Number(members[0].item.qty) || 0;
      const actual = members.reduce((s, { item }) => s + plBoxSum(item), 0);
      if (actual !== expected) {
        const name = members[0].item.description || `Line ${members[0].idx + 1}`;
        errs.push(
          members.length > 1
            ? `${name}: combined box quantities across all PO Numbers total ${actual}, but the expected item quantity is ${expected}.`
            : `${name}: box quantities total ${actual}, but the shipment quantity is ${expected}.`
        );
      }
    });
    return errs;
  })();

  // ✅ NEW — running box count across ALL PO entries (not reset per PO), so
  // the "Box N" numbering below reads 1, 2, 3… straight through every PO
  // Number instead of restarting at 1 for each one — e.g. PO1's one box
  // shows "1/1", PO2's one box shows "2/1" (continuing the global count).
  const plBoxGlobalOffsets = (() => {
    let cursor = 0;
    return (plItems || []).map((it) => {
      const start = cursor;
      cursor += (it.pallets || []).length;
      return start;
    });
  })();

  // ✅ NEW — total boxes across ALL PO entries (denominator for the global label)
  const plBoxGlobalTotal = (plItems || []).reduce((s, it) => s + (it.pallets || []).length, 0);

  const handleGeneratePackingList = async () => {
    if (plValidationErrors.length > 0) {
      toast.error(plValidationErrors[0]);
      return;
    }
    try {
      setPlGenerating(true);
      // ✅ NEW — pass the manually entered PO Number(s) into the Packing
      // List's "Customer PO Number" field. Only fills it in when the user
      // hasn't already typed one into that header field directly, so a
      // manual header edit always wins.
      const enteredPoNumbers = plItems.map((item) => (item.poNumber || "").trim()).filter(Boolean);
      const customerPoNumber = plHeader.customerPoNumber?.trim()
        ? plHeader.customerPoNumber
        : enteredPoNumbers.join(", ");
      const res = await API.post(
        `/shipment/packing-list/generate`,
        {
          ...plHeader,
          customerPoNumber,
          items: plItems.map((item) => ({
            splitGroup: item.splitGroup,
            poNumber: item.poNumber,
            description: item.description,
            hsnCode: item.hsnCode,
            qty: item.qty,
            unit: item.unit,
            netWt: item.netWt,
            grossWt: item.grossWt,
            pallets: item.pallets.map((p) => ({
              qty: Number(p.qty),
              dimensions: p.dimensions,
              grossWt: Number(p.grossWt) || 0,
            })),
          })),
        },
        { responseType: "blob" }
      );
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `PackingList_${plHeader.packingListNo || Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Packing List generated ✅");
    } catch (err) {
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          const details = Array.isArray(parsed.details) ? parsed.details.join(" | ") : "";
          toast.error(details || parsed.message || "Failed to generate Packing List");
        } catch {
          toast.error("Failed to generate Packing List");
        }
      } else {
        toast.error(err.response?.data?.message || "Failed to generate Packing List");
      }
    } finally {
      setPlGenerating(false);
    }
  };

  // ✅ NEW — header / exporter / consignee / buyer form. Moved out of the
  // edit step unchanged so the allocation screen can reuse it; the edit
  // step still renders exactly the same fields via renderPlHeaderSections().
  // (forAllocation hides the two Customer PO fields, because every PO gets
  // its own PO Number/Date on the allocation screen.)
  const renderPlHeaderSections = (forAllocation = false) => (
    <>
            {/* Header fields */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
              {[
                ["packingListNo", "Packing List Number"],
                ["packingListDate", "Packing List Date"],
                ["customerPoNumber", "Customer PO Number"],
                ["customerPoDate", "Customer PO Date"],
                ["pol", "Port of Loading"],
                ["portOfDischarge", "Port of Discharge"],
                ["finalDestination", "Final Destination"],
                ["carrierBy", "Carrier By"],
                ["containerNo", "Container No."],
                ["invoiceNo", "Invoice No."],
                ["invoiceDate", "Invoice Date"],
              ].filter(([field]) => !(forAllocation && (field === "customerPoNumber" || field === "customerPoDate"))).map(([field, label]) => (
                <label key={field} style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 3 }}>
                  {label}
                  <input
                    type="text"
                    value={plHeader[field] ?? ""}
                    onChange={(e) => updatePlHeaderField(field, e.target.value)}
                    style={{ padding: "5px 7px", border: "1px solid #CBD5E1", borderRadius: 4, fontSize: 13 }}
                  />
                </label>
              ))}
            </div>

            {/* Exporter / Consignor (pre-filled, editable) */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Exporter / Consignor</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
                <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 3 }}>
                  Company Name
                  <input
                    type="text"
                    value={plHeader.exporter?.name ?? ""}
                    onChange={(e) => updatePlConsigneeField("exporter", "name", e.target.value)}
                    style={{ padding: "5px 7px", border: "1px solid #CBD5E1", borderRadius: 4, fontSize: 13 }}
                  />
                </label>
                <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 3 }}>
                  Address (one line per row)
                  <textarea
                    value={(plHeader.exporter?.lines || []).join("\n")}
                    onChange={(e) => updatePlConsigneeField("exporter", "lines", e.target.value.split("\n"))}
                    rows={4}
                    style={{ padding: "5px 7px", border: "1px solid #CBD5E1", borderRadius: 4, fontSize: 13, resize: "vertical" }}
                  />
                </label>
              </div>
            </div>

            {/* Consignee / Buyer */}
            {["consignee", "buyer"].map((block) => (
              <div key={block} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  {block === "consignee" ? "Customer / Consignee" : "Buyer (Other Than Consignee)"}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 3 }}>
                    Company Name
                    <input
                      type="text"
                      value={plHeader[block]?.companyName ?? ""}
                      onChange={(e) => updatePlConsigneeField(block, "companyName", e.target.value)}
                      style={{ padding: "5px 7px", border: "1px solid #CBD5E1", borderRadius: 4, fontSize: 13 }}
                    />
                  </label>
                  <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 3 }}>
                    Attn
                    <input
                      type="text"
                      value={plHeader[block]?.attn ?? ""}
                      onChange={(e) => updatePlConsigneeField(block, "attn", e.target.value)}
                      style={{ padding: "5px 7px", border: "1px solid #CBD5E1", borderRadius: 4, fontSize: 13 }}
                    />
                  </label>
                  <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 3, gridColumn: "1 / -1" }}>
                    Address (one line per row — type the full block, we'll split it)
                    <textarea
                      value={(plHeader[block]?.lines || []).join("\n")}
                      onChange={(e) =>
                        updatePlConsigneeField(block, "lines", e.target.value.split("\n"))
                      }
                      rows={2}
                      style={{ padding: "5px 7px", border: "1px solid #CBD5E1", borderRadius: 4, fontSize: 13, resize: "vertical" }}
                    />
                  </label>
                  <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 3 }}>
                    Phone
                    <input
                      type="text"
                      value={plHeader[block]?.phone ?? ""}
                      onChange={(e) => updatePlConsigneeField(block, "phone", e.target.value)}
                      style={{ padding: "5px 7px", border: "1px solid #CBD5E1", borderRadius: 4, fontSize: 13 }}
                    />
                  </label>
                  {block === "consignee" && (
                    <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 3 }}>
                      Email
                      <input
                        type="text"
                        value={plHeader[block]?.email ?? ""}
                        onChange={(e) => updatePlConsigneeField(block, "email", e.target.value)}
                        style={{ padding: "5px 7px", border: "1px solid #CBD5E1", borderRadius: 4, fontSize: 13 }}
                      />
                    </label>
                  )}
                </div>
              </div>
            ))}

    </>
  );

  // ✅ NEW — PO-wise Part & Quantity Allocation ─────────────────────────
  const newAllocPo = (nParts) => ({
    poNumber: "", poDate: "", packingListNo: "",
    qty: Array(nParts).fill(""), boxes: Array(nParts).fill(null),
  });

  const startPlAllocation = async () => {
    try {
      setPlLoading(true);
      const res = await API.get(`/shipment/${shipment._id}`);
      const full = res.data || shipment;
      const parts = mapShipmentParts(full.parts, full);
      if (parts.length === 0 || parts.every((p) => p.qty <= 0)) {
        toast.error("This shipment has no part quantities recorded, so there is nothing to allocate.");
        return;
      }
      setPlShipment(full);
      setPlHeader(buildPlHeaderFor(full));
      setPlAlloc({
        pos: [newAllocPo(parts.length), newAllocPo(parts.length)],
        confirmations: { repackParts: {}, dedicatedBoxes: false },
      });
      setPlStep("allocate");
    } catch (err) {
      await reportGenerateError(err);
    } finally {
      setPlLoading(false);
    }
  };

  const plAllocParts = plShipment ? mapShipmentParts(plShipment.parts, plShipment) : [];
  const plAllocResult =
    plAlloc && plAllocParts.length > 0
      ? computeAllocation({
          parts: plAllocParts,
          pos: plAlloc.pos,
          confirmations: plAlloc.confirmations,
          requirePoDetails: true,
        })
      : null;

  // ✅ NEW — what the Packing List currently holds, per PO Number: the PO
  // Number typed, its quantity and its number of boxes. Read from whichever
  // Packing List screen is open (One/Multiple PO screen, or the allocation
  // screen) and remembered in plLabelSeed so the Label Document can use it.
  // Nothing in the Packing List itself is changed by this.
  const plCurrentSeed = (() => {
    if (plStep === "allocate" && plAllocResult) {
      return plAllocResult.perPo
        .filter((p) => p.poNumber && p.totals.qty > 0)
        .map((p) => ({ poNumber: p.poNumber, qty: String(p.totals.qty), boxes: p.totals.boxes }));
    }
    if (plStep === "edit") {
      const byPo = new Map();
      (plItems || []).forEach((it) => {
        const po = String(it.poNumber || "").trim();
        if (!po) return;
        const cur = byPo.get(po.toLowerCase()) || { poNumber: po, qty: 0, boxes: 0 };
        cur.qty += plBoxSum(it);
        cur.boxes += (it.pallets || []).length;
        byPo.set(po.toLowerCase(), cur);
      });
      return [...byPo.values()].map((x) => ({ ...x, qty: String(x.qty) }));
    }
    return [];
  })();
  const plCurrentSeedKey = JSON.stringify(plCurrentSeed);
  useEffect(() => {
    if (plCurrentSeed.length > 0) setPlLabelSeed(plCurrentSeed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plCurrentSeedKey]);

  const updateAllocPoField = (j, field, value) =>
    setPlAlloc((prev) => ({ ...prev, pos: prev.pos.map((po, k) => (k === j ? { ...po, [field]: value } : po)) }));

  // Editing a quantity puts that part's boxes back on automatic, so a stale
  // manual box split can never silently disagree with the new quantities.
  const updateAllocQty = (j, i, value) =>
    setPlAlloc((prev) => ({
      ...prev,
      pos: prev.pos.map((po, k) => ({
        ...po,
        qty: k === j ? po.qty.map((q, x) => (x === i ? value : q)) : po.qty,
        boxes: po.boxes.map((b, x) => (x === i ? null : b)),
      })),
    }));

  const updateAllocBox = (j, i, value) =>
    setPlAlloc((prev) => {
      const effective = plAllocResult ? plAllocResult.parts[i].boxes : [];
      return {
        ...prev,
        pos: prev.pos.map((po, k) => ({
          ...po,
          boxes: po.boxes.map((b, x) => {
            if (x !== i) return b;
            if (k === j) return value;
            return b === null || b === undefined ? String(effective[k] ?? 0) : b;
          }),
        })),
      };
    });

  const resetAllocBoxes = (i) =>
    setPlAlloc((prev) => ({ ...prev, pos: prev.pos.map((po) => ({ ...po, boxes: po.boxes.map((b, x) => (x === i ? null : b)) })) }));

  // Equal split of one part across every PO; a remainder goes to the first
  // POs one piece at a time (10 over 3 → 4/3/3), so nothing is lost.
  const splitAllocPartEqually = (i) =>
    setPlAlloc((prev) => {
      const counts = splitEqually(plAllocParts[i].qty, prev.pos.length);
      return {
        ...prev,
        pos: prev.pos.map((po, k) => ({
          ...po,
          qty: po.qty.map((q, x) => (x === i ? String(counts[k]) : q)),
          boxes: po.boxes.map((b, x) => (x === i ? null : b)),
        })),
      };
    });

  const addAllocPo = () =>
    setPlAlloc((prev) => ({ ...prev, pos: [...prev.pos, newAllocPo(plAllocParts.length)] }));
  const removeAllocPo = (j) =>
    setPlAlloc((prev) => (prev.pos.length <= 1 ? prev : { ...prev, pos: prev.pos.filter((_, k) => k !== j) }));
  const setAllocRepack = (i, value) =>
    setPlAlloc((prev) => ({ ...prev, confirmations: { ...prev.confirmations, repackParts: { ...prev.confirmations.repackParts, [i]: value } } }));
  const setAllocDedicated = (value) =>
    setPlAlloc((prev) => ({ ...prev, confirmations: { ...prev.confirmations, dedicatedBoxes: value } }));

  const handleGenerateAllocated = async () => {
    if (!plAllocResult || !plAllocResult.ok) {
      toast.error(plAllocResult?.errors?.[0] || "Fix the allocation first.");
      return;
    }
    try {
      setPlAllocGenerating(true);
      const res = await API.post(
        `/shipment/packing-list/generate-allocated`,
        {
          ...plHeader,
          shipmentId: plShipment._id,
          pos: plAlloc.pos.map((po) => ({
            poNumber: po.poNumber,
            poDate: po.poDate,
            qty: po.qty,
            boxes: po.boxes,
          })),
          confirmations: plAlloc.confirmations,
        },
        { responseType: "blob" }
      );
      // Check the real file type from its first bytes ("%PDF" vs ZIP "PK"),
      // so a response that isn't a PDF is never saved with a .pdf name.
      const kindOf = async (data) => {
        const head = new Uint8Array(await new Blob([data]).slice(0, 4).arrayBuffer());
        if (head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46) return "pdf";
        if (head[0] === 0x50 && head[1] === 0x4b) return "zip";
        return "other";
      };
      let pdfData = res.data;
      let kind = await kindOf(pdfData);

      // An older backend answers with a ZIP of separate per-PO files. The user
      // always wants ONE Packing List with every PO in it, so build that same
      // combined list here and ask the existing single-document endpoint for
      // it — one PDF regardless of the backend version.
      if (kind === "zip") {
        const fb = await API.post(
          `/shipment/packing-list/generate`,
          {
            ...plHeader,
            customerPoNumber: plAllocResult.perPo.map((p) => p.poNumber).join(", "),
            customerPoDate: [...new Set(plAllocResult.perPo.map((p) => String(p.poDate || "").trim()).filter(Boolean))].join(", "),
            items: plAllocResult.combinedItems.map((it) => ({
              description: it.description,
              hsnCode: it.hsnCode,
              qty: it.qty,
              unit: it.unit,
              netWt: it.netWt,
              grossWt: it.grossWt,
              pallets: it.pallets.map((p) => ({ qty: Number(p.qty), dimensions: p.dimensions, grossWt: Number(p.grossWt) || 0 })),
            })),
          },
          { responseType: "blob" }
        );
        pdfData = fb.data;
        kind = await kindOf(pdfData);
      }

      if (kind !== "pdf") {
        let msg = "The server did not return a valid PDF. Please restart the backend and try again.";
        try {
          const parsed = JSON.parse(await new Blob([pdfData]).text());
          msg = (Array.isArray(parsed.details) && parsed.details.join(" | ")) || parsed.message || msg;
        } catch { /* not JSON */ }
        toast.error(msg);
        return;
      }
      const blob = new Blob([pdfData], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `PackingList_${plHeader.packingListNo || Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Packing List generated ✅");
    } catch (err) {
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          const details = Array.isArray(parsed.details) ? parsed.details.join(" | ") : "";
          toast.error(details || parsed.message || "Failed to generate Packing List");
        } catch {
          toast.error("Failed to generate Packing List");
        }
      } else {
        toast.error(err.response?.data?.message || "Failed to generate Packing List");
      }
    } finally {
      setPlAllocGenerating(false);
    }
  };

  const plTh = { border: "1px solid #E2E8F0", padding: "5px 6px", background: "#F8FAFC", fontSize: 12, textAlign: "left", verticalAlign: "bottom", whiteSpace: "nowrap" };
  const plTd = { border: "1px solid #E2E8F0", padding: "4px 6px", fontSize: 12, verticalAlign: "middle" };
  const plCellInput = { width: 70, padding: "4px 6px", border: "1px solid #CBD5E1", borderRadius: 4, fontSize: 12 };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: plStep === "allocate" ? 1040 : 560, width: "100%" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>Generate Document</h3>
          <button className="btn small" onClick={onClose}>✕</button>
        </div>
        <p style={{ color: "#64748B", fontSize: 13, marginTop: 4 }}>
          Shipment: <strong>{shipment.enquiry_no}</strong> — Invoice {shipment.invoice_no || "—"}
        </p>

        {/* ✅ NEW — Step 0: Consulting / Technologies */}
        {!category && !selectedType && !labelStep && !plStep && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            <button className="btn" style={{ textAlign: "left" }} onClick={() => setCategory("consulting")}>
              Consulting
            </button>
            <button className="btn" style={{ textAlign: "left" }} onClick={() => setCategory("technologies")}>
              Technologies
            </button>
          </div>
        )}

        {category && !selectedType && !labelStep && !plStep && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            <button className="btn small" style={{ alignSelf: "flex-start" }} onClick={() => setCategory(null)}>
              ← Back
            </button>

            {loadingList && <div>Loading…</div>}

            {!loadingList && docTypes.filter((d) => d.category === category).length > 0 && (
              <button
                className="btn"
                style={{ textAlign: "left", fontWeight: 600 }}
                disabled={downloadingAll || directGeneratingType !== null}
                onClick={handleDownloadAll}
              >
                {downloadingAll ? "Generating all documents…" : "⬇ Download All (ZIP)"}
              </button>
            )}

            {!loadingList && docTypes.filter((d) => d.category === category).map((d) => (
              <button
                key={d.docType}
                className="btn"
                style={{ textAlign: "left" }}
                disabled={directGeneratingType === d.docType || downloadingAll}
                onClick={() => handleDocTypeClick(d.docType, d.label)}
              >
                {directGeneratingType === d.docType ? "Generating PDF…" : d.label}
              </button>
            ))}

            {/* ✅ NEW — 6th option, added below the existing 5. Existing
                buttons above are completely untouched. */}
            {!loadingList && (
              <button
                className="btn"
                style={{ textAlign: "left" }}
                onClick={startLabelFlow}
              >
                Label Document
              </button>
            )}

            {/* ✅ NEW — 7th option, Packing List. Existing buttons above are
                completely untouched. */}
            {!loadingList && (
              <button
                className="btn"
                style={{ textAlign: "left" }}
                onClick={startPackingListFlow}
              >
                Packing List
              </button>
            )}
          </div>
        )}

        {/* ✅ NEW — Label Document: Step 1, One PO vs Multiple PO */}
        {labelStep === "choose" && (
          <div style={{ marginTop: 12 }}>
            <button className="btn small" style={{ marginBottom: 10 }} onClick={backToDocList}>
              ← Back to document list
            </button>
            <p style={{ fontSize: 14, marginBottom: 10 }}>
              Is this shipment for one PO Number or multiple PO Numbers?
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" onClick={() => chooseLabelMode("single")}>
                One PO Number
              </button>
              <button className="btn" onClick={() => chooseLabelMode("multiple")}>
                Multiple PO Numbers
              </button>
            </div>
          </div>
        )}

        {/* ✅ NEW — Label Document: Step 2, PO Number entry + generate */}
        {labelStep === "form" && (
          <div style={{ marginTop: 12 }}>
            <button
              className="btn small"
              style={{ marginBottom: 10 }}
              onClick={() => setLabelStep("choose")}
            >
              ← Back
            </button>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
              {poInputs.map((val, idx) => (
                <div key={idx} style={{ display: "flex", gap: 6 }}>
                  <input
                    type="text"
                    placeholder={labelMode === "single" ? "PO Number (e.g. MB00003256)" : `PO Number ${idx + 1}`}
                    value={val}
                    onChange={(e) => updatePoInput(idx, e.target.value)}
                    style={{ flex: 1, padding: "6px 8px", border: "1px solid #CBD5E1", borderRadius: 4 }}
                  />
                  {/* ✅ NEW — Quantity for this PO */}
                  <input
                    type="text"
                    placeholder="Quantity"
                    value={qtyInputs[idx] ?? ""}
                    onChange={(e) => updateQtyInput(idx, e.target.value)}
                    style={{ width: 110, padding: "6px 8px", border: "1px solid #CBD5E1", borderRadius: 4 }}
                  />
                  {labelMode === "multiple" && poInputs.length > 1 && (
                    <button className="btn small" onClick={() => removePoInput(idx)}>✕</button>
                  )}
                </div>
              ))}
              {labelMode === "multiple" && (
                <button className="btn small" style={{ alignSelf: "flex-start" }} onClick={addPoInput}>
                  + Add another PO Number
                </button>
              )}
            </div>

            <button className="btn" disabled={labelGenerating} onClick={handleGenerateLabels}>
              {labelGenerating ? "Generating label(s)…" : "Generate Label"}
            </button>
          </div>
        )}

        {/* ✅ NEW — Packing List: Step 1, One PO vs Multiple PO */}
        {plStep === "choose" && (
          <div style={{ marginTop: 12 }}>
            <button className="btn small" style={{ marginBottom: 10 }} onClick={backToDocListFromPl}>
              ← Back to document list
            </button>
            <p style={{ fontSize: 14, marginBottom: 10 }}>
              Is this Packing List for one PO or multiple POs?
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" disabled={plLoading} onClick={() => choosePlMode("single")}>
                {plLoading ? "Loading…" : "One PO"}
              </button>
              <button className="btn" disabled={plLoading} onClick={() => choosePlMode("multiple")}>
                Multiple PO
              </button>
              {/* ✅ NEW — allocate parts / quantities to each PO, one Packing List per PO */}
              <button className="btn" disabled={plLoading} onClick={startPlAllocation}>
                Allocate Parts to POs
              </button>
            </div>
          </div>
        )}

        {/* ✅ NEW — Packing List: PO-wise Part & Quantity Allocation */}
        {plStep === "allocate" && plAlloc && plHeader && plAllocResult && (() => {
          const res = plAllocResult;
          const posN = plAlloc.pos.length;
          return (
            <div style={{ marginTop: 12, maxHeight: "72vh", overflowY: "auto" }}>
              <button className="btn small" style={{ marginBottom: 10 }} onClick={() => setPlStep("choose")}>
                ← Back
              </button>
              <h4 style={{ margin: "0 0 4px" }}>Allocate Parts to POs</h4>
              <p style={{ fontSize: 12, color: "#64748B", margin: "0 0 10px" }}>
                Enter how many pieces of each part belong to each PO (a part can be split between POs). Use as many
                POs as you need (+ Add PO / ✕). All POs go into ONE Packing List (each part printed once, with its total); each part must be fully allocated.
              </p>

              {/* Quantity allocation */}
              <div style={{ overflowX: "auto", marginBottom: 8 }}>
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                  <thead>
                    <tr>
                      <th style={plTh}>Part No</th>
                      <th style={plTh}>Description</th>
                      <th style={plTh}>Total Qty</th>
                      {plAlloc.pos.map((po, j) => (
                        <th key={j} style={{ ...plTh, minWidth: 130 }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                              <input
                                type="text"
                                placeholder={`PO Number ${j + 1}`}
                                value={po.poNumber}
                                onChange={(e) => updateAllocPoField(j, "poNumber", e.target.value)}
                                style={{ ...plCellInput, width: 100, fontWeight: 600 }}
                              />
                              {posN > 1 && (
                                <button className="btn small" onClick={() => removeAllocPo(j)} title="Remove this PO">✕</button>
                              )}
                            </div>
                            <input
                              type="date"
                              title="PO Date"
                              value={po.poDate}
                              onChange={(e) => updateAllocPoField(j, "poDate", e.target.value)}
                              style={{ ...plCellInput, width: 130 }}
                            />
                          </div>
                        </th>
                      ))}
                      <th style={plTh}>Allocated</th>
                      <th style={plTh}>Remaining</th>
                      <th style={plTh}>Status</th>
                      <th style={plTh}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {plAllocParts.map((part, i) => {
                      const info = res.parts[i];
                      return (
                        <tr key={i}>
                          <td style={plTd}>{part.partNo}</td>
                          <td style={plTd}>{part.description}</td>
                          <td style={{ ...plTd, fontWeight: 600 }}>{part.qty}</td>
                          {plAlloc.pos.map((po, j) => {
                            const raw = String(po.qty[i] ?? "").trim();
                            const bad = raw !== "" && !/^\d+$/.test(raw);
                            return (
                              <td key={j} style={plTd}>
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  aria-label={`${part.partNo} quantity for PO ${j + 1}`}
                                  value={po.qty[i] ?? ""}
                                  onChange={(e) => updateAllocQty(j, i, e.target.value)}
                                  style={{ ...plCellInput, borderColor: bad ? "#B91C1C" : "#CBD5E1" }}
                                />
                              </td>
                            );
                          })}
                          <td style={plTd}>{info.allocated}</td>
                          <td style={{ ...plTd, color: info.remaining === 0 ? "#16A34A" : "#B45309", fontWeight: 600 }}>{info.remaining}</td>
                          <td style={{ ...plTd, whiteSpace: "nowrap", color: info.status === "ok" ? "#16A34A" : info.status === "under" ? "#B45309" : "#B91C1C" }}>
                            {info.status === "ok" ? "✓ Allocated" : info.status === "under" ? `⚠ ${info.remaining} unallocated` : `✗ Over by ${-info.remaining}`}
                          </td>
                          <td style={plTd}>
                            <button className="btn small" onClick={() => splitAllocPartEqually(i)} title="Split this part equally across all POs">
                              Split equally
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    <tr>
                      <td style={{ ...plTd, fontWeight: 600 }} colSpan={3}>Total pieces</td>
                      {res.perPo.map((p, j) => (
                        <td key={j} style={{ ...plTd, fontWeight: 600 }}>{p.totals.qty}</td>
                      ))}
                      <td style={{ ...plTd, fontWeight: 600 }}>{res.totals.qty} / {res.original.qty}</td>
                      <td style={plTd} colSpan={3}></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <button className="btn small" style={{ marginBottom: 14 }} onClick={addAllocPo}>+ Add PO</button>

              {/* Box allocation */}
              <div style={{ fontSize: 13, fontWeight: 600, margin: "4px 0 2px" }}>Box allocation</div>
              <p style={{ fontSize: 12, color: "#64748B", margin: "0 0 6px" }}>
                Each physical box goes to exactly one PO. Boxes are assigned automatically from the quantities; edit
                them only if you need a different split. Box weight = pieces × unit weight + the box's own tare weight.
              </p>
              <div style={{ overflowX: "auto", marginBottom: 10 }}>
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                  <thead>
                    <tr>
                      <th style={plTh}>Part No</th>
                      <th style={plTh}>Boxes in shipment</th>
                      {plAlloc.pos.map((po, j) => (
                        <th key={j} style={plTh}>{po.poNumber || `PO ${j + 1}`}</th>
                      ))}
                      <th style={plTh}>Boxes assigned</th>
                      <th style={plTh}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {plAllocParts.map((part, i) => {
                      const info = res.parts[i];
                      const confirmedRepack = plAlloc.confirmations.repackParts[i] === true;
                      return (
                        <tr key={i}>
                          <td style={plTd}>{part.partNo}</td>
                          <td style={plTd}>{info.boxesOriginal}</td>
                          {plAlloc.pos.map((po, j) => {
                            const hasQty = (Number(po.qty[i]) || 0) > 0;
                            return (
                              <td key={j} style={plTd}>
                                {hasQty ? (
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    aria-label={`${part.partNo} boxes for PO ${j + 1}`}
                                    value={info.boxesAuto ? String(info.boxes[j] ?? 0) : (po.boxes[i] ?? "")}
                                    onChange={(e) => updateAllocBox(j, i, e.target.value)}
                                    style={{ ...plCellInput, width: 56 }}
                                  />
                                ) : (
                                  <span style={{ color: "#94A3B8" }}>—</span>
                                )}
                              </td>
                            );
                          })}
                          <td style={{ ...plTd, color: info.needsRepack ? (confirmedRepack ? "#B45309" : "#B91C1C") : info.boxesTotal === info.boxesOriginal ? "#16A34A" : "#B91C1C" }}>
                            {info.boxesTotal}
                          </td>
                          <td style={plTd}>
                            {info.needsRepack && (
                              <label style={{ fontSize: 12, display: "flex", gap: 4, alignItems: "center" }}>
                                <input type="checkbox" checked={confirmedRepack} onChange={(e) => setAllocRepack(i, e.target.checked)} />
                                Repack into separate boxes
                              </label>
                            )}
                            {!info.boxesAuto && (
                              <button className="btn small" onClick={() => resetAllocBoxes(i)}>Reset to automatic</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {plAllocParts.length > 1 && (
                <label style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 12 }}>
                  <input
                    type="checkbox"
                    checked={plAlloc.confirmations.dedicatedBoxes}
                    onChange={(e) => setAllocDedicated(e.target.checked)}
                    style={{ marginTop: 2 }}
                  />
                  <span>
                    I confirm each part is packed in its own boxes (no box holds parts that belong to different POs).
                    Box contents aren't recorded per box for this shipment.
                  </span>
                </label>
              )}

              {/* PO-wise summary */}
              <div style={{ fontSize: 13, fontWeight: 600, margin: "4px 0 4px" }}>PO-wise summary</div>
              <div style={{ overflowX: "auto", marginBottom: 12 }}>
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                  <thead>
                    <tr>
                      <th style={plTh}>PO Number</th>
                      <th style={plTh}>Pieces</th>
                      <th style={plTh}>Net Wt (Kg)</th>
                      <th style={plTh}>Gross Wt (Kg)</th>
                      <th style={plTh}>Boxes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {res.perPo.map((p, j) => (
                      <tr key={j}>
                        <td style={plTd}>{p.poNumber || `PO ${j + 1}`}</td>
                        <td style={plTd}>{p.totals.qty}</td>
                        <td style={plTd}>{p.totals.net.toFixed(3)}</td>
                        <td style={plTd}>{p.totals.gross.toFixed(2)}</td>
                        <td style={plTd}>{p.totals.boxes}</td>
                      </tr>
                    ))}
                    <tr>
                      <td style={{ ...plTd, fontWeight: 600 }}>Total allocated</td>
                      <td style={{ ...plTd, fontWeight: 600 }}>{res.totals.qty}</td>
                      <td style={{ ...plTd, fontWeight: 600 }}>{res.totals.net.toFixed(3)}</td>
                      <td style={{ ...plTd, fontWeight: 600 }}>{res.totals.gross.toFixed(2)}</td>
                      <td style={{ ...plTd, fontWeight: 600 }}>{res.totals.boxes}</td>
                    </tr>
                    <tr>
                      <td style={plTd}>Original shipment</td>
                      <td style={plTd}>{res.original.qty}</td>
                      <td style={plTd}>{res.original.net.toFixed(3)}</td>
                      <td style={plTd}>{res.original.gross.toFixed(2)}</td>
                      <td style={plTd}>{res.original.boxes}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {res.parts.some((p) => p.needsRepack && plAlloc.confirmations.repackParts[p.idx] === true) && (
                <p style={{ fontSize: 12, color: "#B45309", margin: "0 0 10px" }}>
                  Repacking adds boxes, so total boxes and gross weight are higher than the original shipment (extra tare weight per added box).
                </p>
              )}

              <details style={{ marginBottom: 12 }}>
                <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                  Shipment, exporter, consignee &amp; buyer details (shared by the whole Packing List)
                </summary>
                <div style={{ marginTop: 8 }}>{renderPlHeaderSections(true)}</div>
              </details>

              {res.errors.length > 0 && (
                <div style={{
                  background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FCA5A5",
                  borderRadius: 6, padding: "8px 10px", fontSize: 13, marginBottom: 10,
                }}>
                  {res.errors.map((e, i) => <div key={i}>{e}</div>)}
                </div>
              )}

              <button
                className="btn"
                disabled={plAllocGenerating || !res.ok}
                onClick={handleGenerateAllocated}
                style={{ fontWeight: 600 }}
              >
                {plAllocGenerating ? "Generating Packing List…" : "Generate Packing List"}
              </button>
            </div>
          );
        })()}

        {/* ✅ NEW — Packing List: Step 3, editable preview (header fields +
            per-item pallet breakdown) + Generate */}
        {plStep === "edit" && plHeader && (
          <div style={{ marginTop: 12, maxHeight: "70vh", overflowY: "auto" }}>
            <button className="btn small" style={{ marginBottom: 10 }} onClick={() => setPlStep("choose")}>
              ← Back
            </button>

            <h4 style={{ margin: "0 0 8px" }}>Packing List Details</h4>

            {/* ✅ REORDERED — PO Selection + Number of Boxes/QTY section now
                comes first; the header fields, Exporter, and Consignee/Buyer
                sections that used to be above it now follow below it. No
                logic changed, only the display order of these blocks. */}

            {/* PO selection with "Number of Boxes" beside it (One PO) */}
            <div style={{ display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 12, marginBottom: 3 }}>PO Selection</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {[["single", "One PO"], ["multiple", "Multiple PO"]].map(([m, lbl]) => (
                    <button
                      key={m}
                      className="btn small"
                      onClick={() => switchPlMode(m)}
                      style={{ fontWeight: plMode === m ? 700 : 400, outline: plMode === m ? "2px solid #2563EB" : "none" }}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {plMode === "single" && plItems.length === 1 && plItems[0] && (
                <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 3 }}>
                  Number of Boxes
                  <select
                    value={plItems[0].palletCount}
                    onChange={(e) => changePlPalletCount(0, e.target.value)}
                    style={{ padding: "5px 7px", border: "1px solid #CBD5E1", borderRadius: 4, fontSize: 13 }}
                  >
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </label>
              )}

              {/* ✅ NEW — "+ Add PO Number": adds another independent PO
                  entry below, each with its own PO Number field, part
                  details, Number of Boxes dropdown and box rows. */}
              <button className="btn small" onClick={addPlPoEntry}>
                + Add PO Number
              </button>
            </div>

            {/* One block per line (One PO → 1 line for the whole shipment;
                Multiple PO → 1 line per part, each with its own dropdown). */}
            {plItems.map((item, itemIdx) => {
              const boxSum = (item.pallets || []).reduce((s, p) => s + (Number(p.qty) || 0), 0);
              // ✅ NEW — for multiple PO entries sharing one shipment
              // quantity, each entry's own box sum is only ITS share of
              // the total, not the full item.qty, so it's never compared
              // against item.qty here; the combined total across every
              // entry is validated once, collectively, below (plValidationErrors).
              const groupMembers = plGroupItems(plItems).get(plGroupKey(item, itemIdx)) || [];
              const sharedPoEntries = groupMembers.length > 1;
              const groupSum = groupMembers.reduce((s, { item: it }) => s + plBoxSum(it), 0);
              const mismatch = sharedPoEntries
                ? groupSum !== Number(item.qty)
                : boxSum !== Number(item.qty);
              return (
                <div
                  key={itemIdx}
                  style={{ border: "1px solid #E2E8F0", borderRadius: 6, padding: 10, marginBottom: 12 }}
                >
                  {/* ✅ NEW — PO Number field, at the top of this PO entry,
                      before its part details (spec: "PO number input →
                      part details → ..."). Editable; its value is what
                      gets passed into Customer PO Number on generation. */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 8, marginBottom: 8 }}>
                    <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 3, flex: 1, maxWidth: 260 }}>
                      PO Number
                      <input
                        type="text"
                        placeholder={`PO Number ${itemIdx + 1}`}
                        value={item.poNumber || ""}
                        onChange={(e) => updatePlItemPoNumber(itemIdx, e.target.value)}
                        style={{ padding: "5px 7px", border: "1px solid #CBD5E1", borderRadius: 4, fontSize: 13, fontWeight: 600 }}
                      />
                    </label>
                    {plItems.length > 1 && (
                      <button className="btn small" onClick={() => removePlItem(itemIdx)}>✕ Remove</button>
                    )}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {plMode === "multiple" ? `PO ${itemIdx + 1} — ` : ""}{item.description || item.partNo || "Shipment"}
                      </div>
                      <div style={{ fontSize: 12, color: "#64748B" }}>
                        Total shipment quantity: <strong>{item.qty}</strong> {item.unit}
                      </div>
                    </div>

                    {(plMode === "multiple" || plItems.length > 1) && (
                      <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 3 }}>
                        Number of Boxes
                        <select
                          value={item.palletCount}
                          onChange={(e) => changePlPalletCount(itemIdx, e.target.value)}
                          style={{ padding: "5px 7px", border: "1px solid #CBD5E1", borderRadius: 4, fontSize: 13 }}
                        >
                          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>

                  <div style={{ fontSize: 13, fontWeight: 600, margin: "6px 0 4px" }}>QTY</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {(item.pallets || []).map((pallet, palletIdx) => (
                      <div
                        key={palletIdx}
                        style={{ display: "grid", gridTemplateColumns: "70px 90px 1fr 100px", gap: 6, alignItems: "center" }}
                      >
                        <div style={{ fontSize: 12, color: "#64748B" }}>
                          {/* ✅ NEW — global numbering: Box X (X/Total) across all POs */}
                          Box {plBoxGlobalOffsets[itemIdx] + palletIdx + 1} <span style={{ opacity: 0.7 }}>({plBoxGlobalOffsets[itemIdx] + palletIdx + 1}/{plBoxGlobalTotal})</span>
                        </div>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          aria-label={`Box ${palletIdx + 1} QTY`}
                          value={pallet.qty}
                          onChange={(e) => updatePlPalletField(itemIdx, palletIdx, "qty", e.target.value)}
                          style={{ padding: "5px 7px", border: "1px solid #CBD5E1", borderRadius: 4, fontSize: 13 }}
                        />
                        <input
                          type="text"
                          placeholder="Dimensions L x W x H"
                          value={pallet.dimensions}
                          onChange={(e) => updatePlPalletField(itemIdx, palletIdx, "dimensions", e.target.value)}
                          style={{ padding: "5px 7px", border: "1px solid #CBD5E1", borderRadius: 4, fontSize: 13 }}
                        />
                        <input
                          type="number"
                          placeholder="Gross Wt (Kg)"
                          value={pallet.grossWt}
                          onChange={(e) => updatePlPalletField(itemIdx, palletIdx, "grossWt", e.target.value)}
                          style={{ padding: "5px 7px", border: "1px solid #CBD5E1", borderRadius: 4, fontSize: 13 }}
                        />
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                    <div style={{ fontSize: 12, color: mismatch ? "#B91C1C" : "#16A34A" }}>
                      Box quantities total {boxSum}{sharedPoEntries ? ` (all POs combined: ${groupSum} / ${item.qty})` : ` / ${item.qty}`} {mismatch ? "— must equal the shipment quantity" : "✓"}
                    </div>
                    <button
                      className="btn small"
                      onClick={() => changePlPalletCount(itemIdx, item.palletCount)}
                    >
                      Split equally
                    </button>
                  </div>
                </div>
              );
            })}

            {renderPlHeaderSections()}

            {plValidationErrors.length > 0 && (
              <div style={{
                background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FCA5A5",
                borderRadius: 6, padding: "8px 10px", fontSize: 13, marginBottom: 10,
              }}>
                {plValidationErrors.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            )}

            <button
              className="btn"
              disabled={plGenerating || plValidationErrors.length > 0}
              onClick={handleGeneratePackingList}
              style={{ fontWeight: 600 }}
            >
              {plGenerating ? "Generating Packing List…" : "Generate Packing List"}
            </button>
          </div>
        )}

        {selectedType && (
          <div style={{ marginTop: 12 }}>
            <button
              className="btn small"
              style={{ marginBottom: 10 }}
              onClick={() => { setSelectedType(null); setPreview(null); }}
            >
              ← Back to document list
            </button>

            {loadingPreview && <div>Loading preview…</div>}

            {!loadingPreview && preview && (
              <>
                <h4 style={{ marginBottom: 6 }}>{preview.label}</h4>

                {preview.missing && preview.missing.length > 0 && (
                  <div style={{
                    background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FCA5A5",
                    borderRadius: 6, padding: "8px 10px", fontSize: 13, marginBottom: 10,
                  }}>
                    {preview.missing.map((m, i) => <div key={i}>{m}</div>)}
                  </div>
                )}

                <div style={{ fontSize: 13, color: "#334155", marginBottom: 10 }}>
                  <div><strong>Invoice No.:</strong> {preview.invoice_no || "—"}</div>
                  <div><strong>Invoice Date:</strong> {preview.invoice_date || "—"}</div>
                  {selectedType === "cargo_security_declaration" && (
                    <div><strong>Mode:</strong> {preview.mode || "—"}</div>
                  )}
                </div>

                {preview.editableFields.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                    {preview.editableFields.map((field) => (
                      <label key={field} style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 3 }}>
                        {FIELD_LABELS[field] || field}
                        <input
                          type="text"
                          value={editValues[field] ?? ""}
                          onChange={(e) => setEditValues((p) => ({ ...p, [field]: e.target.value }))}
                          style={{ padding: "6px 8px", border: "1px solid #CBD5E1", borderRadius: 4 }}
                        />
                      </label>
                    ))}
                  </div>
                )}

                <button
                  className="btn"
                  disabled={generating || (preview.missing && preview.missing.length > 0)}
                  onClick={handleGenerate}
                >
                  {generating ? "Generating PDF…" : "Generate & Download"}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
//   • EVD, End Use Letter, SCOMET, Cargo Security Declaration → clicking the
//     name generates & downloads the PDF directly. No verification/preview
//     page. Editable fields (Part Description, End User, HAWB, MAWB) fall
//     back to their existing shipment-derived defaults since there's no
//     longer a step to edit them before download.
//   • Authority Letter → unchanged: clicking the name still opens the
//     preview page (Invoice No./Date) with its own "Generate & Download"
//     button, per explicit instruction to keep that step for this one
//     document only. Its download is now a PDF as well.
// Still talks only to the existing /shipment/:id/document-types,
// /generate-document/:docType/preview and /generate-document/:docType
// endpoints — no existing shipment API call is touched.
// ─────────────────────────────────────────────────────────────────────────

const FIELD_LABELS = {
  part_desc: "Part Description",
  end_user: "End User / Customer",
  sector: "Sector",
  hawb: "HAWB #",
  mawb: "MAWB #",
};

// ✅ NEW — doc types that keep the verification/preview page. Everything
// else skips straight to generate + PDF download on click.
const KEEP_PREVIEW_FOR = new Set([]);

// ✅ NEW — fixed PDF filenames (mirrors backend PDF_FILENAMES)
const PDF_FILENAMES = {
  evd: "EVD.pdf",
  end_use_letter: "End_Use_Letter.pdf",
  scomet: "SCOMET_Declaration.pdf",
  authority_letter: "Authority_Letter.pdf",
  cargo_security_declaration: "Cargo_Security_Declaration.pdf",
  // ✅ NEW — Technologies
  tech_end_use_letter: "End_Use_Letter.pdf",
  tech_scomet: "SCOMET_Declaration.pdf",
  tech_authority_letter: "Authority_Letter.pdf",
  tech_cargo_security_declaration: "Cargo_Security_Declaration.pdf",
};

// ✅ NEW — shared error decoder (unchanged logic, pulled out so both the
// direct-download path and the existing preview path can use it)
// ✅ NEW — Packing List pallet distribution, mirrored exactly from
// utils/packingListGenerator.js (distributeQuantity/distributeWeight) so
// the live preview the user edits matches what the backend will compute
// if they don't touch a value. Pure, no API call — used when the "Number
// of Pallets" dropdown changes.
function plDistributeQuantity(totalQty, palletCount) {
  const n = Math.max(1, Number(palletCount) || 1);
  const total = Number(totalQty) || 0;
  const base = Math.floor(total / n);
  const remainder = total - base * n;
  const result = [];
  for (let i = 0; i < n; i++) result.push(base + (i < remainder ? 1 : 0));
  return result;
}
function plRound2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }
function plDistributeWeight(totalWeight, palletCount) {
  const n = Math.max(1, Number(palletCount) || 1);
  const total = Number(totalWeight) || 0;
  const base = plRound2(total / n);
  const result = new Array(n).fill(base);
  const sum = plRound2(base * n);
  const diff = plRound2(total - sum);
  if (diff !== 0) result[n - 1] = plRound2(result[n - 1] + diff);
  return result;
}
function plBuildPallets(qty, grossWt, dimensions, palletCount) {
  const qtys = plDistributeQuantity(qty, palletCount);
  const weights = plDistributeWeight(grossWt, palletCount);
  return qtys.map((q, i) => ({ qty: q, dimensions: dimensions || "", grossWt: weights[i] }));
}

// ✅ Fixed Packing List address defaults. Pre-filled every time, but every
// field stays editable in the details form before generating.
const PL_DEFAULT_EXPORTERS = {
  consulting: {
    name: "Blue Ocean Consulting",
    lines: [
      "One HQ, 3rd Floor, Office No.301, Sr No.44 Part &",
      "45 Part,Baner Balewadi Road, Balewadi, Pune",
      "411045, Maharashtra (State Code - 27), INDIA",
      "TEL: +91 9753210294",
    ],
  },
  technologies: {
    name: "Blue Ocean Technologies",
    lines: [
      "C-601, 24K Opula, Pimple Nilakh,",
      "Pune – 411027, Maharashtra, INDIA",
      "TEL: +91 9753210294",
    ],
  },
};
const PL_DEFAULT_CONSIGNEE = {
  companyName: "FECON LLC",
  lines: ["3460 Grant Drive,", "Lebanon, Ohio, 45036"],
  attn: "Roman Bunce",
  phone: "+1 513-696-4430",
  email: "rbunce@fecon.com",
};
const PL_DEFAULT_BUYER = {
  companyName: "FECON LLC",
  lines: ["3460 Grant Drive,", "Lebanon, Ohio, 45036"],
  attn: "Roman Bunce",
  phone: "+1 513-696-4430",
  email: "",
};

async function reportGenerateError(err) {
  if (err.response?.data instanceof Blob) {
    try {
      const text = await err.response.data.text();
      const parsed = JSON.parse(text);
      toast.error(parsed.message || "Failed to generate document");
    } catch {
      toast.error("Failed to generate document");
    }
  } else {
    toast.error(err.response?.data?.message || "Failed to generate document");
  }
}

export default function GenerateDocumentModal({ shipment, onClose }) {
  const [category, setCategory] = useState(null); // ✅ NEW — null | "consulting" | "technologies"
  const [docTypes, setDocTypes] = useState([]);
  const [selectedType, setSelectedType] = useState(null);
  const [preview, setPreview] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [loadingList, setLoadingList] = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [directGeneratingType, setDirectGeneratingType] = useState(null); // ✅ NEW
  const [downloadingAll, setDownloadingAll] = useState(false); // ✅ NEW

  // ✅ NEW — Label Document (6th option). Fully isolated state; nothing
  // above this touches or reads these.
  const [labelStep, setLabelStep] = useState(null); // null | "choose" | "form"
  const [labelMode, setLabelMode] = useState(null); // "single" | "multiple"
  const [poInputs, setPoInputs] = useState([""]);
  const [qtyInputs, setQtyInputs] = useState([""]); // ✅ NEW — quantity per PO (parallel to poInputs)
  const [labelGenerating, setLabelGenerating] = useState(false);
  // ✅ NEW — what was typed in the Packing List (PO Number, quantity, number
  // of boxes per PO). It is kept even after leaving the Packing List screens
  // and is used to pre-fill the Label Document's PO / Quantity fields and to
  // number its boxes. Empty until a Packing List PO Number has been entered.
  const [plLabelSeed, setPlLabelSeed] = useState([]); // [{ poNumber, qty (string), boxes (number) }]

  // ✅ NEW — Packing List (7th option). Fully isolated state; nothing above
  // this touches or reads these, and this never touches the Label/other
  // document state either.
  const [plStep, setPlStep] = useState(null); // null | "choose" | "form" | "edit"
  const [plMode, setPlMode] = useState(null); // "single" | "multiple"
  const [plLoading, setPlLoading] = useState(false);
  const [plShipment, setPlShipment] = useState(null); // full shipment record (existing GET /shipment/:id)
  const [plItems, setPlItems] = useState([]); // [{ ...lookup fields, palletCount, pallets:[{qty,dimensions,grossWt}] }]
  const [plHeader, setPlHeader] = useState(null); // header fields + consignee/buyer, seeded from lookup
  const [plGenerating, setPlGenerating] = useState(false);
  // ✅ NEW — PO-wise Part & Quantity Allocation (separate step "allocate").
  // { pos: [{ poNumber, poDate, packingListNo, qty:[per part], boxes:[per part | null=auto] }],
  //   confirmations: { repackParts: {[partIdx]: bool}, dedicatedBoxes: bool } }
  const [plAlloc, setPlAlloc] = useState(null);
  const [plAllocGenerating, setPlAllocGenerating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    API.get(`/shipment/${shipment._id}/document-types`)
      .then((res) => { if (!cancelled) setDocTypes(res.data || []); })
      .catch(() => { if (!cancelled) toast.error("Failed to load document types"); })
      .finally(() => { if (!cancelled) setLoadingList(false); });
    return () => { cancelled = true; };
  }, [shipment._id]);

  const selectDocType = (docType) => {
    setSelectedType(docType);
    setPreview(null);
    setLoadingPreview(true);
    API.get(`/shipment/${shipment._id}/generate-document/${docType}/preview`)
      .then((res) => {
        setPreview(res.data);
        setEditValues(res.data.editable || {});
      })
      .catch(() => toast.error("Failed to load document preview"))
      .finally(() => setLoadingPreview(false));
  };

  const downloadPdfBlob = (blobData, docType, label) => {
    const blob = new Blob([blobData], { type: "application/pdf" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = PDF_FILENAMES[docType] || `${label || "document"}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    toast.success("Document generated ✅");
  };

  // Existing flow — used only for Authority Letter now (still has its
  // preview page + "Generate & Download" button). Same endpoint, same
  // editable-field submission; only the response is now PDF.
  const handleGenerate = async () => {
    if (!selectedType) return;
    try {
      setGenerating(true);
      const res = await API.post(
        `/shipment/${shipment._id}/generate-document/${selectedType}?format=pdf`,
        { editableFields: editValues },
        { responseType: "blob" }
      );
      downloadPdfBlob(res.data, selectedType, preview?.label);
    } catch (err) {
      await reportGenerateError(err);
    } finally {
      setGenerating(false);
    }
  };

  // ✅ NEW — direct generate + download, no preview step. Used for every
  // doc type except the ones in KEEP_PREVIEW_FOR. Editable fields are not
  // collected here, so the backend falls back to its existing
  // shipment-derived defaults for them (same defaults the preview page
  // used to pre-fill).
  const handleDirectGenerate = async (docType, label) => {
    try {
      setDirectGeneratingType(docType);
      const res = await API.post(
        `/shipment/${shipment._id}/generate-document/${docType}?format=pdf`,
        { editableFields: {} },
        { responseType: "blob" }
      );
      downloadPdfBlob(res.data, docType, label);
    } catch (err) {
      await reportGenerateError(err);
    } finally {
      setDirectGeneratingType(null);
    }
  };

  const handleDocTypeClick = (docType, label) => {
    if (KEEP_PREVIEW_FOR.has(docType)) {
      selectDocType(docType);
    } else {
      handleDirectGenerate(docType, label);
    }
  };

  // ✅ NEW — generate all 5 documents as PDFs and download them bundled into
  // a single ZIP. Reuses the same generate-document pipeline server-side;
  // this just calls the new /generate-all-documents endpoint.
  const handleDownloadAll = async () => {
    try {
      setDownloadingAll(true);
      const res = await API.post(
        `/shipment/${shipment._id}/generate-all-documents?category=${category}`, // ✅ CHANGED
        {},
        { responseType: "blob" }
      );
      const skippedHeader = res.headers?.["x-skipped-documents"];
      if (skippedHeader) {
        toast.warn(`Some documents were skipped: ${decodeURIComponent(skippedHeader)}`);
      }
      const blob = new Blob([res.data], { type: "application/zip" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Documents_${shipment.enquiry_no || shipment._id}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("All documents generated ✅");
    } catch (err) {
      await reportGenerateError(err);
    } finally {
      setDownloadingAll(false);
    }
  };

  // ✅ NEW — Label Document handlers. Isolated from every handler above;
  // none of the existing 5-document logic is called or modified here.
  const startLabelFlow = () => {
    setLabelStep("choose");
    setLabelMode(null);
    setPoInputs([""]);
    setQtyInputs([""]); // ✅ NEW
  };

  const chooseLabelMode = (mode) => {
    // ✅ NEW — if PO Numbers were typed in the Packing List, start the Label
    // form with those PO Numbers and quantities (several POs → the
    // multiple-PO form, so none of them is left out). Otherwise unchanged.
    const seed = plLabelSeed;
    const effectiveMode = seed.length > 1 ? "multiple" : mode;
    setLabelMode(effectiveMode);
    if (seed.length > 0) {
      const rows = effectiveMode === "single" ? seed.slice(0, 1) : seed;
      setPoInputs(rows.map((r) => r.poNumber));
      setQtyInputs(rows.map((r) => r.qty));
    } else {
      setPoInputs([""]);
      setQtyInputs([""]); // ✅ NEW
    }
    setLabelStep("form");
  };

  const updatePoInput = (idx, value) => {
    setPoInputs((prev) => prev.map((v, i) => (i === idx ? value : v)));
  };

  // ✅ NEW — quantity for the PO at the same index
  const updateQtyInput = (idx, value) => {
    setQtyInputs((prev) => prev.map((v, i) => (i === idx ? value : v)));
  };

  const addPoInput = () => {
    setPoInputs((prev) => [...prev, ""]);
    setQtyInputs((prev) => [...prev, ""]); // ✅ NEW
  };
  const removePoInput = (idx) => {
    setPoInputs((prev) => prev.filter((_, i) => i !== idx));
    setQtyInputs((prev) => prev.filter((_, i) => i !== idx)); // ✅ NEW
  };

  const backToDocList = () => {
    setLabelStep(null);
    setLabelMode(null);
    setPoInputs([""]);
    setQtyInputs([""]); // ✅ NEW
  };

  const handleGenerateLabels = async () => {
    const poNumbers = poInputs.map((p) => p.trim()).filter(Boolean);
    if (poNumbers.length === 0) {
      toast.error("Enter at least one PO Number");
      return;
    }
    // ✅ NEW — quantities aligned 1:1 with poNumbers (same empty-PO filter, so no mismatch)
    const poQuantities = poInputs
      .map((p, i) => ({ po: p.trim(), qty: (qtyInputs[i] || "").trim() }))
      .filter((x) => x.po)
      .map((x) => x.qty);
    // ✅ NEW — number of boxes per PO as entered in the Packing List, aligned
    // 1:1 with poNumbers. Only sent when EVERY PO here was entered in the
    // Packing List; otherwise omitted and the label numbers its boxes the
    // way it always did.
    const boxCounts = poNumbers.map((po) => {
      const hit = plLabelSeed.find((r) => r.poNumber.trim().toLowerCase() === po.toLowerCase());
      return hit ? Number(hit.boxes) : null;
    });
    const poBoxes = boxCounts.every((n) => Number.isInteger(n) && n >= 0) ? boxCounts : undefined;
    try {
      setLabelGenerating(true);
      const res = await API.post(
        `/shipment/${shipment._id}/generate-label`,
        { poNumbers, poQuantities, poBoxes, category }, // ✅ CHANGED — poQuantities, poBoxes added
        { responseType: "blob" }
      );
      const contentType = res.headers?.["content-type"] || "";
      const isZip = contentType.includes("zip");
      const blob = new Blob([res.data], { type: isZip ? "application/zip" : "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = isZip ? `Labels_${Date.now()}.zip` : `Label_${poNumbers[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      const skippedHeader = res.headers?.["x-skipped-pos"];
      if (skippedHeader) {
        toast.warn(`Some PO Numbers were skipped: ${decodeURIComponent(skippedHeader)}`);
      }
      toast.success("Label document generated ✅");
    } catch (err) {
      // ✅ NEW — Label-specific error handling: surfaces the *actual* reason
      // (from the backend's `details` array — e.g. "PO Number not found.")
      // instead of just the generic top-level message, since that's the
      // whole point of this toast for debugging a specific PO.
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          const details = Array.isArray(parsed.details) ? parsed.details.join(" | ") : "";
          toast.error(details || parsed.message || "Failed to generate label");
        } catch {
          toast.error("Failed to generate label");
        }
      } else {
        const details = Array.isArray(err.response?.data?.details) ? err.response.data.details.join(" | ") : "";
        toast.error(details || err.response?.data?.message || "Failed to generate label");
      }
    } finally {
      setLabelGenerating(false);
    }
  };

  // ✅ NEW — Packing List handlers. Fully isolated from every handler above;
  // none of the existing 5-document or Label logic is called or modified
  // here, and no existing shipment API call is touched.

  // Mirrors utils/packingListGenerator.js's distributeQuantity/distributeWeight
  // exactly, so the client-side preview always matches what the backend will
  // actually print — the backend re-validates/re-derives anyway, this is
  // purely so the editable sections look right as soon as the dropdown
  // changes, before the user hits Generate.
  const plDistributeQty = (total, n) => {
    const count = Math.max(1, Number(n) || 1);
    const t = Number(total) || 0;
    const base = Math.floor(t / count);
    const remainder = t - base * count;
    return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
  };
  const plDistributeWeight = (total, n) => {
    const count = Math.max(1, Number(n) || 1);
    const t = Number(total) || 0;
    const base = Math.round((t / count) * 100) / 100;
    const arr = new Array(count).fill(base);
    const diff = Math.round((t - base * count) * 100) / 100;
    if (diff !== 0) arr[count - 1] = Math.round((arr[count - 1] + diff) * 100) / 100;
    return arr;
  };

  const startPackingListFlow = () => {
    setPlAlloc(null);
    setPlStep("choose");
    setPlMode(null);
    setPlShipment(null);
    setPlItems([]);
    setPlHeader(null);
  };

  const backToDocListFromPl = () => {
    setPlAlloc(null);
    setPlStep(null);
    setPlMode(null);
    setPlShipment(null);
    setPlItems([]);
    setPlHeader(null);
  };

  // Equal split of a gross weight across boxes in proportion to each box's
  // quantity (so an uneven 4/3/3 split gets 40%/30%/30% of the weight, not
  // three identical figures). Remainder from 2-dp rounding goes to the last
  // box so the weights always add up to the line total exactly.
  const plProportionalWeights = (qtys, totalWeight) => {
    const totalQty = qtys.reduce((s, q) => s + q, 0);
    const t = Number(totalWeight) || 0;
    if (totalQty <= 0) return plDistributeWeight(t, qtys.length);
    const w = qtys.map((q) => Math.round(((t * q) / totalQty) * 100) / 100);
    const diff = Math.round((t - w.reduce((s, x) => s + x, 0)) * 100) / 100;
    if (diff !== 0) w[w.length - 1] = Math.round((w[w.length - 1] + diff) * 100) / 100;
    return w;
  };

  // Builds the box rows for one line: total qty split equally (whole
  // numbers, first boxes take the remainder — 10 over 3 boxes → 4/3/3).
  const plBuildBoxes = (qty, grossWt, dimensions, n) => {
    const qtys = plDistributeQty(qty, n);
    const weights = plProportionalWeights(qtys, grossWt);
    return qtys.map((q, i) => ({ qty: q, dimensions: dimensions || "", grossWt: weights[i] }));
  };

  // ✅ NEW — Multiple PO Numbers ("+ Add PO Number") all clone the SAME
  // shipment total (addPlPoEntry sets every new entry's qty to the first
  // entry's qty), so they're identified here by sharing that same qty —
  // this is exactly the "+ Add PO Number" case and does NOT match the
  // separate "Multiple PO" top-level mode's one-line-per-part lines,
  // which normally each have a different part quantity and are left
  // completely untouched by everything below.
  // Lines that split ONE item across several PO entries share a
  // `splitGroup` id (assigned in addPlPoEntry). Only lines in the same
  // group are pooled; every other line stands alone, so different items /
  // unrelated POs are never combined. Mirrors the grouping in
  // generatePackingList (shipment.controller.js).
  const plGroupKey = (item, idx) => (item.splitGroup ? `group:${item.splitGroup}` : `line:${idx}`);
  const plGroupItems = (items) => {
    const groups = new Map(); // key -> [{ item, idx }]
    (items || []).forEach((item, idx) => {
      const key = plGroupKey(item, idx);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ item, idx });
    });
    return groups;
  };
  const plBoxSum = (item) => (item.pallets || []).reduce((s, p) => s + (Number(p.qty) || 0), 0);

  // ✅ NEW — recalculates every PO entry's box quantities (and
  // proportional weights) from the COMBINED box count across ALL PO
  // entries, instead of each entry's own box count independently —
  // e.g. 400 total / (PO1: 1 box + PO2: 1 box) = 200 per box, or
  // 400 total / (PO1: 1 box + PO2: 3 boxes) = 100 per box. Only called
  // from the explicit recalculation points below (box-count change,
  // add/remove PO, "Split equally") — never from a manual per-box edit,
  // so typed values keep sticking exactly as before in between.
  const redistributePlBoxesAcrossPOs = (items) => {
    const result = [...items];
    plGroupItems(items).forEach((members) => {
      if (members.length < 2) return;
      const first = members[0].item;
      const totalQty = Number(first.qty) || 0;
      const totalGrossWt = Number(first.grossWt) || 0;
      const boxCounts = members.map(({ item }) => (item.pallets || []).length || 1);
      const totalBoxes = boxCounts.reduce((s, n) => s + n, 0);
      if (totalBoxes <= 0) return;
      const flatQtys = plDistributeQty(totalQty, totalBoxes);
      const flatWeights = plProportionalWeights(flatQtys, totalGrossWt);
      let cursor = 0;
      members.forEach(({ item, idx }, m) => {
        const n = boxCounts[m];
        const qtys = flatQtys.slice(cursor, cursor + n);
        const weights = flatWeights.slice(cursor, cursor + n);
        cursor += n;
        result[idx] = {
          ...item,
          pallets: (item.pallets || []).map((p, i) => ({ ...p, qty: qtys[i], grossWt: weights[i] })),
        };
      });
    });
    return result;
  };

  // Turns the shipment's own parts (already stored on the Shipment List
  // record — no PO search, no new lookup) into Packing List lines.
  //   • single   → ONE line for the whole shipment, quantity = total
  //                shipment quantity.
  //   • multiple → one line per part, each with its own box split.
  const buildPlItems = (full, mode) => {
    const parts = Array.isArray(full.parts) ? full.parts : [];
    const toLine = (subset, fallbackDesc) => {
      const qty = subset.reduce((s, p) => s + (Number(p.quantity) || 0), 0);
      const netWt = subset.reduce(
        (s, p) => s + (Number(p.quantity) || 0) * (Number(p.net_wt_per_unit) || 0), 0);
      const grossWt = subset.reduce((s, p) => s + (Number(p.gross_wt) || 0), 0);
      const dimensions = subset.find((p) => p.box_size)?.box_size || "";
      return {
        poNumber: "",
        partNo: subset.map((p) => p.part_no).filter(Boolean).join(", "),
        description: subset.map((p) => p.part_desc || p.part_no).filter(Boolean).join(", ") || fallbackDesc,
        hsnCode: subset.find((p) => p.hsn_code)?.hsn_code || "",
        qty,
        unit: "pcs",
        netWt,
        grossWt,
        dimensions,
        palletCount: 1,
        pallets: plBuildBoxes(qty, grossWt, dimensions, 1),
      };
    };

    if (parts.length === 0) {
      // Shipment has no parts array — fall back to its stored totals.
      const qty = Number(full.total_parts_count ?? full.total_qty) || 0;
      if (qty <= 0) return [];
      const grossWt = Number(full.total_gross_weight ?? full.total_gross_wt) || 0;
      return [{
        poNumber: "", partNo: "", description: full.manual_desc || "", hsnCode: "",
        qty, unit: "pcs",
        netWt: Number(full.total_net_weight ?? full.total_net_wt) || 0,
        grossWt, dimensions: "", palletCount: 1,
        pallets: plBuildBoxes(qty, grossWt, "", 1),
      }];
    }

    const lines = mode === "single" ? [toLine(parts, "")] : parts.map((p) => toLine([p], ""));
    return lines.filter((l) => l.qty > 0);
  };

  // Shared by the existing One/Multiple PO flow and the new allocation flow.
  const buildPlHeaderFor = (full) => (
{
    category,
    packingListNo: full.invoice_no || "",
    packingListDate: new Date().toISOString().slice(0, 10),
    customerPoNumber: "",
    customerPoDate: "",
    pol: full.pol || "",
    portOfDischarge: full.port_of_discharge || "",
    finalDestination: full.final_destination || "",
    carrierBy: full.mode ? `By ${full.mode}` : "",
    containerNo: full.container_no || "",
    invoiceNo: full.invoice_no || "",
    invoiceDate: full.invoice_date || "",
    exporter: {
      name: (PL_DEFAULT_EXPORTERS[category] || PL_DEFAULT_EXPORTERS.consulting).name,
      lines: [...(PL_DEFAULT_EXPORTERS[category] || PL_DEFAULT_EXPORTERS.consulting).lines],
    },
    consignee: { ...PL_DEFAULT_CONSIGNEE, lines: [...PL_DEFAULT_CONSIGNEE.lines] },
    buyer: { ...PL_DEFAULT_BUYER, lines: [...PL_DEFAULT_BUYER.lines] },
  }
  );

  // Clicking One PO / Multiple PO. Reuses the existing shipment record
  // (GET /shipment/:id) and the existing Customer Address Book endpoint —
  // no PO number entry and no new search.
  const choosePlMode = async (mode) => {
    try {
      setPlLoading(true);
      const res = await API.get(`/shipment/${shipment._id}`);
      const full = res.data || shipment;

      const items = buildPlItems(full, mode);
      if (items.length === 0) {
        toast.error("This shipment has no quantity recorded, so boxes can't be split.");
        return;
      }

      setPlShipment(full);
      setPlMode(mode);
      setPlItems(items);
      setPlHeader(buildPlHeaderFor(full));
      setPlStep("edit");
    } catch (err) {
      await reportGenerateError(err);
    } finally {
      setPlLoading(false);
    }
  };

  // Switch One PO ↔ Multiple PO from inside the edit screen. Rebuilds the
  // lines from the same already-fetched shipment (no API call); header
  // edits are kept, box edits restart because the line structure changed.
  const switchPlMode = (mode) => {
    if (!plShipment || mode === plMode) return;
    const items = buildPlItems(plShipment, mode);
    if (items.length === 0) return;
    setPlMode(mode);
    setPlItems(items);
  };

  // "Number of Boxes" (1–10) changed for a line: regenerate exactly that
  // many QTY fields, auto-filled with an equal whole-number split. Changing
  // the count necessarily reshapes the fields, so earlier manual values for
  // THAT line are replaced; manual edits are otherwise always preserved.
  const changePlPalletCount = (itemIdx, newCount) => {
    setPlItems((prev) => {
      const next = prev.map((item, i) => {
        if (i !== itemIdx) return item;
        const n = Math.min(10, Math.max(1, Number(newCount) || 1));
        return {
          ...item,
          palletCount: n,
          pallets: plBuildBoxes(item.qty, item.grossWt, item.dimensions, n),
        };
      });
      // ✅ NEW — multiple PO entries sharing one shipment quantity:
      // recompute every entry's box quantities from the combined box
      // count across all of them (also covers the "Split equally" button,
      // which calls this same function with the line's current count).
      return redistributePlBoxesAcrossPOs(next);
    });
  };

  // Typing in a QTY (or dimensions / gross weight) field only touches that
  // one field — nothing else is re-distributed, so manual edits stick.
  const updatePlPalletField = (itemIdx, palletIdx, field, value) => {
    setPlItems((prev) =>
      prev.map((item, i) => {
        if (i !== itemIdx) return item;
        const pallets = item.pallets.map((p, pi) =>
          pi === palletIdx ? { ...p, [field]: value } : p
        );
        return { ...item, pallets };
      })
    );
  };

  // ✅ NEW — per-item PO Number (the field the Packing List Details section
  // was missing). Only touches the one item's poNumber; every other field
  // on that item, and every other item, is untouched.
  const updatePlItemPoNumber = (itemIdx, value) => {
    setPlItems((prev) =>
      prev.map((item, i) => (i === itemIdx ? { ...item, poNumber: value } : item))
    );
  };

  // ✅ NEW — "+ Add PO Number": appends a new, independent PO entry below
  // the existing ones. Reuses the already-fetched shipment's part/quantity
  // details (same totals as the first entry — no new shipment lookup) so
  // the new entry starts from real data, with its own blank PO Number and
  // its own default 1-box split; existing entries (PO number, box edits)
  // are untouched.
  const addPlPoEntry = () => {
    setPlItems((prev) => {
      const base = prev[0] || { qty: 0, grossWt: 0, netWt: 0, dimensions: "", description: "", partNo: "", unit: "pcs" };
      // Tag the cloned line and its source as one split group so their
      // boxes are validated together against the item's total quantity.
      const splitGroup = base.splitGroup || `sg_${Date.now()}`;
      const newItem = {
        splitGroup,
        poNumber: "",
        partNo: base.partNo,
        description: base.description,
        hsnCode: base.hsnCode,
        qty: base.qty,
        unit: base.unit || "pcs",
        netWt: base.netWt,
        grossWt: base.grossWt,
        dimensions: base.dimensions,
        palletCount: 1,
        pallets: plBuildBoxes(base.qty, base.grossWt, base.dimensions, 1),
      };
      // ✅ NEW — the new entry shares the first entry's total shipment
      // quantity, so recompute every entry's boxes from the now-combined
      // box count across all PO entries.
      return redistributePlBoxesAcrossPOs([
        ...prev.map((it, i) => (i === 0 && !it.splitGroup ? { ...it, splitGroup } : it)),
        newItem,
      ]);
    });
  };

  // ✅ NEW — removes one manually-added PO entry (never drops below 1).
  // If the remaining entries still share one shipment quantity, their box
  // split is recombined over the smaller total box count; if only one PO
  // entry is left, it goes back to representing the FULL shipment
  // quantity across its own boxes — the same as the original One PO
  // behavior — since there's no other PO left to split with.
  const removePlItem = (itemIdx) => {
    setPlItems((prev) => {
      if (prev.length <= 1) return prev;
      const removed = prev[itemIdx];
      const next = prev.filter((_, i) => i !== itemIdx);
      if (!removed.splitGroup) return next;
      const remaining = next.filter((it) => it.splitGroup === removed.splitGroup);
      if (remaining.length === 1) {
        // Only one line of that item left — it goes back to the FULL
        // quantity across its own boxes and stops being a split group.
        return next.map((it) => {
          if (it.splitGroup !== removed.splitGroup) return it;
          const { splitGroup, ...only } = it;
          return { ...only, pallets: plBuildBoxes(only.qty, only.grossWt, only.dimensions, only.palletCount) };
        });
      }
      return redistributePlBoxesAcrossPOs(next);
    });
  };

  const updatePlHeaderField = (field, value) => {
    setPlHeader((prev) => ({ ...prev, [field]: value }));
  };
  const updatePlConsigneeField = (block, field, value) => {
    setPlHeader((prev) => ({ ...prev, [block]: { ...prev[block], [field]: value } }));
  };

  // Validation: every box QTY must be a whole number ≥ 0, and the boxes
  // must add up exactly to the item's quantity. A line on its own is
  // checked against its own quantity; lines that split one item (same
  // splitGroup) are checked COLLECTIVELY — their combined boxes must equal
  // the item's total — never each line against the full quantity.
  // Keep in sync with generatePackingList (shipment.controller.js).
  const plValidationErrors = (() => {
    const errs = [];
    plGroupItems(plItems).forEach((members) => {
      let badInput = false;
      members.forEach(({ item, idx }) => {
        const label = item.poNumber ? `PO ${item.poNumber}` : item.description || `Line ${idx + 1}`;
        const raw = (item.pallets || []).map((p) => String(p.qty ?? "").trim());
        const badIdx = raw.findIndex((v) => v === "" || !/^\d+$/.test(v));
        if (badIdx !== -1) {
          errs.push(`${label}: Box ${badIdx + 1} QTY must be a whole number (0 or more).`);
          badInput = true;
        }
      });
      if (badInput) return;
      const expected = Number(members[0].item.qty) || 0;
      const actual = members.reduce((s, { item }) => s + plBoxSum(item), 0);
      if (actual !== expected) {
        const name = members[0].item.description || `Line ${members[0].idx + 1}`;
        errs.push(
          members.length > 1
            ? `${name}: combined box quantities across all PO Numbers total ${actual}, but the expected item quantity is ${expected}.`
            : `${name}: box quantities total ${actual}, but the shipment quantity is ${expected}.`
        );
      }
    });
    return errs;
  })();

  // ✅ NEW — running box count across ALL PO entries (not reset per PO), so
  // the "Box N" numbering below reads 1, 2, 3… straight through every PO
  // Number instead of restarting at 1 for each one — e.g. PO1's one box
  // shows "1/1", PO2's one box shows "2/1" (continuing the global count).
  const plBoxGlobalOffsets = (() => {
    let cursor = 0;
    return (plItems || []).map((it) => {
      const start = cursor;
      cursor += (it.pallets || []).length;
      return start;
    });
  })();

  // ✅ NEW — total boxes across ALL PO entries (denominator for the global label)
  const plBoxGlobalTotal = (plItems || []).reduce((s, it) => s + (it.pallets || []).length, 0);

  const handleGeneratePackingList = async () => {
    if (plValidationErrors.length > 0) {
      toast.error(plValidationErrors[0]);
      return;
    }
    try {
      setPlGenerating(true);
      // ✅ NEW — pass the manually entered PO Number(s) into the Packing
      // List's "Customer PO Number" field. Only fills it in when the user
      // hasn't already typed one into that header field directly, so a
      // manual header edit always wins.
      const enteredPoNumbers = plItems.map((item) => (item.poNumber || "").trim()).filter(Boolean);
      const customerPoNumber = plHeader.customerPoNumber?.trim()
        ? plHeader.customerPoNumber
        : enteredPoNumbers.join(", ");
      const res = await API.post(
        `/shipment/packing-list/generate`,
        {
          ...plHeader,
          customerPoNumber,
          items: plItems.map((item) => ({
            splitGroup: item.splitGroup,
            poNumber: item.poNumber,
            description: item.description,
            hsnCode: item.hsnCode,
            qty: item.qty,
            unit: item.unit,
            netWt: item.netWt,
            grossWt: item.grossWt,
            pallets: item.pallets.map((p) => ({
              qty: Number(p.qty),
              dimensions: p.dimensions,
              grossWt: Number(p.grossWt) || 0,
            })),
          })),
        },
        { responseType: "blob" }
      );
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `PackingList_${plHeader.packingListNo || Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Packing List generated ✅");
    } catch (err) {
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          const details = Array.isArray(parsed.details) ? parsed.details.join(" | ") : "";
          toast.error(details || parsed.message || "Failed to generate Packing List");
        } catch {
          toast.error("Failed to generate Packing List");
        }
      } else {
        toast.error(err.response?.data?.message || "Failed to generate Packing List");
      }
    } finally {
      setPlGenerating(false);
    }
  };

  // ✅ NEW — header / exporter / consignee / buyer form. Moved out of the
  // edit step unchanged so the allocation screen can reuse it; the edit
  // step still renders exactly the same fields via renderPlHeaderSections().
  // (forAllocation hides the two Customer PO fields, because every PO gets
  // its own PO Number/Date on the allocation screen.)
  const renderPlHeaderSections = (forAllocation = false) => (
    <>
            {/* Header fields */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
              {[
                ["packingListNo", "Packing List Number"],
                ["packingListDate", "Packing List Date"],
                ["customerPoNumber", "Customer PO Number"],
                ["customerPoDate", "Customer PO Date"],
                ["pol", "Port of Loading"],
                ["portOfDischarge", "Port of Discharge"],
                ["finalDestination", "Final Destination"],
                ["carrierBy", "Carrier By"],
                ["containerNo", "Container No."],
                ["invoiceNo", "Invoice No."],
                ["invoiceDate", "Invoice Date"],
              ].filter(([field]) => !(forAllocation && (field === "customerPoNumber" || field === "customerPoDate"))).map(([field, label]) => (
                <label key={field} style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 3 }}>
                  {label}
                  <input
                    type="text"
                    value={plHeader[field] ?? ""}
                    onChange={(e) => updatePlHeaderField(field, e.target.value)}
                    style={{ padding: "5px 7px", border: "1px solid #CBD5E1", borderRadius: 4, fontSize: 13 }}
                  />
                </label>
              ))}
            </div>

            {/* Exporter / Consignor (pre-filled, editable) */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Exporter / Consignor</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
                <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 3 }}>
                  Company Name
                  <input
                    type="text"
                    value={plHeader.exporter?.name ?? ""}
                    onChange={(e) => updatePlConsigneeField("exporter", "name", e.target.value)}
                    style={{ padding: "5px 7px", border: "1px solid #CBD5E1", borderRadius: 4, fontSize: 13 }}
                  />
                </label>
                <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 3 }}>
                  Address (one line per row)
                  <textarea
                    value={(plHeader.exporter?.lines || []).join("\n")}
                    onChange={(e) => updatePlConsigneeField("exporter", "lines", e.target.value.split("\n"))}
                    rows={4}
                    style={{ padding: "5px 7px", border: "1px solid #CBD5E1", borderRadius: 4, fontSize: 13, resize: "vertical" }}
                  />
                </label>
              </div>
            </div>

            {/* Consignee / Buyer */}
            {["consignee", "buyer"].map((block) => (
              <div key={block} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  {block === "consignee" ? "Customer / Consignee" : "Buyer (Other Than Consignee)"}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 3 }}>
                    Company Name
                    <input
                      type="text"
                      value={plHeader[block]?.companyName ?? ""}
                      onChange={(e) => updatePlConsigneeField(block, "companyName", e.target.value)}
                      style={{ padding: "5px 7px", border: "1px solid #CBD5E1", borderRadius: 4, fontSize: 13 }}
                    />
                  </label>
                  <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 3 }}>
                    Attn
                    <input
                      type="text"
                      value={plHeader[block]?.attn ?? ""}
                      onChange={(e) => updatePlConsigneeField(block, "attn", e.target.value)}
                      style={{ padding: "5px 7px", border: "1px solid #CBD5E1", borderRadius: 4, fontSize: 13 }}
                    />
                  </label>
                  <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 3, gridColumn: "1 / -1" }}>
                    Address (one line per row — type the full block, we'll split it)
                    <textarea
                      value={(plHeader[block]?.lines || []).join("\n")}
                      onChange={(e) =>
                        updatePlConsigneeField(block, "lines", e.target.value.split("\n"))
                      }
                      rows={2}
                      style={{ padding: "5px 7px", border: "1px solid #CBD5E1", borderRadius: 4, fontSize: 13, resize: "vertical" }}
                    />
                  </label>
                  <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 3 }}>
                    Phone
                    <input
                      type="text"
                      value={plHeader[block]?.phone ?? ""}
                      onChange={(e) => updatePlConsigneeField(block, "phone", e.target.value)}
                      style={{ padding: "5px 7px", border: "1px solid #CBD5E1", borderRadius: 4, fontSize: 13 }}
                    />
                  </label>
                  {block === "consignee" && (
                    <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 3 }}>
                      Email
                      <input
                        type="text"
                        value={plHeader[block]?.email ?? ""}
                        onChange={(e) => updatePlConsigneeField(block, "email", e.target.value)}
                        style={{ padding: "5px 7px", border: "1px solid #CBD5E1", borderRadius: 4, fontSize: 13 }}
                      />
                    </label>
                  )}
                </div>
              </div>
            ))}

    </>
  );

  // ✅ NEW — PO-wise Part & Quantity Allocation ─────────────────────────
  const newAllocPo = (nParts) => ({
    poNumber: "", poDate: "", packingListNo: "",
    qty: Array(nParts).fill(""), boxes: Array(nParts).fill(null),
  });

  const startPlAllocation = async () => {
    try {
      setPlLoading(true);
      const res = await API.get(`/shipment/${shipment._id}`);
      const full = res.data || shipment;
      const parts = mapShipmentParts(full.parts, full);
      if (parts.length === 0 || parts.every((p) => p.qty <= 0)) {
        toast.error("This shipment has no part quantities recorded, so there is nothing to allocate.");
        return;
      }
      setPlShipment(full);
      setPlHeader(buildPlHeaderFor(full));
      setPlAlloc({
        pos: [newAllocPo(parts.length), newAllocPo(parts.length)],
        confirmations: { repackParts: {}, dedicatedBoxes: false },
      });
      setPlStep("allocate");
    } catch (err) {
      await reportGenerateError(err);
    } finally {
      setPlLoading(false);
    }
  };

  const plAllocParts = plShipment ? mapShipmentParts(plShipment.parts, plShipment) : [];
  const plAllocResult =
    plAlloc && plAllocParts.length > 0
      ? computeAllocation({
          parts: plAllocParts,
          pos: plAlloc.pos,
          confirmations: plAlloc.confirmations,
          requirePoDetails: true,
        })
      : null;

  // ✅ NEW — what the Packing List currently holds, per PO Number: the PO
  // Number typed, its quantity and its number of boxes. Read from whichever
  // Packing List screen is open (One/Multiple PO screen, or the allocation
  // screen) and remembered in plLabelSeed so the Label Document can use it.
  // Nothing in the Packing List itself is changed by this.
  const plCurrentSeed = (() => {
    if (plStep === "allocate" && plAllocResult) {
      return plAllocResult.perPo
        .filter((p) => p.poNumber && p.totals.qty > 0)
        .map((p) => ({ poNumber: p.poNumber, qty: String(p.totals.qty), boxes: p.totals.boxes }));
    }
    if (plStep === "edit") {
      const byPo = new Map();
      (plItems || []).forEach((it) => {
        const po = String(it.poNumber || "").trim();
        if (!po) return;
        const cur = byPo.get(po.toLowerCase()) || { poNumber: po, qty: 0, boxes: 0 };
        cur.qty += plBoxSum(it);
        cur.boxes += (it.pallets || []).length;
        byPo.set(po.toLowerCase(), cur);
      });
      return [...byPo.values()].map((x) => ({ ...x, qty: String(x.qty) }));
    }
    return [];
  })();
  const plCurrentSeedKey = JSON.stringify(plCurrentSeed);
  useEffect(() => {
    if (plCurrentSeed.length > 0) setPlLabelSeed(plCurrentSeed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plCurrentSeedKey]);

  const updateAllocPoField = (j, field, value) =>
    setPlAlloc((prev) => ({ ...prev, pos: prev.pos.map((po, k) => (k === j ? { ...po, [field]: value } : po)) }));

  // Editing a quantity puts that part's boxes back on automatic, so a stale
  // manual box split can never silently disagree with the new quantities.
  const updateAllocQty = (j, i, value) =>
    setPlAlloc((prev) => ({
      ...prev,
      pos: prev.pos.map((po, k) => ({
        ...po,
        qty: k === j ? po.qty.map((q, x) => (x === i ? value : q)) : po.qty,
        boxes: po.boxes.map((b, x) => (x === i ? null : b)),
      })),
    }));

  const updateAllocBox = (j, i, value) =>
    setPlAlloc((prev) => {
      const effective = plAllocResult ? plAllocResult.parts[i].boxes : [];
      return {
        ...prev,
        pos: prev.pos.map((po, k) => ({
          ...po,
          boxes: po.boxes.map((b, x) => {
            if (x !== i) return b;
            if (k === j) return value;
            return b === null || b === undefined ? String(effective[k] ?? 0) : b;
          }),
        })),
      };
    });

  const resetAllocBoxes = (i) =>
    setPlAlloc((prev) => ({ ...prev, pos: prev.pos.map((po) => ({ ...po, boxes: po.boxes.map((b, x) => (x === i ? null : b)) })) }));

  // Equal split of one part across every PO; a remainder goes to the first
  // POs one piece at a time (10 over 3 → 4/3/3), so nothing is lost.
  const splitAllocPartEqually = (i) =>
    setPlAlloc((prev) => {
      const counts = splitEqually(plAllocParts[i].qty, prev.pos.length);
      return {
        ...prev,
        pos: prev.pos.map((po, k) => ({
          ...po,
          qty: po.qty.map((q, x) => (x === i ? String(counts[k]) : q)),
          boxes: po.boxes.map((b, x) => (x === i ? null : b)),
        })),
      };
    });

  const addAllocPo = () =>
    setPlAlloc((prev) => ({ ...prev, pos: [...prev.pos, newAllocPo(plAllocParts.length)] }));
  const removeAllocPo = (j) =>
    setPlAlloc((prev) => (prev.pos.length <= 1 ? prev : { ...prev, pos: prev.pos.filter((_, k) => k !== j) }));
  const setAllocRepack = (i, value) =>
    setPlAlloc((prev) => ({ ...prev, confirmations: { ...prev.confirmations, repackParts: { ...prev.confirmations.repackParts, [i]: value } } }));
  const setAllocDedicated = (value) =>
    setPlAlloc((prev) => ({ ...prev, confirmations: { ...prev.confirmations, dedicatedBoxes: value } }));

  const handleGenerateAllocated = async () => {
    if (!plAllocResult || !plAllocResult.ok) {
      toast.error(plAllocResult?.errors?.[0] || "Fix the allocation first.");
      return;
    }
    try {
      setPlAllocGenerating(true);
      const res = await API.post(
        `/shipment/packing-list/generate-allocated`,
        {
          ...plHeader,
          shipmentId: plShipment._id,
          pos: plAlloc.pos.map((po) => ({
            poNumber: po.poNumber,
            poDate: po.poDate,
            qty: po.qty,
            boxes: po.boxes,
          })),
          confirmations: plAlloc.confirmations,
        },
        { responseType: "blob" }
      );
      // Check the real file type from its first bytes ("%PDF" vs ZIP "PK"),
      // so a response that isn't a PDF is never saved with a .pdf name.
      const kindOf = async (data) => {
        const head = new Uint8Array(await new Blob([data]).slice(0, 4).arrayBuffer());
        if (head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46) return "pdf";
        if (head[0] === 0x50 && head[1] === 0x4b) return "zip";
        return "other";
      };
      let pdfData = res.data;
      let kind = await kindOf(pdfData);

      // An older backend answers with a ZIP of separate per-PO files. The user
      // always wants ONE Packing List with every PO in it, so build that same
      // combined list here and ask the existing single-document endpoint for
      // it — one PDF regardless of the backend version.
      if (kind === "zip") {
        const fb = await API.post(
          `/shipment/packing-list/generate`,
          {
            ...plHeader,
            customerPoNumber: plAllocResult.perPo.map((p) => p.poNumber).join(", "),
            customerPoDate: [...new Set(plAllocResult.perPo.map((p) => String(p.poDate || "").trim()).filter(Boolean))].join(", "),
            items: plAllocResult.combinedItems.map((it) => ({
              description: it.description,
              hsnCode: it.hsnCode,
              qty: it.qty,
              unit: it.unit,
              netWt: it.netWt,
              grossWt: it.grossWt,
              pallets: it.pallets.map((p) => ({ qty: Number(p.qty), dimensions: p.dimensions, grossWt: Number(p.grossWt) || 0 })),
            })),
          },
          { responseType: "blob" }
        );
        pdfData = fb.data;
        kind = await kindOf(pdfData);
      }

      if (kind !== "pdf") {
        let msg = "The server did not return a valid PDF. Please restart the backend and try again.";
        try {
          const parsed = JSON.parse(await new Blob([pdfData]).text());
          msg = (Array.isArray(parsed.details) && parsed.details.join(" | ")) || parsed.message || msg;
        } catch { /* not JSON */ }
        toast.error(msg);
        return;
      }
      const blob = new Blob([pdfData], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `PackingList_${plHeader.packingListNo || Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Packing List generated ✅");
    } catch (err) {
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          const details = Array.isArray(parsed.details) ? parsed.details.join(" | ") : "";
          toast.error(details || parsed.message || "Failed to generate Packing List");
        } catch {
          toast.error("Failed to generate Packing List");
        }
      } else {
        toast.error(err.response?.data?.message || "Failed to generate Packing List");
      }
    } finally {
      setPlAllocGenerating(false);
    }
  };

  const plTh = { border: "1px solid #E2E8F0", padding: "5px 6px", background: "#F8FAFC", fontSize: 12, textAlign: "left", verticalAlign: "bottom", whiteSpace: "nowrap" };
  const plTd = { border: "1px solid #E2E8F0", padding: "4px 6px", fontSize: 12, verticalAlign: "middle" };
  const plCellInput = { width: 70, padding: "4px 6px", border: "1px solid #CBD5E1", borderRadius: 4, fontSize: 12 };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: plStep === "allocate" ? 1040 : 560, width: "100%" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>Generate Document</h3>
          <button className="btn small" onClick={onClose}>✕</button>
        </div>
        <p style={{ color: "#64748B", fontSize: 13, marginTop: 4 }}>
          Shipment: <strong>{shipment.enquiry_no}</strong> — Invoice {shipment.invoice_no || "—"}
        </p>

        {/* ✅ NEW — Step 0: Consulting / Technologies */}
        {!category && !selectedType && !labelStep && !plStep && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            <button className="btn" style={{ textAlign: "left" }} onClick={() => setCategory("consulting")}>
              Consulting
            </button>
            <button className="btn" style={{ textAlign: "left" }} onClick={() => setCategory("technologies")}>
              Technologies
            </button>
          </div>
        )}

        {category && !selectedType && !labelStep && !plStep && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            <button className="btn small" style={{ alignSelf: "flex-start" }} onClick={() => setCategory(null)}>
              ← Back
            </button>

            {loadingList && <div>Loading…</div>}

            {!loadingList && docTypes.filter((d) => d.category === category).length > 0 && (
              <button
                className="btn"
                style={{ textAlign: "left", fontWeight: 600 }}
                disabled={downloadingAll || directGeneratingType !== null}
                onClick={handleDownloadAll}
              >
                {downloadingAll ? "Generating all documents…" : "⬇ Download All (ZIP)"}
              </button>
            )}

            {!loadingList && docTypes.filter((d) => d.category === category).map((d) => (
              <button
                key={d.docType}
                className="btn"
                style={{ textAlign: "left" }}
                disabled={directGeneratingType === d.docType || downloadingAll}
                onClick={() => handleDocTypeClick(d.docType, d.label)}
              >
                {directGeneratingType === d.docType ? "Generating PDF…" : d.label}
              </button>
            ))}

            {/* ✅ NEW — 6th option, added below the existing 5. Existing
                buttons above are completely untouched. */}
            {!loadingList && (
              <button
                className="btn"
                style={{ textAlign: "left" }}
                onClick={startLabelFlow}
              >
                Label Document
              </button>
            )}

            {/* ✅ NEW — 7th option, Packing List. Existing buttons above are
                completely untouched. */}
            {!loadingList && (
              <button
                className="btn"
                style={{ textAlign: "left" }}
                onClick={startPackingListFlow}
              >
                Packing List
              </button>
            )}
          </div>
        )}

        {/* ✅ NEW — Label Document: Step 1, One PO vs Multiple PO */}
        {labelStep === "choose" && (
          <div style={{ marginTop: 12 }}>
            <button className="btn small" style={{ marginBottom: 10 }} onClick={backToDocList}>
              ← Back to document list
            </button>
            <p style={{ fontSize: 14, marginBottom: 10 }}>
              Is this shipment for one PO Number or multiple PO Numbers?
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" onClick={() => chooseLabelMode("single")}>
                One PO Number
              </button>
              <button className="btn" onClick={() => chooseLabelMode("multiple")}>
                Multiple PO Numbers
              </button>
            </div>
          </div>
        )}

        {/* ✅ NEW — Label Document: Step 2, PO Number entry + generate */}
        {labelStep === "form" && (
          <div style={{ marginTop: 12 }}>
            <button
              className="btn small"
              style={{ marginBottom: 10 }}
              onClick={() => setLabelStep("choose")}
            >
              ← Back
            </button>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
              {poInputs.map((val, idx) => (
                <div key={idx} style={{ display: "flex", gap: 6 }}>
                  <input
                    type="text"
                    placeholder={labelMode === "single" ? "PO Number (e.g. MB00003256)" : `PO Number ${idx + 1}`}
                    value={val}
                    onChange={(e) => updatePoInput(idx, e.target.value)}
                    style={{ flex: 1, padding: "6px 8px", border: "1px solid #CBD5E1", borderRadius: 4 }}
                  />
                  {/* ✅ NEW — Quantity for this PO */}
                  <input
                    type="text"
                    placeholder="Quantity"
                    value={qtyInputs[idx] ?? ""}
                    onChange={(e) => updateQtyInput(idx, e.target.value)}
                    style={{ width: 110, padding: "6px 8px", border: "1px solid #CBD5E1", borderRadius: 4 }}
                  />
                  {labelMode === "multiple" && poInputs.length > 1 && (
                    <button className="btn small" onClick={() => removePoInput(idx)}>✕</button>
                  )}
                </div>
              ))}
              {labelMode === "multiple" && (
                <button className="btn small" style={{ alignSelf: "flex-start" }} onClick={addPoInput}>
                  + Add another PO Number
                </button>
              )}
            </div>

            <button className="btn" disabled={labelGenerating} onClick={handleGenerateLabels}>
              {labelGenerating ? "Generating label(s)…" : "Generate Label"}
            </button>
          </div>
        )}

        {/* ✅ NEW — Packing List: Step 1, One PO vs Multiple PO */}
        {plStep === "choose" && (
          <div style={{ marginTop: 12 }}>
            <button className="btn small" style={{ marginBottom: 10 }} onClick={backToDocListFromPl}>
              ← Back to document list
            </button>
            <p style={{ fontSize: 14, marginBottom: 10 }}>
              Is this Packing List for one PO or multiple POs?
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" disabled={plLoading} onClick={() => choosePlMode("single")}>
                {plLoading ? "Loading…" : "One PO"}
              </button>
              <button className="btn" disabled={plLoading} onClick={() => choosePlMode("multiple")}>
                Multiple PO
              </button>
              {/* ✅ NEW — allocate parts / quantities to each PO, one Packing List per PO */}
              <button className="btn" disabled={plLoading} onClick={startPlAllocation}>
                Allocate Parts to POs
              </button>
            </div>
          </div>
        )}

        {/* ✅ NEW — Packing List: PO-wise Part & Quantity Allocation */}
        {plStep === "allocate" && plAlloc && plHeader && plAllocResult && (() => {
          const res = plAllocResult;
          const posN = plAlloc.pos.length;
          return (
            <div style={{ marginTop: 12, maxHeight: "72vh", overflowY: "auto" }}>
              <button className="btn small" style={{ marginBottom: 10 }} onClick={() => setPlStep("choose")}>
                ← Back
              </button>
              <h4 style={{ margin: "0 0 4px" }}>Allocate Parts to POs</h4>
              <p style={{ fontSize: 12, color: "#64748B", margin: "0 0 10px" }}>
                Enter how many pieces of each part belong to each PO (a part can be split between POs). Use as many
                POs as you need (+ Add PO / ✕). All POs go into ONE Packing List (each part printed once, with its total); each part must be fully allocated.
              </p>

              {/* Quantity allocation */}
              <div style={{ overflowX: "auto", marginBottom: 8 }}>
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                  <thead>
                    <tr>
                      <th style={plTh}>Part No</th>
                      <th style={plTh}>Description</th>
                      <th style={plTh}>Total Qty</th>
                      {plAlloc.pos.map((po, j) => (
                        <th key={j} style={{ ...plTh, minWidth: 130 }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                              <input
                                type="text"
                                placeholder={`PO Number ${j + 1}`}
                                value={po.poNumber}
                                onChange={(e) => updateAllocPoField(j, "poNumber", e.target.value)}
                                style={{ ...plCellInput, width: 100, fontWeight: 600 }}
                              />
                              {posN > 1 && (
                                <button className="btn small" onClick={() => removeAllocPo(j)} title="Remove this PO">✕</button>
                              )}
                            </div>
                            <input
                              type="date"
                              title="PO Date"
                              value={po.poDate}
                              onChange={(e) => updateAllocPoField(j, "poDate", e.target.value)}
                              style={{ ...plCellInput, width: 130 }}
                            />
                          </div>
                        </th>
                      ))}
                      <th style={plTh}>Allocated</th>
                      <th style={plTh}>Remaining</th>
                      <th style={plTh}>Status</th>
                      <th style={plTh}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {plAllocParts.map((part, i) => {
                      const info = res.parts[i];
                      return (
                        <tr key={i}>
                          <td style={plTd}>{part.partNo}</td>
                          <td style={plTd}>{part.description}</td>
                          <td style={{ ...plTd, fontWeight: 600 }}>{part.qty}</td>
                          {plAlloc.pos.map((po, j) => {
                            const raw = String(po.qty[i] ?? "").trim();
                            const bad = raw !== "" && !/^\d+$/.test(raw);
                            return (
                              <td key={j} style={plTd}>
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  aria-label={`${part.partNo} quantity for PO ${j + 1}`}
                                  value={po.qty[i] ?? ""}
                                  onChange={(e) => updateAllocQty(j, i, e.target.value)}
                                  style={{ ...plCellInput, borderColor: bad ? "#B91C1C" : "#CBD5E1" }}
                                />
                              </td>
                            );
                          })}
                          <td style={plTd}>{info.allocated}</td>
                          <td style={{ ...plTd, color: info.remaining === 0 ? "#16A34A" : "#B45309", fontWeight: 600 }}>{info.remaining}</td>
                          <td style={{ ...plTd, whiteSpace: "nowrap", color: info.status === "ok" ? "#16A34A" : info.status === "under" ? "#B45309" : "#B91C1C" }}>
                            {info.status === "ok" ? "✓ Allocated" : info.status === "under" ? `⚠ ${info.remaining} unallocated` : `✗ Over by ${-info.remaining}`}
                          </td>
                          <td style={plTd}>
                            <button className="btn small" onClick={() => splitAllocPartEqually(i)} title="Split this part equally across all POs">
                              Split equally
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    <tr>
                      <td style={{ ...plTd, fontWeight: 600 }} colSpan={3}>Total pieces</td>
                      {res.perPo.map((p, j) => (
                        <td key={j} style={{ ...plTd, fontWeight: 600 }}>{p.totals.qty}</td>
                      ))}
                      <td style={{ ...plTd, fontWeight: 600 }}>{res.totals.qty} / {res.original.qty}</td>
                      <td style={plTd} colSpan={3}></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <button className="btn small" style={{ marginBottom: 14 }} onClick={addAllocPo}>+ Add PO</button>

              {/* Box allocation */}
              <div style={{ fontSize: 13, fontWeight: 600, margin: "4px 0 2px" }}>Box allocation</div>
              <p style={{ fontSize: 12, color: "#64748B", margin: "0 0 6px" }}>
                Each physical box goes to exactly one PO. Boxes are assigned automatically from the quantities; edit
                them only if you need a different split. Box weight = pieces × unit weight + the box's own tare weight.
              </p>
              <div style={{ overflowX: "auto", marginBottom: 10 }}>
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                  <thead>
                    <tr>
                      <th style={plTh}>Part No</th>
                      <th style={plTh}>Boxes in shipment</th>
                      {plAlloc.pos.map((po, j) => (
                        <th key={j} style={plTh}>{po.poNumber || `PO ${j + 1}`}</th>
                      ))}
                      <th style={plTh}>Boxes assigned</th>
                      <th style={plTh}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {plAllocParts.map((part, i) => {
                      const info = res.parts[i];
                      const confirmedRepack = plAlloc.confirmations.repackParts[i] === true;
                      return (
                        <tr key={i}>
                          <td style={plTd}>{part.partNo}</td>
                          <td style={plTd}>{info.boxesOriginal}</td>
                          {plAlloc.pos.map((po, j) => {
                            const hasQty = (Number(po.qty[i]) || 0) > 0;
                            return (
                              <td key={j} style={plTd}>
                                {hasQty ? (
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    aria-label={`${part.partNo} boxes for PO ${j + 1}`}
                                    value={info.boxesAuto ? String(info.boxes[j] ?? 0) : (po.boxes[i] ?? "")}
                                    onChange={(e) => updateAllocBox(j, i, e.target.value)}
                                    style={{ ...plCellInput, width: 56 }}
                                  />
                                ) : (
                                  <span style={{ color: "#94A3B8" }}>—</span>
                                )}
                              </td>
                            );
                          })}
                          <td style={{ ...plTd, color: info.needsRepack ? (confirmedRepack ? "#B45309" : "#B91C1C") : info.boxesTotal === info.boxesOriginal ? "#16A34A" : "#B91C1C" }}>
                            {info.boxesTotal}
                          </td>
                          <td style={plTd}>
                            {info.needsRepack && (
                              <label style={{ fontSize: 12, display: "flex", gap: 4, alignItems: "center" }}>
                                <input type="checkbox" checked={confirmedRepack} onChange={(e) => setAllocRepack(i, e.target.checked)} />
                                Repack into separate boxes
                              </label>
                            )}
                            {!info.boxesAuto && (
                              <button className="btn small" onClick={() => resetAllocBoxes(i)}>Reset to automatic</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {plAllocParts.length > 1 && (
                <label style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 12 }}>
                  <input
                    type="checkbox"
                    checked={plAlloc.confirmations.dedicatedBoxes}
                    onChange={(e) => setAllocDedicated(e.target.checked)}
                    style={{ marginTop: 2 }}
                  />
                  <span>
                    I confirm each part is packed in its own boxes (no box holds parts that belong to different POs).
                    Box contents aren't recorded per box for this shipment.
                  </span>
                </label>
              )}

              {/* PO-wise summary */}
              <div style={{ fontSize: 13, fontWeight: 600, margin: "4px 0 4px" }}>PO-wise summary</div>
              <div style={{ overflowX: "auto", marginBottom: 12 }}>
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                  <thead>
                    <tr>
                      <th style={plTh}>PO Number</th>
                      <th style={plTh}>Pieces</th>
                      <th style={plTh}>Net Wt (Kg)</th>
                      <th style={plTh}>Gross Wt (Kg)</th>
                      <th style={plTh}>Boxes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {res.perPo.map((p, j) => (
                      <tr key={j}>
                        <td style={plTd}>{p.poNumber || `PO ${j + 1}`}</td>
                        <td style={plTd}>{p.totals.qty}</td>
                        <td style={plTd}>{p.totals.net.toFixed(3)}</td>
                        <td style={plTd}>{p.totals.gross.toFixed(2)}</td>
                        <td style={plTd}>{p.totals.boxes}</td>
                      </tr>
                    ))}
                    <tr>
                      <td style={{ ...plTd, fontWeight: 600 }}>Total allocated</td>
                      <td style={{ ...plTd, fontWeight: 600 }}>{res.totals.qty}</td>
                      <td style={{ ...plTd, fontWeight: 600 }}>{res.totals.net.toFixed(3)}</td>
                      <td style={{ ...plTd, fontWeight: 600 }}>{res.totals.gross.toFixed(2)}</td>
                      <td style={{ ...plTd, fontWeight: 600 }}>{res.totals.boxes}</td>
                    </tr>
                    <tr>
                      <td style={plTd}>Original shipment</td>
                      <td style={plTd}>{res.original.qty}</td>
                      <td style={plTd}>{res.original.net.toFixed(3)}</td>
                      <td style={plTd}>{res.original.gross.toFixed(2)}</td>
                      <td style={plTd}>{res.original.boxes}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {res.parts.some((p) => p.needsRepack && plAlloc.confirmations.repackParts[p.idx] === true) && (
                <p style={{ fontSize: 12, color: "#B45309", margin: "0 0 10px" }}>
                  Repacking adds boxes, so total boxes and gross weight are higher than the original shipment (extra tare weight per added box).
                </p>
              )}

              <details style={{ marginBottom: 12 }}>
                <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                  Shipment, exporter, consignee &amp; buyer details (shared by the whole Packing List)
                </summary>
                <div style={{ marginTop: 8 }}>{renderPlHeaderSections(true)}</div>
              </details>

              {res.errors.length > 0 && (
                <div style={{
                  background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FCA5A5",
                  borderRadius: 6, padding: "8px 10px", fontSize: 13, marginBottom: 10,
                }}>
                  {res.errors.map((e, i) => <div key={i}>{e}</div>)}
                </div>
              )}

              <button
                className="btn"
                disabled={plAllocGenerating || !res.ok}
                onClick={handleGenerateAllocated}
                style={{ fontWeight: 600 }}
              >
                {plAllocGenerating ? "Generating Packing List…" : "Generate Packing List"}
              </button>
            </div>
          );
        })()}

        {/* ✅ NEW — Packing List: Step 3, editable preview (header fields +
            per-item pallet breakdown) + Generate */}
        {plStep === "edit" && plHeader && (
          <div style={{ marginTop: 12, maxHeight: "70vh", overflowY: "auto" }}>
            <button className="btn small" style={{ marginBottom: 10 }} onClick={() => setPlStep("choose")}>
              ← Back
            </button>

            <h4 style={{ margin: "0 0 8px" }}>Packing List Details</h4>

            {/* ✅ REORDERED — PO Selection + Number of Boxes/QTY section now
                comes first; the header fields, Exporter, and Consignee/Buyer
                sections that used to be above it now follow below it. No
                logic changed, only the display order of these blocks. */}

            {/* PO selection with "Number of Boxes" beside it (One PO) */}
            <div style={{ display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 12, marginBottom: 3 }}>PO Selection</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {[["single", "One PO"], ["multiple", "Multiple PO"]].map(([m, lbl]) => (
                    <button
                      key={m}
                      className="btn small"
                      onClick={() => switchPlMode(m)}
                      style={{ fontWeight: plMode === m ? 700 : 400, outline: plMode === m ? "2px solid #2563EB" : "none" }}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {plMode === "single" && plItems.length === 1 && plItems[0] && (
                <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 3 }}>
                  Number of Boxes
                  <select
                    value={plItems[0].palletCount}
                    onChange={(e) => changePlPalletCount(0, e.target.value)}
                    style={{ padding: "5px 7px", border: "1px solid #CBD5E1", borderRadius: 4, fontSize: 13 }}
                  >
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </label>
              )}

              {/* ✅ NEW — "+ Add PO Number": adds another independent PO
                  entry below, each with its own PO Number field, part
                  details, Number of Boxes dropdown and box rows. */}
              <button className="btn small" onClick={addPlPoEntry}>
                + Add PO Number
              </button>
            </div>

            {/* One block per line (One PO → 1 line for the whole shipment;
                Multiple PO → 1 line per part, each with its own dropdown). */}
            {plItems.map((item, itemIdx) => {
              const boxSum = (item.pallets || []).reduce((s, p) => s + (Number(p.qty) || 0), 0);
              // ✅ NEW — for multiple PO entries sharing one shipment
              // quantity, each entry's own box sum is only ITS share of
              // the total, not the full item.qty, so it's never compared
              // against item.qty here; the combined total across every
              // entry is validated once, collectively, below (plValidationErrors).
              const groupMembers = plGroupItems(plItems).get(plGroupKey(item, itemIdx)) || [];
              const sharedPoEntries = groupMembers.length > 1;
              const groupSum = groupMembers.reduce((s, { item: it }) => s + plBoxSum(it), 0);
              const mismatch = sharedPoEntries
                ? groupSum !== Number(item.qty)
                : boxSum !== Number(item.qty);
              return (
                <div
                  key={itemIdx}
                  style={{ border: "1px solid #E2E8F0", borderRadius: 6, padding: 10, marginBottom: 12 }}
                >
                  {/* ✅ NEW — PO Number field, at the top of this PO entry,
                      before its part details (spec: "PO number input →
                      part details → ..."). Editable; its value is what
                      gets passed into Customer PO Number on generation. */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 8, marginBottom: 8 }}>
                    <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 3, flex: 1, maxWidth: 260 }}>
                      PO Number
                      <input
                        type="text"
                        placeholder={`PO Number ${itemIdx + 1}`}
                        value={item.poNumber || ""}
                        onChange={(e) => updatePlItemPoNumber(itemIdx, e.target.value)}
                        style={{ padding: "5px 7px", border: "1px solid #CBD5E1", borderRadius: 4, fontSize: 13, fontWeight: 600 }}
                      />
                    </label>
                    {plItems.length > 1 && (
                      <button className="btn small" onClick={() => removePlItem(itemIdx)}>✕ Remove</button>
                    )}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {plMode === "multiple" ? `PO ${itemIdx + 1} — ` : ""}{item.description || item.partNo || "Shipment"}
                      </div>
                      <div style={{ fontSize: 12, color: "#64748B" }}>
                        Total shipment quantity: <strong>{item.qty}</strong> {item.unit}
                      </div>
                    </div>

                    {(plMode === "multiple" || plItems.length > 1) && (
                      <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 3 }}>
                        Number of Boxes
                        <select
                          value={item.palletCount}
                          onChange={(e) => changePlPalletCount(itemIdx, e.target.value)}
                          style={{ padding: "5px 7px", border: "1px solid #CBD5E1", borderRadius: 4, fontSize: 13 }}
                        >
                          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>

                  <div style={{ fontSize: 13, fontWeight: 600, margin: "6px 0 4px" }}>QTY</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {(item.pallets || []).map((pallet, palletIdx) => (
                      <div
                        key={palletIdx}
                        style={{ display: "grid", gridTemplateColumns: "70px 90px 1fr 100px", gap: 6, alignItems: "center" }}
                      >
                        <div style={{ fontSize: 12, color: "#64748B" }}>
                          {/* ✅ NEW — global numbering: Box X (X/Total) across all POs */}
                          Box {plBoxGlobalOffsets[itemIdx] + palletIdx + 1} <span style={{ opacity: 0.7 }}>({plBoxGlobalOffsets[itemIdx] + palletIdx + 1}/{plBoxGlobalTotal})</span>
                        </div>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          aria-label={`Box ${palletIdx + 1} QTY`}
                          value={pallet.qty}
                          onChange={(e) => updatePlPalletField(itemIdx, palletIdx, "qty", e.target.value)}
                          style={{ padding: "5px 7px", border: "1px solid #CBD5E1", borderRadius: 4, fontSize: 13 }}
                        />
                        <input
                          type="text"
                          placeholder="Dimensions L x W x H"
                          value={pallet.dimensions}
                          onChange={(e) => updatePlPalletField(itemIdx, palletIdx, "dimensions", e.target.value)}
                          style={{ padding: "5px 7px", border: "1px solid #CBD5E1", borderRadius: 4, fontSize: 13 }}
                        />
                        <input
                          type="number"
                          placeholder="Gross Wt (Kg)"
                          value={pallet.grossWt}
                          onChange={(e) => updatePlPalletField(itemIdx, palletIdx, "grossWt", e.target.value)}
                          style={{ padding: "5px 7px", border: "1px solid #CBD5E1", borderRadius: 4, fontSize: 13 }}
                        />
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                    <div style={{ fontSize: 12, color: mismatch ? "#B91C1C" : "#16A34A" }}>
                      Box quantities total {boxSum}{sharedPoEntries ? ` (all POs combined: ${groupSum} / ${item.qty})` : ` / ${item.qty}`} {mismatch ? "— must equal the shipment quantity" : "✓"}
                    </div>
                    <button
                      className="btn small"
                      onClick={() => changePlPalletCount(itemIdx, item.palletCount)}
                    >
                      Split equally
                    </button>
                  </div>
                </div>
              );
            })}

            {renderPlHeaderSections()}

            {plValidationErrors.length > 0 && (
              <div style={{
                background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FCA5A5",
                borderRadius: 6, padding: "8px 10px", fontSize: 13, marginBottom: 10,
              }}>
                {plValidationErrors.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            )}

            <button
              className="btn"
              disabled={plGenerating || plValidationErrors.length > 0}
              onClick={handleGeneratePackingList}
              style={{ fontWeight: 600 }}
            >
              {plGenerating ? "Generating Packing List…" : "Generate Packing List"}
            </button>
          </div>
        )}

        {selectedType && (
          <div style={{ marginTop: 12 }}>
            <button
              className="btn small"
              style={{ marginBottom: 10 }}
              onClick={() => { setSelectedType(null); setPreview(null); }}
            >
              ← Back to document list
            </button>

            {loadingPreview && <div>Loading preview…</div>}

            {!loadingPreview && preview && (
              <>
                <h4 style={{ marginBottom: 6 }}>{preview.label}</h4>

                {preview.missing && preview.missing.length > 0 && (
                  <div style={{
                    background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FCA5A5",
                    borderRadius: 6, padding: "8px 10px", fontSize: 13, marginBottom: 10,
                  }}>
                    {preview.missing.map((m, i) => <div key={i}>{m}</div>)}
                  </div>
                )}

                <div style={{ fontSize: 13, color: "#334155", marginBottom: 10 }}>
                  <div><strong>Invoice No.:</strong> {preview.invoice_no || "—"}</div>
                  <div><strong>Invoice Date:</strong> {preview.invoice_date || "—"}</div>
                  {selectedType === "cargo_security_declaration" && (
                    <div><strong>Mode:</strong> {preview.mode || "—"}</div>
                  )}
                </div>

                {preview.editableFields.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                    {preview.editableFields.map((field) => (
                      <label key={field} style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 3 }}>
                        {FIELD_LABELS[field] || field}
                        <input
                          type="text"
                          value={editValues[field] ?? ""}
                          onChange={(e) => setEditValues((p) => ({ ...p, [field]: e.target.value }))}
                          style={{ padding: "6px 8px", border: "1px solid #CBD5E1", borderRadius: 4 }}
                        />
                      </label>
                    ))}
                  </div>
                )}

                <button
                  className="btn"
                  disabled={generating || (preview.missing && preview.missing.length > 0)}
                  onClick={handleGenerate}
                >
                  {generating ? "Generating PDF…" : "Generate & Download"}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
