const express = require("express");
const { optionalAuth } = require("../middleware/auth"); 
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

router.post("/create", optionalAuth, createEnquiry);
router.get("/stats", getEnquiryStats);
router.get("/filters", getFilterOptions);
router.put("/update/:id", optionalAuth, updateEnquiry);   // only PUT is registered
router.get("/:id", getEnquiryById);                        // GET only works on /enquiry/:id (no "update")
router.delete("/delete/:id", deleteEnquiry);
router.get("/", getAllEnquiries);

module.exports = router;
