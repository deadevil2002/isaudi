import React from 'react';

export const CompetitorChart = ({ className }: { className?: string }) => {
  return (
    <svg 
      viewBox="0 0 200 160" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Background Grid (Radar) */}
      <path d="M100 20 L170 60 L170 120 L100 160 L30 120 L30 60 Z" stroke="#E2E8F0" strokeWidth="1" fill="none"/>
      <path d="M100 45 L145 70 L145 110 L100 135 L55 110 L55 70 Z" stroke="#E2E8F0" strokeWidth="1" fill="none"/>
      <path d="M100 70 L120 80 L120 100 L100 110 L80 100 L80 80 Z" stroke="#E2E8F0" strokeWidth="1" fill="none"/>
      
      {/* Axis Lines */}
      <path d="M100 20 L100 160" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4 4"/>
      <path d="M30 60 L170 120" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4 4"/>
      <path d="M170 60 L30 120" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4 4"/>

      {/* Competitor Data (Gray) */}
      <path 
        d="M100 30 L160 65 L150 125 L100 140 L40 115 L50 55 Z" 
        fill="#94A3B8" 
        fillOpacity="0.1" 
        stroke="#94A3B8" 
        strokeWidth="2"
      />
      
      {/* Your Store Data (Green) */}
      <path 
        d="M100 50 L135 75 L160 110 L100 125 L60 105 L40 70 Z" 
        fill="#00BFA5" 
        fillOpacity="0.2" 
        stroke="#00BFA5" 
        strokeWidth="2"
      />

      {/* Dots */}
      <circle cx="100" cy="50" r="3" fill="#00BFA5" />
      <circle cx="135" cy="75" r="3" fill="#00BFA5" />
      <circle cx="160" cy="110" r="3" fill="#00BFA5" />
      <circle cx="100" cy="125" r="3" fill="#00BFA5" />
      <circle cx="60" cy="105" r="3" fill="#00BFA5" />
      <circle cx="40" cy="70" r="3" fill="#00BFA5" />
    </svg>
  );
};
