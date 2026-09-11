import React from "react";

export function PillarLogoIcon({ className = "w-7 h-7 text-[#2C1B14]" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Roof / Pediment */}
      <path
        d="M3 10L16 3L29 10H3Z"
        fill="currentColor"
      />
      <rect x="2" y="10.5" width="28" height="2" rx="0.5" fill="currentColor" />
      {/* 4 Pillars */}
      <rect x="5.5" y="13.5" width="3" height="12" rx="0.5" fill="currentColor" />
      <rect x="11.5" y="13.5" width="3" height="12" rx="0.5" fill="currentColor" />
      <rect x="17.5" y="13.5" width="3" height="12" rx="0.5" fill="currentColor" />
      <rect x="23.5" y="13.5" width="3" height="12" rx="0.5" fill="currentColor" />
      {/* Base */}
      <rect x="3" y="26" width="26" height="2.5" rx="0.5" fill="currentColor" />
      <rect x="1.5" y="28.8" width="29" height="1.8" rx="0.5" fill="currentColor" />
    </svg>
  );
}

export function AshokaEmblemIcon({ className = "w-9 h-11 text-stone-700" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 50"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Central Lion Head & Mane */}
      <path
        d="M20 5C17.5 5 15.8 6.5 15.5 8.5C14.2 9.2 13.5 10.8 13.8 12.5C14 13.8 14.8 14.8 15.8 15.3C15.5 16.5 16 18.2 17.2 19.2C18.2 20 19.5 20.3 20 20.3C20.5 20.3 21.8 20 22.8 19.2C24 18.2 24.5 16.5 24.2 15.3C25.2 14.8 26 13.8 26.2 12.5C26.5 10.8 25.8 9.2 24.5 8.5C24.2 6.5 22.5 5 20 5Z"
        fill="currentColor"
        opacity="0.85"
      />
      {/* Left Lion Head outline */}
      <path
        d="M13.5 9C12 9.5 10.5 11 10.8 13C11 14.2 11.8 15 12.8 15.5C12.5 16.8 13 18.5 14.5 19.5C15.5 20.2 16.5 20.5 17 20.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.75"
      />
      {/* Right Lion Head outline */}
      <path
        d="M26.5 9C28 9.5 29.5 11 29.2 13C29 14.2 28.2 15 27.2 15.5C27.5 16.8 27 18.5 25.5 19.5C24.5 20.2 23.5 20.5 23 20.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.75"
      />
      {/* Center Crown / Mane detail */}
      <circle cx="20" cy="11.5" r="1.5" fill="#FAF8F5" />
      <path d="M18.5 14.5C19 15.2 21 15.2 21.5 14.5" stroke="#FAF8F5" strokeWidth="1" strokeLinecap="round" />
      {/* Abacus Base Profile */}
      <path
        d="M11 21C11 21 15 23.5 20 23.5C25 23.5 29 21 29 21L28 26.5C28 26.5 24.5 28 20 28C15.5 28 12 26.5 12 26.5L11 21Z"
        fill="currentColor"
        opacity="0.85"
      />
      {/* Ashoka Chakra in Center */}
      <circle cx="20" cy="25" r="3.2" stroke="#FAF8F5" strokeWidth="0.8" fill="currentColor" />
      <circle cx="20" cy="25" r="1.2" fill="#FAF8F5" />
      <line x1="20" y1="22" x2="20" y2="28" stroke="#FAF8F5" strokeWidth="0.5" />
      <line x1="17" y1="25" x2="23" y2="25" stroke="#FAF8F5" strokeWidth="0.5" />
      <line x1="17.8" y1="22.8" x2="22.2" y2="27.2" stroke="#FAF8F5" strokeWidth="0.5" />
      <line x1="22.2" y1="22.8" x2="17.8" y2="27.2" stroke="#FAF8F5" strokeWidth="0.5" />
      {/* Bull on left, Horse on right representations */}
      <circle cx="14" cy="24.5" r="1" fill="#FAF8F5" opacity="0.8" />
      <circle cx="26" cy="24.5" r="1" fill="#FAF8F5" opacity="0.8" />
      {/* Bell lotus pedestal */}
      <path
        d="M12.5 28.5C12.5 28.5 14 34 20 34C26 34 27.5 28.5 27.5 28.5L29 36H11L12.5 28.5Z"
        fill="currentColor"
        opacity="0.75"
      />
      {/* Base Plinth */}
      <rect x="8" y="36.5" width="24" height="2" rx="0.5" fill="currentColor" opacity="0.9" />
      <rect x="6" y="39.5" width="28" height="2" rx="0.5" fill="currentColor" opacity="0.9" />
      {/* Devanagari Satyameva Jayate motif hint */}
      <text
        x="20"
        y="46"
        textAnchor="middle"
        fontSize="4.5"
        fontWeight="bold"
        fill="currentColor"
        opacity="0.85"
        fontFamily="serif"
      >
        सत्यमेव जयते
      </text>
    </svg>
  );
}
