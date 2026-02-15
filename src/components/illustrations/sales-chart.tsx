import React from 'react';

export const SalesChart = ({ className }: { className?: string }) => {
  return (
    <svg 
      viewBox="0 0 300 120" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Grid Lines */}
      <line x1="0" y1="100" x2="300" y2="100" stroke="#F1F5F9" strokeWidth="1" />
      <line x1="0" y1="60" x2="300" y2="60" stroke="#F1F5F9" strokeWidth="1" strokeDasharray="4 4" />
      <line x1="0" y1="20" x2="300" y2="20" stroke="#F1F5F9" strokeWidth="1" strokeDasharray="4 4" />

      {/* Area Gradient */}
      <defs>
        <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="100">
          <stop offset="0%" stopColor="#00BFA5" stopOpacity="0.2"/>
          <stop offset="100%" stopColor="#00BFA5" stopOpacity="0"/>
        </linearGradient>
      </defs>

      {/* Chart Line & Area */}
      <path 
        d="M0 80 C40 80, 60 40, 100 50 C140 60, 160 90, 200 70 C240 50, 260 20, 300 30 V 100 H 0 Z" 
        fill="url(#salesGradient)" 
      />
      <path 
        d="M0 80 C40 80, 60 40, 100 50 C140 60, 160 90, 200 70 C240 50, 260 20, 300 30" 
        stroke="#00BFA5" 
        strokeWidth="3" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />

      {/* Data Points */}
      <circle cx="100" cy="50" r="4" fill="white" stroke="#00BFA5" strokeWidth="2" />
      <circle cx="200" cy="70" r="4" fill="white" stroke="#00BFA5" strokeWidth="2" />
      <circle cx="300" cy="30" r="4" fill="white" stroke="#00BFA5" strokeWidth="2" />
    </svg>
  );
};
