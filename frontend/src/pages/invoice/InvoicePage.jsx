import React, { useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "react-toastify";
import API from "../../services/api";
import "../../styles/invoice.css";

function createInvoiceNoPreview() {
  const year = new Date().getFullYear();
  const stamp = String(Date.now()).slice(-6);
  return `INV-${year}-${stamp}`;
}

function formatDateInput(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function formatDisplayDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB");
}

function money(value) {
  const number = Number(value) || 0;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number);
}

function integerToWords(value) {
  const number = Math.floor(Math.abs(Number(value) || 0));
  if (number === 0) return "Zero";

  const ones = [
    "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const chunkToWords = (chunk) => {
    let result = "";
    const hundred = Math.floor(chunk / 100);
    const rest = chunk % 100;

    if (hundred) {
      result += `${ones[hundred]} Hundred`;
      if (rest) result += " ";
    }

    if (rest < 20) {
      result += ones[rest];
    } else {
      const ten = Math.floor(rest / 10);
      const one = rest % 10;
      result += tens[ten];
      if (one) result += ` ${ones[one]}`;
    }

    return result.trim();
  };

  const parts = [];
  const scales = [
    { value: 10000000, label: "Crore" },
    { value: 100000, label: "Lakh" },
    { value: 1000, label: "Thousand" },
    { value: 1, label: "" },
  ];

  let remaining = number;
  for (const scale of scales) {
    if (remaining >= scale.value) {
      const chunk = Math.floor(remaining / scale.value);
      remaining %= scale.value;
      const words = chunkToWords(chunk);
      parts.push(scale.label ? `${words} ${scale.label}` : words);
    }
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function amountToWords(amount) {
  const numeric = Number(amount) || 0;
  const rounded = Math.round(numeric * 100) / 100;
  const rupees = Math.floor(rounded);
  const paise = Math.round((rounded - rupees) * 100);

  const rupeeWords = integerToWords(rupees);
  if (!paise) return `${rupeeWords} Dollars Only`;
  return `${rupeeWords} Dollars and ${integerToWords(paise)} Cents Only`;
}

const createBlankRow = () => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  description: "",
  refPartInvNo: "",
  hsnCode: "",
  qty: "",
  unitPrice: "",
  amount: "",
});

const buildRowFromShipment = (item) => {
  const qty = Number(item.qty) || 0;
  const unitPrice = Number(item.unitPrice) || 0;
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    description: item.description || "",
    refPartInvNo: item.refPartInvNo || "",
    hsnCode: item.hsnCode || "",
    qty: item.qty ?? "",
    unitPrice: item.unitPrice ?? "",
    amount: item.amount ?? qty * unitPrice,
  };
};

const STATIC_DECLARATION =
  "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.";

const STATIC_COMPANY_ADDRESS = [
  "Blue Ocean Consulting",
  "Office No. 204, Crystal Tower, Business Bay, Pune - 411001, India",
  "GSTIN: 27AAACB0000A1Z5",
  "Email: accounts@blueoceanconsulting.com",
].join("\n");

const STATIC_BANK_DETAILS = [
  "Bank: HDFC Bank",
  "Account Name: Blue Ocean Consulting",
  "Account No: 012345678901",
  "IFSC: HDFC0000123",
  "Branch: Baner, Pune",
].join("\n");

const MIN_PDF_TABLE_ROWS = 14;
const PDF_GRID_LINE = [54, 54, 54];

const rowHasUserData = (item) => [
  item.description,
  item.refPartInvNo,
  item.hsnCode,
  item.qty,
  item.unitPrice,
].some((value) => String(value ?? "").trim() !== "");

export default function InvoicePage() {
  const [invoiceNo, setInvoiceNo] = useState(createInvoiceNoPreview());
  const [invoiceIssueDate, setInvoiceIssueDate] = useState(formatDateInput());
  const [blNo, setBlNo] = useState("");
  const [billTo, setBillTo] = useState({
    companyName: "",
    address: "",
    contactNumber: "",
  });

  // NEW: Editable labels for the first two reserved lines
  const [serviceChargeLabel, setServiceChargeLabel] = useState("Supply Chain Service Charges");
  const [modeLabel, setModeLabel] = useState("Mode - Sea ; BL No - ");

  const [items, setItems] = useState([createBlankRow()]);
  
  const [savedInvoiceId, setSavedInvoiceId] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [loadingBl, setLoadingBl] = useState(false);
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [sendingInvoice, setSendingInvoice] = useState(false);

  const totalAmount = useMemo(
    () => items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
    [items]
  );

  const totalInWords = useMemo(() => amountToWords(totalAmount), [totalAmount]);

  const updateBillTo = (field, value) => {
    setBillTo((prev) => ({ ...prev, [field]: value }));
  };

  const updateItem = (index, field, value) => {
    setItems((prev) =>
      prev.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        const next = { ...row, [field]: value };
        const qty = Number(next.qty) || 0;
        const unitPrice = Number(next.unitPrice) || 0;
        next.amount = qty * unitPrice;
        return next;
      })
    );
  };

  const addRow = () => setItems((prev) => [...prev, createBlankRow()]);

  const removeRow = (index) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  };

  const lookupShipment = async () => {
    const searchBlNo = blNo.trim();
    if (!searchBlNo) {
      toast.warn("Enter BL No first");
      return;
    }

    setLoadingBl(true);
    try {
      const res = await API.get(`/shipment/by-bl/${encodeURIComponent(searchBlNo)}`);
      const data = res.data || {};

      setBillTo((prev) => ({
        ...prev,
        companyName: data.billTo?.companyName || prev.companyName,
        address: data.billTo?.address || prev.address,
        contactNumber: data.billTo?.contactNumber || prev.contactNumber,
      }));
      setBlNo(data.billTo?.blNo || searchBlNo);
      setModeLabel(`Mode - Sea ; BL No - ${data.billTo?.blNo || searchBlNo}`);

      setRecipientEmail(data.billTo?.recipientEmail || "");

      if (data.invoiceDate) setInvoiceIssueDate(formatDateInput(data.invoiceDate));

      const mappedItems = Array.isArray(data.items) && data.items.length
        ? data.items.map(buildRowFromShipment)
        : [createBlankRow()];
      setItems(mappedItems);
      setSavedInvoiceId("");

      toast.success("Shipment details loaded from BL No");
    } catch (err) {
      const message = err.response?.data?.message || "Shipment not found for this BL No";
      toast.error(message);
    } finally {
      setLoadingBl(false);
    }
  };

  const buildPayload = () => ({
    invoiceNo: "auto",
    invoiceDate: invoiceIssueDate,
    billTo: {
      companyName: billTo.companyName,
      address: billTo.address,
      contactNumber: billTo.contactNumber,
      blNo,
    },
    items: items.map((item) => ({
      description: item.description,
      refPartInvNo: item.refPartInvNo,
      hsnCode: item.hsnCode,
      qty: Number(item.qty) || 0,
      unitPrice: Number(item.unitPrice) || 0,
      amount: Number(item.amount) || 0,
    })),
    totalAmount,
    // Including custom labels in payload for backend storage if supported
    customLabels: { serviceChargeLabel, modeLabel }
  });

  const saveInvoice = async ({ notify = true } = {}) => {
    setSavingInvoice(true);
    try {
      const payload = buildPayload();
      const res = await API.post("/invoice/create", payload);
      setSavedInvoiceId(res.data?._id || "");
      if (res.data?.invoiceNo) setInvoiceNo(res.data.invoiceNo);
      if (notify) {
        const generatedNo = res.data?.invoiceNo || invoiceNo;
        toast.success(`Invoice ${generatedNo} generated successfully`);
      }
      return res.data;
    } catch (err) {
      const message = err.response?.data?.message || "Failed to generate invoice";
      toast.error(message);
      return null;
    } finally {
      setSavingInvoice(false);
    }
  };

const createPdfDocument = (payloadOverride) => {
  const doc = new jsPDF("p", "mm", "a4");
  const payload = payloadOverride || buildPayload();
  const margin = 10;
  const pageWidth = 210;
  const contentWidth = pageWidth - (margin * 2);

  doc.setDrawColor(0);
  doc.setLineWidth(0.1);
  doc.rect(5, 5, 200, 287);

  doc.setFont("times", "bold");
  doc.setFontSize(12);
  doc.text("INVOICE", pageWidth / 2, 15, { align: "center" });
  doc.setFontSize(16);
  doc.text("BLUE OCEAN CONSULTING", pageWidth / 2, 22, { align: "center" });
  doc.setFont("times", "italic");
  doc.setFontSize(10);
  doc.text("“Creating Value”", pageWidth / 2, 27, { align: "center" });

  const detailsY = 35;
  const leftWidth = contentWidth * 0.55; 
  const rightWidth = contentWidth - leftWidth; 
  const rowHeight = 25;

  doc.setLineWidth(0.2); 
  doc.rect(margin, detailsY, leftWidth, rowHeight);
  doc.setFont("times", "bold");
  doc.text("Bill To", margin + (leftWidth / 2), detailsY + 5, { align: "center" });
  doc.setFont("times", "normal");
  doc.setFontSize(9);
  doc.text(payload.billTo.companyName || "", margin + 2, detailsY + 10);
  doc.text(payload.billTo.address || "", margin + 2, detailsY + 14, { maxWidth: leftWidth - 4 });
  doc.text(`Contact: ${payload.billTo.contactNumber || ""}`, margin + 2, detailsY + 22);

  doc.rect(margin + leftWidth, detailsY, rightWidth, rowHeight / 2);
  doc.text("Invoice No :", margin + leftWidth + 2, detailsY + 8);
  doc.text(payload.invoiceNo, margin + contentWidth - 2, detailsY + 8, { align: "right" });

  doc.rect(margin + leftWidth, detailsY + (rowHeight / 2), rightWidth, rowHeight / 2);
  doc.text("Invoice Issue Date :", margin + leftWidth + 2, detailsY + 20);
  doc.text(formatDisplayDate(payload.invoiceDate), margin + contentWidth - 2, detailsY + 20, { align: "right" });

  const summaryTitleY = detailsY + rowHeight;
  doc.rect(margin, summaryTitleY, contentWidth, 7);
  doc.setFont("times", "bold");
  doc.text("Bill Summary", pageWidth / 2, summaryTitleY + 5, { align: "center" });

  autoTable(doc, {
    startY: summaryTitleY + 7,
    head: [["Sr. No", "Description", "Ref Part Inv No", "HSN Code", "Qty (Pcs)", "Unit Price (USD)", "Amount (USD)"]],
    body: [
      // PDF reflects the current editable labels
      [{ content: serviceChargeLabel, colSpan: 7, styles: { fontStyle: "bold" } }],
      [{ content: modeLabel, colSpan: 7 }],
      ...items.map((item, index) => [
        index + 1, item.description, item.refPartInvNo, item.hsnCode || " ", item.qty, money(item.unitPrice), money(item.amount)
      ])
    ],
    theme: "grid",
    styles: { font: "times", fontSize: 8, textColor: 0, lineColor: 0, lineWidth: 0.1 },
    headStyles: { fillColor: 255, textColor: 0, fontStyle: "bold", halign: "center" },
    margin: { left: margin, right: margin }
  });

  let finalY = doc.lastAutoTable.finalY;

  doc.rect(margin, finalY, contentWidth, 8);
  doc.setFont("times", "bold");
  doc.text("Total Amount:", margin + 2, finalY + 5);
  doc.text(`USD ${money(payload.totalAmount)}`, margin + contentWidth - 2, finalY + 5, { align: "right" });

  finalY += 8;
  doc.rect(margin, finalY, contentWidth, 8);
  doc.text(`In Words: ${totalInWords}`, margin + 2, finalY + 5.5);

  finalY += 8;
  doc.rect(margin, finalY, contentWidth, 18);
  doc.setFont("times", "italic");
  doc.setFontSize(8);
  const declarationText = [
    "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.",
    "Supply is under Letter of Undertaking without payment of Integrated tax.",
    "ARN: AD2703261241089; LUT Date of Filing - 31st March 2026"
  ];
  doc.text(declarationText, pageWidth / 2, finalY + 5, { align: "center", lineHeightFactor: 1.2 });

  finalY += 18;
  doc.rect(margin, finalY, contentWidth, 8);
  doc.setFont("times", "normal");
  doc.text("This is a system generated invoice and doesn’t require any seal or signature", pageWidth / 2, finalY + 5.5, { align: "center" });

  finalY += 8;
  doc.rect(margin, finalY, contentWidth, 12);
  doc.setFont("times", "bold");
  doc.text("Address: Office No.:207, 2nd Floor, Transbay Complex, Balewadi, Pune - 411045", pageWidth / 2, finalY + 5, { align: "center" });
  doc.setFont("times", "normal");
  doc.text("Ph: +91-9753210294 | Email: operations@blueocean.org.in | GST: 27AXGPG2997R1ZJ", pageWidth / 2, finalY + 9, { align: "center" });

  finalY += 12;
  doc.rect(margin, finalY, contentWidth, 15);
  doc.setFontSize(8);
  const bankInfo = "Bank: ICICI Bank | Branch: Bund Garden | A/C Name: Blue Ocean Consulting | A/C No: 000505025304\nSWIFT: ICICINBBCTS | IFSC: ICIC0000005";
  doc.text(bankInfo, pageWidth / 2, finalY + 6, { align: "center" });

  return { doc, payload };
};

  const openInvoicePreviewPopup = (payloadOverride, existingWindow = null) => {
    const { doc, payload } = createPdfDocument(payloadOverride);
    const blobUrl = doc.output("bloburl");

    const popup = existingWindow || window.open(blobUrl, "_blank", "width=980,height=760");
    if (popup) {
      if (existingWindow) {
        popup.location.href = blobUrl;
      }
      if (typeof popup.focus === "function") popup.focus();
      return payload.invoiceNo || "";
    }

    toast.warn("Invoice generated, but popup was blocked by the browser.");
    return payload.invoiceNo || "";
  };

  const downloadPdf = () => {
    const { doc, payload } = createPdfDocument();
    doc.save(`${payload.invoiceNo || "invoice"}.pdf`);
  };

  const handleGenerateInvoice = async () => {
    const previewWindow = window.open("", "_blank", "width=980,height=760");
    const saved = await saveInvoice({ notify: false });
    if (!saved) {
      if (previewWindow && !previewWindow.closed) previewWindow.close();
      return;
    }

    const payload = buildPayload();
    payload.invoiceNo = saved.invoiceNo || payload.invoiceNo;
    const generatedNo = openInvoicePreviewPopup(payload, previewWindow);
    toast.success(`Invoice ${generatedNo || payload.invoiceNo} generated and opened in popup`);
  };

  const handleSendInvoice = async () => {
    setSendingInvoice(true);
    try {
      let invoiceId = savedInvoiceId;
      if (!invoiceId) {
        const saved = await saveInvoice();
        invoiceId = saved?._id || "";
      }

      if (!invoiceId) return;

      const email = recipientEmail || window.prompt("Enter recipient email to send the invoice");
      if (!email) {
        toast.warn("Recipient email is required to send the invoice");
        return;
      }

      await API.post(`/invoice/send/${invoiceId}`, { to: email });
      toast.success("Invoice sent successfully");
    } catch (err) {
      const message = err.response?.data?.message || "Failed to send invoice";
      toast.error(message);
    } finally {
      setSendingInvoice(false);
    }
  };

  const handleReset = () => {
    setInvoiceNo(createInvoiceNoPreview());
    setInvoiceIssueDate(formatDateInput());
    setBillTo({
      companyName: "",
      address: "",
      contactNumber: "",
    });
    setBlNo("");
    setServiceChargeLabel("Supply Chain Service Charges");
    setModeLabel("Mode - Sea ; BL No - ");
    setItems([createBlankRow()]);
    setSavedInvoiceId("");
    setRecipientEmail("");
  };

  return (
    <div className="invoice-page">
      <div className="invoice-shell">
        <div className="invoice-top">
          <div className="invoice-title-block">
            <div className="invoice-title">INVOICE</div>
            <div className="invoice-brand-row">
              <div className="invoice-brand-mark">BO</div>
              <div className="invoice-brand-copy">
                <div className="invoice-company">BLUE OCEAN CONSULTING</div>
                <div className="invoice-subtitle">“Creating Value”</div>
              </div>
            </div>
          </div>

          <div className="invoice-meta-card">
            <div className="meta-row">
              <span>Invoice No</span>
              <strong>{invoiceNo}</strong>
            </div>
            <div className="meta-row">
              <span>Invoice Issue Date</span>
              <strong>{formatDisplayDate(invoiceIssueDate)}</strong>
            </div>
          </div>
        </div>

        <div className="invoice-grid">
          <section className="invoice-card">
            <div className="card-heading">Bill To</div>
            <div className="field-grid two-up">
              <div className="invoice-field">
                <label>Company Name</label>
                <input
                  type="text"
                  value={billTo.companyName}
                  onChange={(e) => updateBillTo("companyName", e.target.value)}
                  placeholder="Company Name"
                />
              </div>
              <div className="invoice-field">
                <label>Contact Number</label>
                <input
                  type="text"
                  value={billTo.contactNumber}
                  onChange={(e) => updateBillTo("contactNumber", e.target.value)}
                  placeholder="Contact Number"
                />
              </div>
            </div>
            <div className="invoice-field">
              <label>Address</label>
              <textarea
                value={billTo.address}
                onChange={(e) => updateBillTo("address", e.target.value)}
                placeholder="Address"
                rows={3}
              />
            </div>
          </section>
        </div>

        <section className="invoice-card invoice-bl-card">
          <div className="card-heading">BL No</div>
          <div className="bill-search-row">
            <div className="invoice-field grow">
              <label>BL No (Search / Manual)</label>
              <input
                type="text"
                value={blNo}
                onChange={(e) => {
                   setBlNo(e.target.value);
                   // Dynamically update the mode line label as you type
                   setModeLabel(`Mode - Sea ; BL No - ${e.target.value}`);
                }}
                onKeyDown={(e) => e.key === "Enter" && lookupShipment()}
                placeholder="Enter BL number"
              />
            </div>
            <button className="invoice-btn secondary" onClick={lookupShipment} disabled={loadingBl}>
              {loadingBl ? "Searching..." : "Search"}
            </button>
          </div>
        </section>

        <section className="invoice-card invoice-table-card">
          <div className="section-topbar">
            <div>
              <div className="card-heading">Bill Summary</div>
            </div>
            <button className="invoice-btn add" onClick={addRow}>+ Add Row</button>
          </div>

          <div className="table-wrap invoice-table-wrap">
            <table className="invoice-table">
              <thead>
                <tr>
                  <th>Sr No</th>
                  <th>Description</th>
                  <th>Ref Part Inv No</th>
                  <th>HSN Code</th>
                  <th>Qty (Pcs)</th>
                  <th>Unit Price (USD)</th>
                  <th>Amount (USD)</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {/* Editable Line 1: Service Charges */}
                <tr>
                  <td></td>
                  <td colSpan={6}>
                    <input 
                      type="text" 
                      value={serviceChargeLabel} 
                      onChange={(e) => setServiceChargeLabel(e.target.value)}
                      className="label-edit-input"
                      style={{ fontWeight: "bold", width: "100%", border: "none", outline: "none", background: "transparent" }}
                    />
                  </td>
                  <td></td>
                </tr>
                {/* Editable Line 2: Mode/BL Info */}
                <tr>
                  <td></td>
                  <td colSpan={6}>
                    <input 
                      type="text" 
                      value={modeLabel} 
                      onChange={(e) => setModeLabel(e.target.value)}
                      className="label-edit-input"
                      style={{ width: "100%", border: "none", outline: "none", background: "transparent" }}
                    />
                  </td>
                  <td></td>
                </tr>

                {/* User Input Rows (Starting Sr No from 1) */}
                {items.map((item, index) => (
                  <tr key={item.id}>
                    <td>{index + 1}</td>
                    <td>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateItem(index, "description", e.target.value)}
                        placeholder="Description"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={item.refPartInvNo}
                        onChange={(e) => updateItem(index, "refPartInvNo", e.target.value)}
                        placeholder="Ref Part Inv No"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={item.hsnCode}
                        onChange={(e) => updateItem(index, "hsnCode", e.target.value)}
                        placeholder="HSN"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        value={item.qty}
                        onChange={(e) => updateItem(index, "qty", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(index, "unitPrice", e.target.value)}
                      />
                    </td>
                    <td>
                      <input type="text" value={money(item.amount)} readOnly />
                    </td>
                    <td>
                      <button
                        className="row-delete"
                        onClick={() => removeRow(index)}
                        disabled={items.length === 1}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="invoice-total-row">
          <aside className="invoice-summary-card">
            <div className="card-heading">Total Amount</div>
            <div className="total-value">USD {money(totalAmount)}</div>
            <div className="total-words">{totalInWords}</div>
          </aside>
        </div>

        <div className="invoice-lower-grid">
          <section className="invoice-card">
            <div className="card-heading">Declaration</div>
            <p className="static-copy">{STATIC_DECLARATION}</p>
          </section>
          <section className="invoice-card">
            <div className="card-heading">Company Address</div>
            <pre className="static-pre">{STATIC_COMPANY_ADDRESS}</pre>
          </section>
          <section className="invoice-card">
            <div className="card-heading">Bank Details</div>
            <pre className="static-pre">{STATIC_BANK_DETAILS}</pre>
          </section>
        </div>

        <div className="invoice-actions">
          <button className="invoice-btn primary" onClick={handleGenerateInvoice} disabled={savingInvoice}>
            {savingInvoice ? "Generating..." : "Generate Invoice"}
          </button>
          <button className="invoice-btn dark" onClick={downloadPdf}>Download PDF</button>
          <button className="invoice-btn secondary" onClick={handleSendInvoice} disabled={sendingInvoice}>
            {sendingInvoice ? "Sending..." : "Send Invoice"}
          </button>
          <button className="invoice-btn light" onClick={handleReset}>Reset Form</button>
        </div>
      </div>
    </div>
  );
}