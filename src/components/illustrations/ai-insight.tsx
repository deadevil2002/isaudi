import React from 'react';

export const AiInsight = ({ className }: { className?: string }) => {
  return (
    <svg 
      viewBox="0 0 400 60" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Container Background */}
      <rect width="400" height="60" rx="8" fill="#F0FDF4" stroke="#DCFCE7" />

      {/* AI Icon / Sparkles */}
      <circle cx="30" cy="30" r="16" fill="#DCFCE7" />
      <path d="M30 20L32 26L38 28L32 30L30 36L28 30L22 28L28 26L30 20Z" fill="#00BFA5" />
      
      {/* Text Lines (Skeleton) */}
      <rect x="60" y="20" width="200" height="8" rx="4" fill="#00BFA5" fillOpacity="0.2" />
      <rect x="60" y="34" width="140" height="6" rx="3" fill="#00BFA5" fillOpacity="0.1" />

      {/* Action Button */}
      <rect x="300" y="18" width="80" height="24" rx="12" fill="white" stroke="#00BFA5" strokeOpacity="0.3" />
      <rect x="325" y="27" width="30" height="6" rx="3" fill="#00BFA5" />
    </svg>
  );
};
