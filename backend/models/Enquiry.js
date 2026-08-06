const mongoose = require("mongoose");

// Child part — always nested under a parent part in the `parts` array.
// `isChildPart` is stored explicitly so every child part is unambiguously
// marked as a child, as opposed to a top-level/parent part.
const ChildPartSchema = new mongoose.Schema(
  {
    customerPartNo: { type: String },
    customerPartName: { type: String },
    modifiedBOPartNo: { type: String },
    boPartName: { type: String },
    isChildPart: { type: Boolean, default: true },
  },
  { _id: false }
);

// Parent (top-level) part. Each parent part can carry any number of
// child parts nested inside it via the `children` array.
const ParentPartSchema = new mongoose.Schema(
  {
    customerPartNo: { type: String },
    customerPartName: { type: String },
    modifiedBOPartNo: { type: String },
    boPartName: { type: String },
    isChildPart: { type: Boolean, default: false },
    children: { type: [ChildPartSchema], default: [] },
  },
  { _id: false }
);

// Single PO / supplier entry — always nested inside the `poDetailsList`
// array on an enquiry. `linkedPartNo` is optional: when set it ties this
// PO/supplier to one specific part (matched against a part's
// `customerPartNo`) for enquiries where different parts are sourced from
// different suppliers; when left blank the PO applies to the enquiry as a
// whole (or to all parts).
const PoDetailSchema = new mongoose.Schema(
  {
    supplierName: { type: String },
    poNumber: { type: String },
    dateOfIssue: { type: Date, default: null },
    linkedPartNo: { type: String, default: "" },
  },
  { _id: false }
);

const EnquirySchema = new mongoose.Schema(
  {
    enquiryNumber: { type: String },
    customerName: { type: String },
    customerRFQDate: { type: Date, default: null },
    itemDescription: { type: String },
    partMapping: {
      customerPartNo: { type: String },
      customerPartName: { type: String },
      modifiedBOPartNo: { type: String },
      boPartName: { type: String },
    },

    // NEW: supports multiple parent parts, each with multiple nested child
    // parts, for a single enquiry. `partMapping` above is left completely
    // untouched for backward compatibility — it continues to mirror the
    // first parent part so existing search/list/stats/table code keeps
    // working exactly as before, even for records created before this
    // change (which will simply have an empty/missing `parts` array).
    parts: { type: [ParentPartSchema], default: [] },

    poDetails: {
      supplierName: { type: String },
      poNumber: { type: String },
      dateOfIssue: { type: Date, default: null },
    },

    // NEW: supports multiple PO / supplier entries for a single enquiry —
    // e.g. two parts sourced from three different suppliers. `poDetails`
    // above is left completely untouched for backward compatibility, and
    // continues to mirror the first PO entry so existing search/list/
    // stats/table code keeps working exactly as before, even for records
    // created before this change (which will simply have an empty/missing
    // `poDetailsList` array).
    poDetailsList: { type: [PoDetailSchema], default: [] },

    generatedBy: { type: String, default: "System" },

    editHistory: [
      {
        section: { type: String },
        sectionColor: { type: String },
        description: { type: String },
        user: { type: String },
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.Enquiry ||
  mongoose.model("Enquiry", EnquirySchema);
