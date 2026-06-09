const { default: mongoose } = require("mongoose");
const fs = require("fs");
const part = require("../models/part");
const shipment = require("../models/shipment");
const XLSX = require('xlsx');

function normalize(data) {
  const out = { ...data };

  Object.keys(out).forEach((k) => {
    if (out[k] === "") out[k] = null;
  });

  // Ensure sanitization handles both single properties and new array configurations
  [
    "part_qty", "net_wt", "gross_wt", "packaging_wt", "total_cost",
    "quantity", "net_wt_per_unit", "total_no_of_boxes", "gross_wt",
     "total_no_of_boxes", "total_net_weight", "total_gross_weight"
  ].forEach((f) => {
    if (out[f] !== null && out[f] !== undefined) {
      const parsed = Number(out[f]);
      out[f] = Number.isFinite(parsed) ? parsed : null;
    }
  });

  // Dates
  ["dispatch_date", "sb_date", "etd", "final_delivery_date"].forEach((d) => {
    if (out[d]) out[d] = new Date(out[d]);
  });

  return out;
}
// ✅ NEW HELPER: Merge incoming payload onto existing DB doc,
// keeping old values wherever the incoming field is blank / undefined.
function mergePreservingExisting(doc, incoming) {
  Object.keys(incoming).forEach((key) => {
    const val = incoming[key];
    // Skip parts — handled separately
    if (key === "parts") return;
    // Skip undefined
    if (val === undefined) return;
    // Skip empty string — preserve whatever is in DB
    if (val === "" || val === null) {
      // Only overwrite with null if the field was explicitly provided AND
      // it is NOT a string field that currently has a real value in DB.
      // Rule: if DB already has a non-empty value and incoming is "", keep DB.
      if (doc[key] !== undefined && doc[key] !== null && doc[key] !== "") return;
    }
    doc[key] = val;
  });
}

exports.fetchDashboardSummary = async (req, res) => {
  try {
    const totalShipments = await shipment.countDocuments();

    const modeWise = await shipment.aggregate([
      { $group: { _id: "$mode", count: { $sum: 1 } } },
      { $project: { mode: "$_id", count: 1, _id: 0 } },
    ]);

    const statusWise = await shipment.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $project: { status: "$_id", count: 1, _id: 0 } },
    ]);

    res.json({ totalShipments, modeWise, statusWise });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Dashboard fetch failed" });
  }
};

exports.addShipment = async (req, res) => {
  try {
    const data = normalize(req.body);

    if (data.part_no && data.part_desc) {
      await part.updateOne(
        { part_no: data.part_no },
        { part_desc: data.part_desc },
        { upsert: true },
      );
    }

    // Map properties into structural subdocuments so schema math hooks fire.
    // Step1 sends parts[] with keys: part_no, part_desc, part_qty, part_net_unit,
    // part_pkg_wt, part_gross, part_box_size  — normalise them to schema names.
    if (data.parts && data.parts.length > 0) {
      data.parts = data.parts.map((p) => ({
        part_no:         p.part_no        || "UNKNOWN",
        part_desc:       p.part_desc      || "",
        box_size:        p.part_box_size  || p.box_size || "",
        quantity:        Number(p.part_qty)       || 0,
        net_wt_per_unit: Number(p.part_net_unit)  || 0,
        no_of_boxes:     Number(p.part_no_of_boxes) ||0, 
        total_net_wt:    Number(p.part_total_net_wt) || 0, 
        gross_wt:        Number(p.part_gross)     || 0,
      }));
    } else {
      // Legacy flat-field fallback
      data.parts = [
        {
          part_no:         data.part_no    || "UNKNOWN",
          part_desc:       data.part_desc  || "",
          box_size:        data.box_size   || "",
          quantity:        Number(data.part_qty)    || 0,
          net_wt_per_unit: Number(data.net_wt)      || 0,
          no_of_boxes:     Number(data.part_no_of_boxes) ||0, 
          total_net_wt:    Number(data.part_total_net_wt) || 0, 
          gross_wt:        Number(data.gross_wt)    || 0,
        }
      ];
    }

    // Preserve the flat totals from Step1 so the pre-save hook can sync them
    // to total_net_weight / total_gross_weight / total_parts_count.
    if (data.total_qty      !== undefined) data.total_qty      = Number(data.total_qty);
    if (data.total_net_wt   !== undefined) data.total_net_wt   = Number(data.total_net_wt);
    if (data.total_gross_wt !== undefined) data.total_gross_wt = Number(data.total_gross_wt);
    if (data.total_no_of_boxes !== undefined) data.total_no_of_boxes = Number(data.total_no_of_boxes);

    const result = await shipment.create({
      ...data,
      status: "ACTIVE",
      delivery_status: "IN_PROCESS",
    });

    res.json({ id: result._id.toString() });
  } catch (err) {
    console.error("🔥 MONGO CREATE ERROR 🔥", err);
    res.status(500).json({ message: err.message });
  }
};

exports.updateShipment = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid shipment ID" });
    }

    const data = normalize(req.body);
    const doc = await shipment.findById(id);
    
    if (!doc) {
      return res.status(404).json({ message: "Shipment not found" });
    }

    // If parts array is present from Step1, normalise the Step1 field names
    // (part_gross, part_net_unit, part_pkg_wt, part_box_size) → schema names.
    if (data.parts && data.parts.length > 0) {
      data.parts = data.parts.map((p, i) => {
        let existing = {};
        if (p._id && doc.parts) {
          existing = doc.parts.id(p._id) || doc.parts[i] || {};
        } else if (doc.parts && doc.parts[i]) {
          existing = doc.parts[i];
        }
        return {
          _id:             p._id             || existing._id,
          part_no:         p.part_no         || existing.part_no         || "UNKNOWN",
          part_desc:       p.part_desc       || existing.part_desc       || "",
          box_size:        p.part_box_size   || p.box_size               || existing.box_size || "",
          quantity:        Number(p.part_qty       ?? p.quantity       ?? existing.quantity)       || 0,
          net_wt_per_unit: Number(p.part_net_unit  ?? p.net_wt_per_unit ?? existing.net_wt_per_unit) || 0,
          no_of_boxes:     Number(p.part_no_of_boxes ?? p.no_of_boxes ?? existing.no_of_boxes) || 0,
          total_net_wt:    Number(p.part_total_net_wt ?? p.total_net_wt ?? existing.total_net_wt) || 0,
          gross_wt:        Number(p.part_gross     ?? p.gross_wt       ?? existing.gross_wt)      || 0,
        };
      });
    } else if (data.part_qty !== undefined || data.net_wt !== undefined || data.gross_wt !== undefined) {
      // Legacy flat-field path (no parts array sent)
      const currentPart = doc.parts && doc.parts[0] ? doc.parts[0] : {};
      data.parts = [
        {
          _id:             currentPart._id,
          part_no:         data.part_no      !== undefined ? data.part_no      : (currentPart.part_no  || "UNKNOWN"),
          part_desc:       data.part_desc    !== undefined ? data.part_desc    : (currentPart.part_desc || ""),
          box_size:        data.box_size     !== undefined ? data.box_size     : (currentPart.box_size  || ""),
          quantity:        data.part_qty     !== undefined ? Number(data.part_qty)     : (currentPart.quantity       || 0),
          net_wt_per_unit: data.net_wt       !== undefined ? Number(data.net_wt)       : (currentPart.net_wt_per_unit || 0),
          no_of_boxes:     data.part_no_of_boxes !== undefined ? Number(data.part_no_of_boxes) : (currentPart.no_of_boxes || 0),
          total_net_wt:    data.part_total_net_wt !== undefined ? Number(data.part_total_net_wt) : (currentPart.total_net_wt || 0),
          gross_wt:        data.gross_wt     !== undefined ? Number(data.gross_wt)     : (currentPart.gross_wt       || 0),
        }
      ];
    }

    // Preserve flat totals so pre-save hook can sync them
    if (data.total_qty      !== undefined) data.total_qty      = Number(data.total_qty);
    if (data.total_net_wt   !== undefined) data.total_net_wt   = Number(data.total_net_wt);
    if (data.total_gross_wt !== undefined) data.total_gross_wt = Number(data.total_gross_wt);
    if (data.total_no_of_boxes !== undefined) data.total_no_of_boxes = Number(data.total_no_of_boxes);

    Object.assign(doc, data);
    await doc.save(); // Invokes pre-save hook for totals recalculation

    res.json({ success: true, shipment: doc });
  } catch (err) {
    console.error("UPDATE ERROR:", err);
    res.status(500).json({ message: "Update failed" });
  }
};

exports.updateDeliveryStatus = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid shipment ID" });
    }
    await shipment.findByIdAndUpdate(req.params.id, {
      delivery_status: req.body.delivery_status,
    });
    res.json({ success: true });
  } catch (e) {
    console.log(e);
    res.status(500).json({ success: false });
  }
};

exports.updateManualDesc = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid shipment ID" });
    }
    await shipment.findByIdAndUpdate(req.params.id, {
      manual_desc: req.body.manual_desc,
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false });
  }
};

exports.bulkUploadShipments = async (req, res) => {
  try {
    const incoming = req.files?.file || req.files?.files;
    const file = Array.isArray(incoming) ? incoming[0] : incoming;

    if (!file) {
      return res.status(400).json({ error: "Please upload a CSV/XLSX file" });
    }

    const filePath = file.tempFilePath || file.path;
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    if (rows.length === 0) return res.status(400).json({ error: "File is empty" });

    const existingShipments = await shipment.find({}, { enquiry_no: 1 }).lean();
    const existingSet = new Set(existingShipments.map(s => s.enquiry_no));
    
    const uploadBatchId = `BATCH-${Date.now()}`;
    const validDocs = [];
    const duplicates = [];

    rows.forEach((row) => {
      const normalizedRow = {};
      Object.keys(row).forEach(key => {
        const standardKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
        normalizedRow[standardKey] = row[key];
      });

      const rawDoc = {
        enquiry_no: normalizedRow.enquiryno || normalizedRow.shipmentno || normalizedRow.qmrelno,
        supplier_name: normalizedRow.suppliername || normalizedRow.supplier,
        customer: normalizedRow.customername || normalizedRow.customer,
        ff: normalizedRow.ff || normalizedRow.freightforwarder,
        invoice_no: normalizedRow.invoiceno || normalizedRow.invoice,
        invoice_date:        normalizedRow.invoicedate  || normalizedRow.invoicedt,
        incoterm:            normalizedRow.incoterm     || normalizedRow.incoterms,
        mode: normalizedRow.mode || normalizedRow.shipmentmode,
        container_no:        normalizedRow.containerno  || normalizedRow.container    || normalizedRow.containernumber,
        bl_no: normalizedRow.blno || normalizedRow.billoflading,
        pol: normalizedRow.pol || normalizedRow.portofloading,
        etd:                 normalizedRow.etd || null,   // ✅ ADDED — was completely missing before
        final_delivery_date: normalizedRow.finaldelivery || normalizedRow.deliverydate || normalizedRow.eta,
        uploadBatchId
      };

      const cleanDoc = normalize(rawDoc);

      const quantity = Number(normalizedRow.qty || normalizedRow.partqty || normalizedRow.quantity) || 0;
      const netWt = Number(normalizedRow.netwt || normalizedRow.netweight) || 0;
      const noOfBoxes    = Number(normalizedRow.totalboxes  || normalizedRow.noofboxes  || normalizedRow.boxes)      || 0; // ✅ FIXED key
      const totalNetWt   = Number(normalizedRow.totalnetwt  || normalizedRow.netwt      || normalizedRow.netweight)  || 0; // ✅ FIXED key
      const totalGrossWt = Number(normalizedRow.totalgrosswt|| normalizedRow.grosswt    || normalizedRow.grossweight) || 0; // ✅ FIXED key
      const netWtPerUnit = quantity > 0 ? totalNetWt / quantity : 0;
      cleanDoc.parts = [
        {
          part_no: normalizedRow.partno || normalizedRow.partnumber || "UNKNOWN",
          part_desc: normalizedRow.partdescription || normalizedRow.partdesc || normalizedRow.description || "",
          box_size: normalizedRow.boxsize || "",
          quantity: quantity,
          net_wt_per_unit: netWtPerUnit,
          no_of_boxes: noOfBoxes,
          gross_wt: totalGrossWt
        }
      ];

      cleanDoc.total_parts_count = quantity;
      cleanDoc.total_no_of_boxes = noOfBoxes;  
      cleanDoc.total_gross_weight = totalGrossWt;
      cleanDoc.total_net_weight = totalNetWt;

      if (existingSet.has(cleanDoc.enquiry_no)) {
        duplicates.push(cleanDoc.enquiry_no);
      } else {
        validDocs.push({
          ...cleanDoc,
          status: "ACTIVE",
          delivery_status: "IN_PROCESS"
        });
        existingSet.add(cleanDoc.enquiry_no);
      }
    });

    if (validDocs.length > 0) {
      await shipment.insertMany(validDocs, { ordered: false });
    }

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    res.json({ 
      success: true, 
      inserted: validDocs.length, 
      skippedDuplicates: duplicates.length,
      batchId: uploadBatchId 
    });

  } catch (err) {
    console.error("BULK ERROR:", err);
    res.status(500).json({ error: "Bulk upload failed: " + err.message });
  }
};

exports.getEnquiryNumber = async (req, res) => {
  try {
    const shortYear = new Date().getFullYear().toString().slice(-2);
    const prefix = `QMR${shortYear}`;

    const lastRecord = await shipment
      .findOne({ enquiry_no: new RegExp(`^${prefix}`) })
      .sort({ enquiry_no: -1 });

    let seq = 5001;

    if (lastRecord && lastRecord.enquiry_no) {
      const lastSeqStr = lastRecord.enquiry_no.replace(prefix, "");
      const lastSeqNum = parseInt(lastSeqStr, 10);
      if (!isNaN(lastSeqNum)) {
        seq = lastSeqNum + 1;
      }
    }

    res.json({ enquiryNo: `${prefix}${seq}` });
  } catch (err) {
    console.error("Enquiry generation error:", err);
    res.status(500).json({ error: "Failed to generate enquiry number" });
  }
};

exports.fetchAllShipments = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.pageSize) || 10;
    const skip = (page - 1) * limit;

    const matchQuery = {
      status: { $ne: "DELETED" },
    };

    if (req.query?.search) {
      matchQuery["$or"] = [
        { enquiry_no: { $regex: req.query.search, $options: "i" } },
        { supplier_name: { $regex: req.query.search, $options: "i" } },
        { customer: { $regex: req.query.search, $options: "i" } },
        { bl_no: { $regex: req.query.search, $options: "i" } }
      ];
    }

    const total = await shipment.countDocuments(matchQuery);

    const shipments = await shipment.aggregate([
      { $match: matchQuery },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        // Explicit projection forces MongoDB to return computed values for both structures
        $project: {
          _id: 1,
          ff: 1,
          invoice_no: 1,
          invoice_date: 1,
          enquiry_no: 1,
          supplier_name: 1,
          customer: 1,
          incoterm: 1,
          mode: 1,
          etd: 1,
          bl_no: 1,
          container_no: 1,
          pol: 1,
          status: 1,
          delivery_status: 1,
          manual_desc: 1,
          parts: 1,
        total_no_of_boxes: { $ifNull: ["$total_no_of_boxes", { $ifNull: ["$total_boxes", { $ifNull: ["$part_boxes", 0] }] }] },
          total_gross_weight: { $ifNull: ["$total_gross_weight", { $ifNull: ["$total_gross_wt", { $ifNull: ["$gross_wt", 0] }] }] },
          total_net_weight: { $ifNull: ["$total_net_weight", { $ifNull: ["$total_net_wt", { $ifNull: ["$net_wt", 0] }] }] },
        }
      }
    ]);

    res.set("x-total-count", String(total));
    return res.json(shipments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch shipments" });
  }
};

exports.getShipmentByBl = async (req, res) => {
  try {
    const blNo = (req.params.blNo || "").trim();
    if (!blNo) return res.status(400).json({ message: "BL number is required" });

    const records = await shipment.find({ bl_no: { $regex: `^${blNo}$`, $options: "i" } }).sort({ createdAt: 1 }).lean();
    if (!records.length) return res.status(404).json({ message: "Shipment not found" });

    const first = records[0];
    const items = records.map((row, index) => {
      const qty = Number(row.total_parts_count || row.part_qty) || 0;
      const unitPrice = Number(row.unit_price || 0);

      return {
        srNo: index + 1,
        partNo: row.parts?.[0]?.part_no || row.part_no || "",
        partName: row.parts?.[0]?.part_desc || row.part_desc || "",
        description: row.parts?.[0]?.part_desc || row.part_desc || "",
        refPartInvNo: row.parts?.[0]?.part_no || row.part_no || "",
        hsnCode: row.hsn_code || "",
        qty,
        unitPrice,
        amount: qty * unitPrice,
      };
    });

    res.json({
      billTo: {
        companyName: first.customer || "",
        address: first.address || "",
        contactNumber: first.contact_number || "",
        blNo: first.bl_no || blNo,
        recipientEmail: first.notify_email || "",
      },
      invoiceNo: first.invoice_no || "",
      invoiceDate: first.invoice_date || first.createdAt || null,
      items,
      shipmentRows: records,
    });
  } catch (err) {
    console.error("Get shipment by BL error:", err);
    res.status(500).json({ message: err.message });
  }
};