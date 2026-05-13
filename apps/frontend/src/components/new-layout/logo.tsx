'use client';

import Image from 'next/image';

/**
 * The real Illuminati brand mark (gold eye + pyramid on black) — served from
 * /illuminati-logo.png in apps/frontend/public.
 */
export const Logo = ({ size = 60 }: { size?: number }) => {
  return (
    <Image
      src="/illuminati-logo.png"
      alt="Illuminati"
      width={size}
      height={size}
      priority
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
      }}
    />
  );
};
