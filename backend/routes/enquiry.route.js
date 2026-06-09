const express = require("express");
const {
  createEnquiry,
  getAllEnquiries,
  getEnquiryStats,
  getFilterOptions,
  getEnquiryById,
  updateEnquiry,
  deleteEnquiry,
} = require("../controllers/enquiry.controller");

const router = express.Router();

router.post("/create", createEnquiry);
router.get("/stats", getEnquiryStats);
router.get("/filters", getFilterOptions);
router.get("/:id", getEnquiryById);
router.put("/update/:id", updateEnquiry);
router.delete("/delete/:id", deleteEnquiry);
router.get("/", getAllEnquiries);

module.exports = router;
