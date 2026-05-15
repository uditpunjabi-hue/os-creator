'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import {
  Bell,
  Mail,
  Briefcase,
  DollarSign,
  Sparkles,
  Activity,
  Lightbulb,
  Loader2,
  CheckCheck,
} from 'lucide-react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { cn } from '@gitroom/frontend/lib/utils';

type Kind =
  | 'NEW_EMAIL'
  | 'DEAL_DEADLINE'
  | 'PAYMENT_OVERDUE'
  | 'SCRIPT_READY'
  | 'WEEKLY_REPORT_READY'
  | 'POST_MILESTONE'
  | 'IDEAS_REFRESHED'
  | 'SYSTEM';

interface NotificationItem {
  id: string;
  kind: Kind;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

const iconForKind = (k: Kind) => {
  switch (k) {
    case 'NEW_EMAIL':
      return Mail;
    case 'DEAL_DEADLINE':
      return Briefcase;
    case 'PAYMENT_OVERDUE':
      return DollarSign;
    case 'SCRIPT_READY':
      return Sparkles;
    case 'WEEKLY_REPORT_READY':
      return Activity;
    case 'POST_MILESTONE':
      return Activity;
    case 'IDEAS_REFRESHED':
      return Lightbulb;
    default:
      return Bell;
  }
};

const fmtAgo = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString();
};

export function NotificationBell() {
  const fetch = useFetch();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const loader = useCallback(
    async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${url} ${res.status}`);
      return (await res.json()) as { items: NotificationItem[]; unread: number };
    },
    [fetch]
  );

  const { data, mutate, isLoading } = useSWR('/notifications', loader, {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
    dedupingInterval: 30_000,
    keepPreviousData: true,
  });

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const markRead = useCallback(
    async (id: string) => {
      if (data) {
        const next = {
          ...data,
          items: data.items.map((i) => (i.id === id ? { ...i, readAt: new Date().toISOString() } : i)),
          unread: Math.max(0, data.unread - 1),
        };
        await mutate(next, { revalidate: false });
      }
      await fetch(`/notifications/${id}/read`, { method: 'POST' });
    },
    [fetch, data, mutate]
  );

  const markAllRead = useCallback(async () => {
    if (data) {
      const next = {
        ...data,
        items: data.items.map((i) => (i.readAt ? i : { ...i, readAt: new Date().toISOString() })),
        unread: 0,
      };
      await mutate(next, { revalidate: false });
    }
    await fetch('/notifications/mark-all-read', { method: 'POST' });
  }, [fetch, data, mutate]);

  const items = data?.items ?? [];
  const unread = data?.unread ?? 0;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[340px] max-w-[90vw] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          <header className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
            <p className="text-sm font-semibold text-gray-900">Notifications</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </header>
          <div className="max-h-[420px] overflow-y-auto">
            {isLoading && !data ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Bell className="mx-auto mb-2 h-6 w-6 text-gray-300" />
                <p className="text-sm font-medium text-gray-700">All caught up</p>
                <p className="mt-1 text-xs text-gray-500">We&apos;ll ping you when something needs attention.</p>
              </div>
            ) : (
              <ul>
                {items.map((n) => (
                  <NotificationRow
                    key={n.id}
                    n={n}
                    onClick={() => {
                      if (!n.readAt) void markRead(n.id);
                      setOpen(false);
                    }}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationRow({ n, onClick }: { n: NotificationItem; onClick: () => void }) {
  const Icon = iconForKind(n.kind);
  const content = (
    <div
      onClick={onClick}
      className={cn(
        'flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-gray-50',
        !n.readAt && 'bg-purple-50/40'
      )}
    >
      <span
        className={cn(
          'mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
          !n.readAt ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm', !n.readAt ? 'font-semibold text-gray-900' : 'font-medium text-gray-800')}>
          {n.title}
        </p>
        {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{n.body}</p>}
        <p className="mt-1 text-[10px] uppercase tracking-wide text-gray-400">{fmtAgo(n.createdAt)}</p>
      </div>
      {!n.readAt && <span className="mt-2 inline-block h-2 w-2 shrink-0 rounded-full bg-purple-500" />}
    </div>
  );
  return (
    <li>
      {n.link ? (
        <Link href={n.link} className="block">
          {content}
        </Link>
      ) : (
        content
      )}
    </li>
  );
}
