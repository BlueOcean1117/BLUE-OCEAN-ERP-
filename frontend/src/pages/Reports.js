import React from "react";
import API from "../services/api";
import "./Reports.css";

export default function Reports() {
  const currentDate = new Date();
  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();

  const downloadMonthlyCSV = () => {
    // call api which will download the file
  };

  const downloadYearlyExcel = () => {
    // call api which will download the file
  };

  return (
    <div className="reports-page">
      <div className="reports-header">
        <h2>Reports Dashboard</h2>
        <p>
          Access monthly, yearly, vendor, and customer reports. Use quick export
          buttons below for immediate downloads.
        </p>
      </div>

      <div className="reports-actions">
        <button className="btn primary" onClick={downloadMonthlyCSV}>
          📄 Export Monthly CSV
        </button>

        <button className="btn secondary" onClick={downloadYearlyExcel}>
          📊 Export Yearly CSV
        </button>
      </div>

      <div className="reports-note">
        <p>
          Note: All reports are generated in real-time from the latest data.
        </p>
      </div>
    </div>
  );
}
