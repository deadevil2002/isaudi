import React from 'react';

export const CompetitorTable = ({ className }: { className?: string }) => {
  return (
    <svg 
      viewBox="0 0 240 160" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Background / Card Shape */}
      <rect x="0" y="0" width="240" height="160" rx="8" fill="white" />
      
      {/* Header */}
      <rect x="10" y="15" width="220" height="24" rx="4" fill="#F8FAFC" />
      <rect x="25" y="24" width="60" height="6" rx="3" fill="#E2E8F0" />
      <rect x="120" y="24" width="40" height="6" rx="3" fill="#E2E8F0" />
      <rect x="180" y="24" width="30" height="6" rx="3" fill="#E2E8F0" />

      {/* Row 1: Competitor (Gray) */}
      <circle cx="25" cy="60" r="10" fill="#F1F5F9" />
      <rect x="45" y="56" width="60" height="8" rx="4" fill="#F1F5F9" />
      <rect x="120" y="56" width="35" height="8" rx="4" fill="#F1F5F9" />
      <rect x="180" y="56" width="25" height="8" rx="4" fill="#F1F5F9" />

      {/* Row 2: Competitor (Gray) */}
      <circle cx="25" cy="95" r="10" fill="#F1F5F9" />
      <rect x="45" y="91" width="50" height="8" rx="4" fill="#F1F5F9" />
      <rect x="120" y="91" width="30" height="8" rx="4" fill="#F1F5F9" />
      <rect x="180" y="91" width="20" height="8" rx="4" fill="#F1F5F9" />

      {/* Row 3: You (Green Highlight) */}
      <rect x="10" y="115" width="220" height="40" rx="6" fill="#F0FDF4" stroke="#DCFCE7" />
      <circle cx="25" cy="135" r="10" fill="#00BFA5" />
      <rect x="45" y="131" width="70" height="8" rx="4" fill="#00BFA5" fillOpacity="0.8" />
      <rect x="120" y="131" width="40" height="8" rx="4" fill="#00BFA5" fillOpacity="0.2" />
      
      {/* Trend Arrow Up */}
      <path d="M185 138 L190 132 L195 138" stroke="#00BFA5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M190 132 L190 142" stroke="#00BFA5" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
};
