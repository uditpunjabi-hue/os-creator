'use client';

import Link from 'next/link';
import { User2 } from 'lucide-react';
import { useManagerProfile } from '@gitroom/frontend/hooks/manager';

/**
 * Profile avatar in the header — tapping it routes to Settings → Profile.
 * Falls back to a generic icon when the user has no profile pic yet (fresh
 * IG signup before profilePic is populated, or Google-only signup).
 */
export function HeaderAvatar() {
  const { data } = useManagerProfile();
  const handle = data?.connections.instagram.handle ?? null;
  const initial = (data?.name ?? handle ?? data?.email ?? '?').replace(/^@/, '').charAt(0).toUpperCase();
  return (
    <Link
      href="/manager/settings"
      aria-label="Open settings"
      className="group inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-purple-100 transition-shadow hover:ring-purple-300"
    >
      {/* No profile-pic field comes back from /manager/settings/profile yet,
          so we render a gradient pill with the initial. The clickable target
          is what matters — the visual will catch up when the IG-profilePic
          column is exposed. */}
      <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500 text-xs font-bold text-white">
        {initial && initial !== '?' ? initial : <User2 className="h-4 w-4" />}
      </span>
    </Link>
  );
}
