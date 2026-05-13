'use client';

export const Logo = ({ size = 60 }: { size?: number }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="illum-pyramid" x1="32" y1="6" x2="32" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#A78BFA" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
        <radialGradient id="illum-iris" cx="32" cy="40" r="10" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#F59E0B" />
          <stop offset="1" stopColor="#7C3AED" />
        </radialGradient>
      </defs>
      <path d="M32 5 L60 58 L4 58 Z" fill="url(#illum-pyramid)" />
      <path d="M32 13 L52 53 L12 53 Z" fill="#1A1033" opacity="0.18" />
      <path
        d="M16 40 C 22 32, 42 32, 48 40 C 42 47, 22 47, 16 40 Z"
        fill="#FFFFFF"
      />
      <circle cx="32" cy="40" r="6.5" fill="url(#illum-iris)" />
      <circle cx="32" cy="40" r="2.6" fill="#1A1033" />
      <circle cx="33.5" cy="38.5" r="1" fill="#FFFFFF" />
    </svg>
  );
};
