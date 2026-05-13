'use client';

import { cn } from '@gitroom/frontend/lib/utils';

/**
 * Shimmering placeholder. Replace any single piece of loading content with
 * one or more <Skeleton/> blocks sized to match the eventual layout.
 *
 *   <Skeleton className="h-4 w-32" />
 *   <Skeleton className="h-24 w-full" />
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('illum-skeleton', className)} />;
}

/**
 * Stat-tile skeleton — same dimensions as the live metric cards on
 * Profile / Analytics.
 */
export function SkeletonStat() {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-4">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-7 w-24" />
      <Skeleton className="h-3 w-28" />
    </div>
  );
}

/**
 * List-item skeleton — for thread rows, deal cards, scheduled posts, etc.
 */
export function SkeletonRow() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}

/**
 * Grid of stat tiles — used at the top of Profile / Analytics.
 */
export function SkeletonStatGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonStat key={i} />
      ))}
    </div>
  );
}

/**
 * List of N row skeletons.
 */
export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <ul className="flex flex-col gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i}>
          <SkeletonRow />
        </li>
      ))}
    </ul>
  );
}
