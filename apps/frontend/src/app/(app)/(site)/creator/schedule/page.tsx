'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  GripVertical,
  Sparkles,
  Plus,
  Instagram,
  Music2,
  Loader2,
} from 'lucide-react';
import { Button } from '@gitroom/frontend/components/shadcn/ui/button';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { cn } from '@gitroom/frontend/lib/utils';

type Platform = 'instagram' | 'tiktok' | 'youtube' | 'linkedin' | 'x';
type Status = 'SCHEDULED' | 'DRAFT' | 'PUBLISHED' | 'FAILED';
type Source = 'POST' | 'CALENDAR';

interface SchedItem {
  id: string;
  title: string;
  format: string;
  status: Status;
  source: Source;
  platforms: Platform[];
  scheduledAt: Date;
}

interface QueueItem {
  id: string;
  title: string;
  format: string;
}

const fmtTime = (d: Date) =>
  d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const fmtDay = (d: Date) =>
  d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const statusMeta: Record<Status, { chipClass: string; barClass: string }> = {
  SCHEDULED: { chipClass: 'bg-purple-100 text-purple-700', barClass: 'border-purple-300 bg-purple-50' },
  DRAFT: { chipClass: 'bg-gray-100 text-gray-700', barClass: 'border-gray-200 bg-white' },
  PUBLISHED: { chipClass: 'bg-blue-100 text-blue-700', barClass: 'border-blue-200 bg-blue-50/60' },
  FAILED: { chipClass: 'bg-rose-100 text-rose-700', barClass: 'border-rose-200 bg-rose-50/60' },
};

const sourceMeta: Record<Source, { dot: string }> = {
  POST: { dot: 'bg-purple-500' },
  CALENDAR: { dot: 'bg-amber-500' }, // gold for Google Calendar events
};

const today = new Date();
today.setHours(0, 0, 0, 0);

export default function SchedulePage() {
  const fetch = useFetch();
  const [view, setView] = useState<'WEEK' | 'MONTH'>('WEEK');
  const [cursor, setCursor] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [items, setItems] = useState<SchedItem[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const [sRes, cRes] = await Promise.all([
        fetch('/creator/schedule'),
        fetch('/creator/content-pieces'),
      ]);
      const merged: SchedItem[] = [];
      if (sRes.ok) {
        const data = (await sRes.json()) as {
          posts: Array<{
            id: string;
            caption: string;
            kind: string;
            status: Status;
            platforms: string[];
            scheduledAt: string;
          }>;
          events: Array<{
            id: string;
            title: string;
            startsAt: string;
            kind: string;
          }>;
        };
        for (const p of data.posts) {
          merged.push({
            id: `post-${p.id}`,
            title: p.caption.slice(0, 80),
            format:
              p.kind === 'REEL'
                ? 'Reel'
                : p.kind === 'CAROUSEL'
                ? 'Carousel'
                : p.kind === 'STORY'
                ? 'Story'
                : 'Image',
            status: p.status,
            source: 'POST',
            platforms: (p.platforms || []) as Platform[],
            scheduledAt: new Date(p.scheduledAt),
          });
        }
        for (const e of data.events) {
          merged.push({
            id: `cal-${e.id}`,
            title: e.title,
            format: 'Calendar',
            status: 'SCHEDULED',
            source: 'CALENDAR',
            platforms: [],
            scheduledAt: new Date(e.startsAt),
          });
        }
      }
      setItems(merged);

      if (cRes.ok) {
        const pieces = (await cRes.json()) as Array<{
          id: string;
          title: string;
          format: string;
          status: string;
        }>;
        setQueue(
          pieces
            .filter((p) => p.status === 'READY')
            .map((p) => ({ id: p.id, title: p.title, format: p.format }))
        );
      }
    } finally {
      setLoading(false);
    }
  }, [fetch]);

  useEffect(() => {
    reload();
  }, [reload]);

  const weekDays = useMemo(() => {
    const start = new Date(cursor);
    start.setDate(start.getDate() - start.getDay()); // Sunday start
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursor]);

  const upcoming = useMemo(
    () =>
      items
        .filter((i) => i.status !== 'PUBLISHED' && i.scheduledAt >= today)
        .sort((a, b) => +a.scheduledAt - +b.scheduledAt),
    [items]
  );

  const move = (id: string, dir: -1 | 1) => {
    setQueue((q) => {
      const i = q.findIndex((x) => x.id === id);
      if (i < 0) return q;
      const j = i + dir;
      if (j < 0 || j >= q.length) return q;
      const next = [...q];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  return (
    <div className="flex h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="flex items-start justify-between gap-2 px-4 py-3 lg:px-8 lg:py-5">
          <div className="min-w-0">
            <div className="text-lg font-semibold text-gray-900">Schedule</div>
            <div className="truncate text-xs text-gray-500">
              {upcoming.length} upcoming · synced to Google Calendar
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href="/creator/analytics"
              className="hidden h-9 items-center rounded-full border border-gray-200 px-3 text-xs font-medium text-gray-600 hover:border-gray-300 hover:text-gray-900 sm:inline-flex"
            >
              View analytics →
            </a>
            <Button className="h-11">
              <Plus className="h-4 w-4" /> Schedule
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 px-4 pb-3 lg:px-8">
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                const d = new Date(cursor);
                d.setDate(d.getDate() - 7);
                setCursor(d);
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
              aria-label="Previous week"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="min-w-[140px] text-center text-sm font-medium text-gray-900">
              {weekDays[0].toLocaleDateString([], { month: 'short', day: 'numeric' })} —{' '}
              {weekDays[6].toLocaleDateString([], { month: 'short', day: 'numeric' })}
            </div>
            <button
              onClick={() => {
                const d = new Date(cursor);
                d.setDate(d.getDate() + 7);
                setCursor(d);
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
              aria-label="Next week"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="inline-flex rounded-full border border-gray-200 bg-white p-1">
            {(['WEEK', 'MONTH'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  'h-7 rounded-full px-3 text-xs font-semibold',
                  view === v
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                {v === 'WEEK' ? 'Week' : 'Month'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 lg:px-8 lg:py-6">
        {/* Week strip */}
        <div className="-mx-1 mb-4 flex gap-1 overflow-x-auto pb-1 lg:mx-0">
          {weekDays.map((d) => {
            const dayItems = items.filter((i) => isSameDay(i.scheduledAt, d));
            const isToday = isSameDay(d, today);
            return (
              <div
                key={+d}
                className={cn(
                  'flex min-w-[64px] flex-1 flex-col items-center rounded-xl border px-2 py-2 lg:min-w-0',
                  isToday ? 'border-purple-400 bg-purple-50' : 'border-gray-200 bg-white'
                )}
              >
                <span className={cn('text-[10px] uppercase tracking-wider', isToday ? 'text-purple-600' : 'text-gray-400')}>
                  {d.toLocaleDateString([], { weekday: 'short' })}
                </span>
                <span className={cn('mt-0.5 text-base font-semibold', isToday ? 'text-purple-700' : 'text-gray-900')}>
                  {d.getDate()}
                </span>
                <div className="mt-1 flex gap-0.5">
                  {dayItems.length === 0 ? (
                    <span className="block h-1.5 w-1.5 rounded-full bg-gray-200" />
                  ) : (
                    dayItems.map((it) => (
                      <span
                        key={it.id}
                        className={cn(
                          'block h-1.5 w-1.5 rounded-full',
                          it.status === 'PUBLISHED' ? 'bg-blue-500' : it.status === 'SCHEDULED' ? 'bg-purple-500' : 'bg-gray-300'
                        )}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Upcoming agenda */}
        <section className="mb-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Upcoming
          </h2>
          <ul className="flex flex-col gap-2">
            {upcoming.length === 0 && (
              <li className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-xs text-gray-500">
                Nothing scheduled. Drag from the queue or hit Schedule.
              </li>
            )}
            {upcoming.map((it) => (
              <li
                key={it.id}
                className={cn('rounded-2xl border p-4', statusMeta[it.status].barClass)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-gray-900">
                      {it.title}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-500">
                      <span className="inline-flex items-center gap-1">
                        <CalendarIcon className="h-3 w-3" /> {fmtDay(it.scheduledAt)}
                      </span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {fmtTime(it.scheduledAt)}
                      </span>
                      <span>·</span>
                      <span>{it.format}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 text-gray-400">
                    {it.platforms.includes('instagram') && <Instagram className="h-4 w-4" />}
                    {it.platforms.includes('tiktok') && <Music2 className="h-4 w-4" />}
                  </div>
                </div>
                <span
                  className={cn(
                    'mt-3 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium',
                    statusMeta[it.status].chipClass
                  )}
                >
                  {it.status === 'SCHEDULED' ? 'Scheduled' : it.status === 'DRAFT' ? 'Draft' : 'Published'}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Queue */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Queue · drag to reorder
            </h2>
            <button className="inline-flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-700">
              <Sparkles className="h-3 w-3" /> Auto-fill week
            </button>
          </div>
          <ul className="flex flex-col gap-2">
            {queue.map((q, idx) => (
              <li
                key={q.id}
                className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3"
              >
                <div className="flex flex-col">
                  <button
                    onClick={() => move(q.id, -1)}
                    disabled={idx === 0}
                    className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-100 disabled:opacity-30"
                    aria-label="Move up"
                  >
                    <ChevronLeft className="h-3 w-3 rotate-90" />
                  </button>
                  <button
                    onClick={() => move(q.id, 1)}
                    disabled={idx === queue.length - 1}
                    className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-100 disabled:opacity-30"
                    aria-label="Move down"
                  >
                    <ChevronRight className="h-3 w-3 rotate-90" />
                  </button>
                </div>
                <GripVertical className="h-4 w-4 shrink-0 text-gray-300" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-gray-900">{q.title}</div>
                  <div className="text-[11px] text-gray-500">{q.format}</div>
                </div>
                <Button variant="outline" className="h-8 px-3 text-xs">
                  Schedule
                </Button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
