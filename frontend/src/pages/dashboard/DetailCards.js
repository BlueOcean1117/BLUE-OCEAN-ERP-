// frontend/src/pages/dashboard/DetailCards.js
import React from "react";

function DetailList({ title, items }) {
  const total = items.reduce((s, i) => s + i.count, 0);
  return (
    <div className="detail-card">
      <h4>{title}</h4>
      {items.length === 0 ? (
        <div className="detail-empty">No data available</div>
      ) : (
        <ul className="detail-list">
          {items.map((i) => (
            <li key={i.label} className="detail-item">
              <span className="detail-label" title={i.label}>{i.label}</span>
              <span className="detail-bar-track">
                <span className="detail-bar-fill" style={{ width: `${total ? (i.count / total) * 100 : 0}%` }} />
              </span>
              <span className="detail-value">{i.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DetailUntracked({ title, note }) {
  return (
    <div className="detail-card">
      <h4>{title}</h4>
      <div className="detail-empty detail-empty-untracked">{note}</div>
    </div>
  );
}

export default function DetailCards({ detailCards }) {
  return (
    <div className="detail-grid">
      <DetailList title="Shipments by Customer" items={detailCards.byCustomer} />
      <DetailUntracked title="Shipments by Destination" note="Destination isn't captured in the Shipment module yet (only Port of Loading / Origin is tracked)" />
      <DetailList title="Shipments by Supplier" items={detailCards.bySupplier} />
      <DetailList title="Shipments by Month" items={detailCards.byMonth} />
      <DetailList title="Shipments by Delivery Status" items={detailCards.byDeliveryStatus} />
      <DetailUntracked title="Shipments by Payment Status" note="Payment status isn't captured in the Shipment module yet" />
    </div>
  );
}
