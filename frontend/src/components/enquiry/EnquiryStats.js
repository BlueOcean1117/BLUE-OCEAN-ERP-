import React from "react";

export default function EnquiryStats({ stats }) {
  const cards = [
    {
      label: "Total Enquiries",
      value: stats.totalEnquiries || 0,
      color: "blue",
      icon: "📋",
    },
    {
      label: "Active POs",
      value: stats.activePOs || 0,
      color: "green",
      icon: "📦",
    },
    {
      label: "Part Mappings",
      value: stats.partMappings || 0,
      color: "purple",
      icon: "🔗",
    },
    {
      label: "Active Suppliers",
      value: stats.activeSuppliers || 0,
      color: "orange",
      icon: "🏭",
    },
  ];

  return (
    <div className="enquiry-stats">
      {cards.map((card) => (
        <div key={card.label} className={`enquiry-stat-card ${card.color}`}>
          <div className="stat-card-info">
            <label>{card.label}</label>
            <div className="stat-number">{card.value}</div>
          </div>
          <div className={`stat-card-icon ${card.color}`}>{card.icon}</div>
        </div>
      ))}
    </div>
  );
}
