'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Phone,
  Plus,
  X,
  Briefcase,
} from 'lucide-react';
import { Button } from '@gitroom/frontend/components/shadcn/ui/button';
import { Input } from '@gitroom/frontend/components/shadcn/ui/input';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useManagerMutations } from '@gitroom/frontend/hooks/manager';
import { useSchedule } from '@gitroom/frontend/hooks/creator-data';
import { cn } from '@gitroom/frontend/lib/utils';

// ---------------------------------------------------------------------------
// Reuses the unified /creator/schedule aggregation — same data sources
// (scheduled posts, Google Calendar events, deal deadlines), same window
// padding, same payload shape — so Manager + Creator stay in lockstep.
// ---------------------------------------------------------------------------

type EntryKind = 'POST' | 'EVENT' | 'DEADLINE';

interface Entry {
  id: string;
  kind: EntryKind;
  title: string;
  startsAt: Date;
  status?: string;
  brand?: string;
  offer?: number;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

function buildMonthGrid(cursor: Date): Date[] {
  const first = startOfMonth(cursor);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

const ymdLocal = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const fmtTime = (d: Date) =>
  d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const fmtDayLong = (d: Date) =>
  d.toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

export default function ManagerSchedulePage() {
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [initialDate, setInitialDate] = useState<Date | null>(null);

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const grid = useMemo(() => buildMonthGrid(cursor), [cursor]);
  const fromYmd = ymdLocal(grid[0]);
  const toYmd = ymdLocal(grid[grid.length - 1]);
  const { data, isLoading, mutate } = useSchedule(fromYmd, toYmd);

  const entries: Entry[] = useMemo(() => {
    if (!data) return [];
    const merged: Entry[] = [];
    for (const p of data.posts ?? []) {
      merged.push({
        id: `post-${p.id}`,
        kind: 'POST',
        title: p.caption.slice(0, 120) || '(no caption)',
        startsAt: new Date(p.scheduledAt),
        status: p.status,
      });
    }
    for (const e of data.events ?? []) {
      merged.push({
        id: `event-${e.id}`,
        kind: 'EVENT',
        title: e.title || '(untitled)',
        startsAt: new Date(e.startsAt),
      });
    }
    for (const d of data.deadlines ?? []) {
      if (!d.deadline) continue;
      merged.push({
        id: `deal-${d.id}`,
        kind: 'DEADLINE',
        title: `${d.brand} deadline`,
        startsAt: new Date(d.deadline),
        brand: d.brand,
        offer: d.offer,
      });
    }
    merged.sort((a, b) => +a.startsAt - +b.startsAt);
    return merged;
  }, [data]);

  const entriesByDay = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const e of entries) {
      const key = ymdLocal(e.startsAt);
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return map;
  }, [entries]);

  const goMonth = useCallback((delta: -1 | 1) => {
    setCursor((c) => {
      const next = new Date(c);
      next.setDate(1);
      next.setMonth(next.getMonth() + delta);
      return next;
    });
    setSelectedDay(null);
  }, []);

  // Swipe gestures, identical pattern to the creator calendar.
  const touchRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchRef.current;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const dt = Date.now() - start.t;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 600) {
      goMonth(dx > 0 ? -1 : 1);
    }
    touchRef.current = null;
  };

  const dayEntries = useMemo(() => {
    if (!selectedDay) return [];
    return entries
      .filter((e) => isSameDay(e.startsAt, selectedDay))
      .sort((a, b) => +a.startsAt - +b.startsAt);
  }, [selectedDay, entries]);

  return (
    <div className="flex h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="flex items-start justify-between gap-2 px-4 py-3 lg:px-8 lg:py-5">
          <div className="min-w-0">
            <div className="text-lg font-semibold text-gray-900">Calendar</div>
            <div className="truncate text-xs text-gray-500">
              {isLoading
                ? 'Loading…'
                : `${entries.filter((e) => e.kind === 'POST').length} posts · ${entries.filter((e) => e.kind === 'EVENT').length} events · ${entries.filter((e) => e.kind === 'DEADLINE').length} deadlines`}
            </div>
          </div>
          <Button
            className="h-11"
            onClick={() => {
              setInitialDate(selectedDay ?? new Date());
              setAddOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>

        <div className="flex items-center justify-between gap-2 px-4 pb-3 lg:px-8">
          <button
            onClick={() => goMonth(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-sm font-semibold text-gray-900">
            {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
          </div>
          <button
            onClick={() => goMonth(1)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div
        className="flex-1 overflow-y-auto px-2 pb-24 lg:px-8 lg:py-6"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="mx-2 mb-2 mt-3 flex flex-wrap items-center gap-3 text-[11px] text-gray-500 lg:mx-0">
          <LegendDot color="bg-purple-500" label="Content post" />
          <LegendDot color="bg-amber-500" label="Deal deadline" />
          <LegendDot color="bg-blue-500" label="Calendar event" />
        </div>

        <MonthGrid
          grid={grid}
          cursorMonth={cursor.getMonth()}
          today={today}
          selected={selectedDay}
          entriesByDay={entriesByDay}
          loading={isLoading}
          onSelect={setSelectedDay}
        />

        <UpcomingList entries={entries.filter((e) => +e.startsAt >= +today).slice(0, 6)} />
      </div>

      {selectedDay && (
        <DaySheet
          day={selectedDay}
          entries={dayEntries}
          onClose={() => setSelectedDay(null)}
          onAdd={() => {
            setInitialDate(selectedDay);
            setAddOpen(true);
          }}
        />
      )}

      {addOpen && (
        <AddEventSheet
          initialDate={initialDate ?? new Date()}
          onClose={() => setAddOpen(false)}
          onCreated={async () => {
            setAddOpen(false);
            await mutate();
          }}
        />
      )}
    </div>
  );
}

function MonthGrid({
  grid,
  cursorMonth,
  today,
  selected,
  entriesByDay,
  loading,
  onSelect,
}: {
  grid: Date[];
  cursorMonth: number;
  today: Date;
  selected: Date | null;
  entriesByDay: Map<string, Entry[]>;
  loading: boolean;
  onSelect: (d: Date) => void;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-1 lg:p-3">
      <div className="grid grid-cols-7 gap-0.5 px-1 pb-1 pt-2 lg:gap-1 lg:px-0 lg:pb-2">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="text-center text-[10px] font-semibold uppercase tracking-wider text-gray-500"
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5 lg:gap-1">
        {grid.map((d) => {
          const inMonth = d.getMonth() === cursorMonth;
          const isToday = isSameDay(d, today);
          const isSelected = selected ? isSameDay(d, selected) : false;
          const dayEntries = entriesByDay.get(ymdLocal(d)) ?? [];
          const hasPost = dayEntries.some((e) => e.kind === 'POST');
          const hasEvent = dayEntries.some((e) => e.kind === 'EVENT');
          const hasDeadline = dayEntries.some((e) => e.kind === 'DEADLINE');
          return (
            <button
              key={+d}
              type="button"
              onClick={() => onSelect(d)}
              className={cn(
                'group relative flex min-h-[56px] flex-col items-center justify-start gap-1 rounded-lg border px-1 py-1.5 text-center transition-colors lg:min-h-[80px] lg:py-2',
                isSelected
                  ? 'border-purple-500 bg-purple-50 ring-1 ring-purple-300'
                  : isToday
                  ? 'border-[#F59E0B] bg-amber-50/60'
                  : 'border-gray-100 bg-white hover:border-gray-200',
                !inMonth && 'opacity-40'
              )}
              aria-label={`${fmtDayLong(d)}${
                dayEntries.length ? ` — ${dayEntries.length} item${dayEntries.length === 1 ? '' : 's'}` : ''
              }`}
            >
              <span
                className={cn(
                  'text-[13px] font-semibold leading-none lg:text-sm',
                  isToday ? 'text-[#B45309]' : isSelected ? 'text-purple-700' : 'text-gray-900'
                )}
              >
                {d.getDate()}
              </span>
              <div className="flex gap-0.5">
                {hasPost && <Dot color="bg-purple-500" />}
                {hasDeadline && <Dot color="bg-amber-500" />}
                {hasEvent && <Dot color="bg-blue-500" />}
              </div>
              {inMonth && dayEntries.length > 0 && (
                <div className="hidden w-full overflow-hidden text-[10px] leading-tight text-gray-600 lg:block">
                  <div className="truncate">{dayEntries[0].title}</div>
                  {dayEntries.length > 1 && (
                    <div className="text-[9px] text-gray-400">+{dayEntries.length - 1} more</div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
      {loading && (
        <div className="mt-2 flex items-center justify-center gap-1.5 py-1 text-[11px] text-gray-400">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading…
        </div>
      )}
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return <span className={cn('block h-1.5 w-1.5 rounded-full', color)} />;
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('block h-1.5 w-1.5 rounded-full', color)} />
      {label}
    </span>
  );
}

function UpcomingList({ entries }: { entries: Entry[] }) {
  if (entries.length === 0) {
    return (
      <div className="mx-2 mt-6 rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-xs text-gray-500 lg:mx-0">
        Nothing scheduled in the next few weeks.
      </div>
    );
  }
  return (
    <div className="mx-2 mt-5 lg:mx-0">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
        Up next
      </h2>
      <ul className="flex flex-col gap-2">
        {entries.map((e) => (
          <li key={e.id}>
            <EntryRow entry={e} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function EntryRow({ entry }: { entry: Entry }) {
  const accent =
    entry.kind === 'POST'
      ? 'border-purple-200 bg-purple-50/50'
      : entry.kind === 'DEADLINE'
      ? 'border-amber-200 bg-amber-50/50'
      : 'border-blue-200 bg-blue-50/50';
  const Icon =
    entry.kind === 'POST'
      ? CalendarClock
      : entry.kind === 'DEADLINE'
      ? Briefcase
      : CalendarDays;
  const iconTone =
    entry.kind === 'POST'
      ? 'bg-purple-100 text-purple-700'
      : entry.kind === 'DEADLINE'
      ? 'bg-amber-100 text-amber-700'
      : 'bg-blue-100 text-blue-700';
  return (
    <div className={cn('flex items-start gap-3 rounded-2xl border p-3', accent)}>
      <div className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full', iconTone)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-gray-900">{entry.title}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-500">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" /> {fmtTime(entry.startsAt)}
          </span>
          {entry.kind === 'DEADLINE' && typeof entry.offer === 'number' && entry.offer > 0 && (
            <>
              <span>·</span>
              <span>₹{entry.offer.toLocaleString()}</span>
            </>
          )}
          {entry.kind === 'POST' && entry.status && (
            <>
              <span>·</span>
              <span className="capitalize">{entry.status.toLowerCase()}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DaySheet({
  day,
  entries,
  onClose,
  onAdd,
}: {
  day: Date;
  entries: Entry[];
  onClose: () => void;
  onAdd: () => void;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 backdrop-blur-sm lg:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative flex max-h-[80vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl lg:max-w-lg lg:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900">{fmtDayLong(day)}</div>
            <div className="text-[11px] text-gray-500">
              {entries.length} item{entries.length === 1 ? '' : 's'}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {entries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-xs text-gray-500">
              Nothing on this day yet.
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {entries.map((e) => (
                <li key={e.id}>
                  <EntryRow entry={e} />
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t border-gray-100 p-3">
          <Button className="h-11 w-full" onClick={onAdd}>
            <Plus className="h-4 w-4" /> Add event on this day
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add event sheet — creates a Google Calendar entry via /manager/schedule/events.
// Useful kinds: BRAND_CALL (a meeting), DEAL_DEADLINE (manual reminder), or
// generic event. Posts come in via the Schedule (Creator) flow.
// ---------------------------------------------------------------------------

const KIND_OPTIONS: Array<{
  id: 'BRAND_CALL' | 'DEAL_DEADLINE' | 'CONTRACT_EXPIRES';
  label: string;
}> = [
  { id: 'BRAND_CALL', label: 'Meeting / call' },
  { id: 'DEAL_DEADLINE', label: 'Deal deadline' },
  { id: 'CONTRACT_EXPIRES', label: 'Contract expiry' },
];

function AddEventSheet({
  initialDate,
  onClose,
  onCreated,
}: {
  initialDate: Date;
  onClose: () => void;
  onCreated: () => Promise<void> | void;
}) {
  const { createCalendarEvent } = useManagerMutations();
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<(typeof KIND_OPTIONS)[number]['id']>('BRAND_CALL');
  const [date, setDate] = useState<string>(ymdLocal(initialDate));
  const [time, setTime] = useState<string>('15:00');
  const [duration, setDuration] = useState<number>(30);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const submit = async () => {
    if (submitting) return;
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    const [y, m, dd] = date.split('-').map(Number);
    const [hh, mm] = time.split(':').map(Number);
    const start = new Date(y, (m || 1) - 1, dd || 1, hh || 0, mm || 0);
    const end = new Date(start.getTime() + Math.max(duration, 5) * 60_000);
    setSubmitting(true);
    setError(null);
    try {
      await createCalendarEvent({
        title: title.trim(),
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        kind,
      });
      await onCreated();
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm lg:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl lg:max-w-md lg:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div className="text-sm font-semibold text-gray-900">Add to calendar</div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-3">
            <Field label="Title">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Sync with brand team"
              />
            </Field>
            <Field label="Type">
              <div className="flex flex-wrap gap-1.5">
                {KIND_OPTIONS.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => setKind(k.id)}
                    className={cn(
                      'h-9 rounded-full border px-3 text-xs font-semibold transition-colors',
                      kind === k.id
                        ? 'border-purple-600 bg-purple-600 text-white'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    )}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
                />
              </Field>
              <Field label="Time">
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
                />
              </Field>
            </div>
            <Field label="Duration">
              <div className="flex flex-wrap gap-1.5">
                {[15, 30, 60, 120].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setDuration(m)}
                    className={cn(
                      'h-9 rounded-full border px-3 text-xs font-semibold transition-colors',
                      duration === m
                        ? 'border-purple-600 bg-purple-600 text-white'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    )}
                  >
                    {m} min
                  </button>
                ))}
              </div>
            </Field>
            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                {error}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-gray-100 p-3">
          <Button className="h-12 w-full" onClick={submit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Adding…
              </>
            ) : (
              <>
                <Phone className="h-4 w-4" /> Add to Google Calendar
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </span>
      {children}
    </label>
  );
}
