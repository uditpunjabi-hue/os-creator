'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Instagram,
  Music2,
  Youtube,
  Linkedin,
  Loader2,
  CalendarClock,
  CalendarDays,
  Briefcase,
  X,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@gitroom/frontend/components/shadcn/ui/button';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { cn } from '@gitroom/frontend/lib/utils';
import { useSchedule } from '@gitroom/frontend/hooks/creator-data';

// ---------------------------------------------------------------------------
// Types — three sources merge into one timeline: scheduled posts, Google
// Calendar events, and deal deadlines.
// ---------------------------------------------------------------------------

type Platform = 'instagram' | 'tiktok' | 'youtube' | 'linkedin' | 'x';
type PostStatus = 'SCHEDULED' | 'DRAFT' | 'PUBLISHED' | 'FAILED';
type EntryKind = 'POST' | 'EVENT' | 'DEADLINE';

interface Entry {
  id: string;
  kind: EntryKind;
  title: string;
  // Always normalised to a Date for sort + same-day comparison.
  startsAt: Date;
  // For posts only.
  status?: PostStatus;
  platforms?: Platform[];
  format?: string;
  // For deadlines only.
  brand?: string;
  offer?: number;
}

interface ApiPayload {
  posts: Array<{
    id: string;
    caption: string;
    kind: string;
    status: PostStatus;
    platforms: string[];
    scheduledAt: string;
  }>;
  events: Array<{
    id: string;
    title: string;
    startsAt: string;
  }>;
  deadlines: Array<{
    id: string;
    brand: string;
    offer: number;
    deadline: string | null;
    stage: string;
  }>;
}

interface ScriptOption {
  id: string;
  title: string;
  format: string;
  status: string;
}

// ---------------------------------------------------------------------------
// Date helpers — kept inline because Schedule is the only page that needs
// month-grid math.
// ---------------------------------------------------------------------------

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);

// 6 rows × 7 columns = 42 days. The grid always starts on Sunday of the week
// containing day 1 of the visible month, so leading days belong to the prior
// month and trailing days to the next. This keeps the grid rectangular even
// for short Februaries.
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

const fmtTime = (d: Date) =>
  d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const fmtDayLong = (d: Date) =>
  d.toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

// Local YYYY-MM-DD (NOT UTC) — used to drive the form's date input. Using
// toISOString() would shift past midnight in negative-UTC offsets and pick
// the wrong day.
const ymdLocal = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const platformIcon: Record<Platform, typeof Instagram> = {
  instagram: Instagram,
  tiktok: Music2,
  youtube: Youtube,
  linkedin: Linkedin,
  x: AlertCircle, // no clean X icon in lucide — placeholder, replaced below
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SchedulePage() {
  const fetch = useFetch();

  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formInitialDate, setFormInitialDate] = useState<Date | null>(null);

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  // Build the visible window from the calendar grid bounds. SWR keys by the
  // resulting URL — flipping months loads new data, flipping back hits the
  // in-memory cache instantly.
  const grid = useMemo(() => buildMonthGrid(cursor), [cursor]);
  const fromYmd = ymdLocal(grid[0]);
  const toYmd = ymdLocal(grid[grid.length - 1]);
  const { data, isLoading, mutate: mutateSchedule } = useSchedule(fromYmd, toYmd);
  const loading = isLoading;

  // Reshape the wire payload into the Entry[] the calendar renders. Done in
  // useMemo so the heavy date parsing only runs when the data actually changes.
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
        platforms: (p.platforms ?? []) as Platform[],
        format:
          p.kind === 'REEL'
            ? 'Reel'
            : p.kind === 'CAROUSEL'
            ? 'Carousel'
            : p.kind === 'STORY'
            ? 'Story'
            : 'Image',
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

  const reload = () => {
    void mutateSchedule();
  };

  // Index entries by local YYYY-MM-DD so each day cell can look up its dots
  // in O(1) instead of scanning the whole list.
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

  // Swipe gestures on the calendar — left/right between months. Vertical
  // swipes are ignored so they don't fight the page scroll.
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

  // Selected-day events for the slide-up sheet. Falls back to the soonest
  // upcoming day in this month when nothing's selected — gives the sheet
  // something useful even on a fresh load.
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
            <div className="text-lg font-semibold text-gray-900">Schedule</div>
            <div className="truncate text-xs text-gray-500">
              {loading
                ? 'Loading…'
                : `${entries.filter((e) => e.kind === 'POST').length} posts · ${entries.filter((e) => e.kind === 'EVENT').length} events · ${entries.filter((e) => e.kind === 'DEADLINE').length} deadlines`}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href="/creator/analytics"
              className="hidden h-9 items-center rounded-full border border-gray-200 px-3 text-xs font-medium text-gray-600 hover:border-gray-300 hover:text-gray-900 sm:inline-flex"
            >
              View analytics →
            </a>
            <Button
              className="h-11"
              onClick={() => {
                setFormInitialDate(selectedDay ?? new Date());
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Schedule
            </Button>
          </div>
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
        {/* Legend */}
        <div className="mx-2 mb-2 mt-3 flex flex-wrap items-center gap-3 text-[11px] text-gray-500 lg:mx-0">
          <LegendDot color="bg-purple-500" label="Scheduled post" />
          <LegendDot color="bg-amber-500" label="Deal deadline" />
          <LegendDot color="bg-blue-500" label="Calendar event" />
        </div>

        {/* Month grid */}
        <MonthGrid
          grid={grid}
          cursorMonth={cursor.getMonth()}
          today={today}
          selected={selectedDay}
          entriesByDay={entriesByDay}
          loading={loading}
          onSelect={setSelectedDay}
        />

        {/* Inline upcoming section — quick scan without opening the sheet */}
        <UpcomingList
          entries={entries
            .filter((e) => +e.startsAt >= +today)
            .slice(0, 5)}
        />
      </div>

      {/* Floating "+" — primary CTA on mobile where the header button is
          cramped. Sits above the bottom-nav safe area. */}
      <button
        type="button"
        onClick={() => {
          setFormInitialDate(selectedDay ?? new Date());
          setFormOpen(true);
        }}
        className="fixed bottom-20 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-purple-600 text-white shadow-xl shadow-purple-600/30 transition-transform hover:scale-105 active:scale-95 lg:bottom-8"
        aria-label="Schedule a post"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Slide-up day panel */}
      {selectedDay && (
        <DaySheet
          day={selectedDay}
          entries={dayEntries}
          onClose={() => setSelectedDay(null)}
          onSchedule={() => {
            setFormInitialDate(selectedDay);
            setFormOpen(true);
          }}
        />
      )}

      {/* New post form */}
      {formOpen && (
        <ScheduleForm
          initialDate={formInitialDate ?? new Date()}
          onClose={() => setFormOpen(false)}
          onCreated={() => {
            setFormOpen(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Month grid
// ---------------------------------------------------------------------------

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
      {/* Weekday labels */}
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
      {/* 6 rows × 7 days. Each cell is min 56px tall on mobile (above the 44pt
          tap target floor) and grows on desktop. */}
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
                dayEntries.length ? ` — ${dayEntries.length} event${dayEntries.length === 1 ? '' : 's'}` : ''
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
              {/* Desktop: show first event title inline so months feel alive.
                  Mobile keeps just the dots to preserve the tap target. */}
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

// ---------------------------------------------------------------------------
// Upcoming list — appears under the calendar so the page feels useful even
// before the user taps a day.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Entry row — shared between the upcoming list and the day sheet.
// ---------------------------------------------------------------------------

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
          {entry.format && (
            <>
              <span>·</span>
              <span>{entry.format}</span>
            </>
          )}
          {entry.kind === 'POST' && entry.status && (
            <>
              <span>·</span>
              <span className="capitalize">{entry.status.toLowerCase()}</span>
            </>
          )}
          {entry.kind === 'DEADLINE' && typeof entry.offer === 'number' && entry.offer > 0 && (
            <>
              <span>·</span>
              <span>${entry.offer.toLocaleString()}</span>
            </>
          )}
        </div>
      </div>
      {entry.kind === 'POST' && entry.platforms && entry.platforms.length > 0 && (
        <PlatformIcons platforms={entry.platforms} />
      )}
    </div>
  );
}

function PlatformIcons({ platforms }: { platforms: Platform[] }) {
  return (
    <div className="flex shrink-0 items-center gap-1.5 text-gray-500">
      {platforms.map((p) => {
        if (p === 'x') {
          // Lucide ships no X-logo; render the literal.
          return (
            <span key={p} className="text-[11px] font-bold leading-none">
              𝕏
            </span>
          );
        }
        const Icon = platformIcon[p];
        return <Icon key={p} className="h-3.5 w-3.5" />;
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slide-up day sheet
// ---------------------------------------------------------------------------

function DaySheet({
  day,
  entries,
  onClose,
  onSchedule,
}: {
  day: Date;
  entries: Entry[];
  onClose: () => void;
  onSchedule: () => void;
}) {
  // Lock scroll while sheet is open.
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
              {entries.length} event{entries.length === 1 ? '' : 's'}
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
              Nothing on this day yet. Schedule a post to fill it.
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
          <Button className="h-11 w-full" onClick={onSchedule}>
            <Plus className="h-4 w-4" /> Schedule a post on this day
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Schedule-a-post form
// ---------------------------------------------------------------------------

const PLATFORM_OPTIONS: { id: Platform; label: string; icon: typeof Instagram }[] = [
  { id: 'instagram', label: 'Instagram', icon: Instagram },
  { id: 'tiktok', label: 'TikTok', icon: Music2 },
  { id: 'youtube', label: 'YouTube', icon: Youtube },
  { id: 'linkedin', label: 'LinkedIn', icon: Linkedin },
];
const KIND_OPTIONS = ['REEL', 'CAROUSEL', 'IMAGE', 'STORY'] as const;

function ScheduleForm({
  initialDate,
  onClose,
  onCreated,
}: {
  initialDate: Date;
  onClose: () => void;
  onCreated: () => void;
}) {
  const fetch = useFetch();
  const [scripts, setScripts] = useState<ScriptOption[]>([]);
  const [scriptId, setScriptId] = useState<string>('');
  const [caption, setCaption] = useState('');
  const [kind, setKind] = useState<(typeof KIND_OPTIONS)[number]>('REEL');
  const [platforms, setPlatforms] = useState<Set<Platform>>(new Set(['instagram']));
  const [date, setDate] = useState<string>(ymdLocal(initialDate));
  const [time, setTime] = useState<string>(() => {
    // Default to 6 PM local — solid prime-time anchor for most feeds.
    return '18:00';
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Pull the org's approved-ish scripts so the creator can attach one. We
  // include DRAFT/IN_REVIEW too in case nothing's approved yet — the form
  // still works without a script (free-form caption).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/creator/scripts');
        if (!res.ok || cancelled) return;
        const rows = (await res.json()) as ScriptOption[];
        if (!cancelled) setScripts(rows.slice(0, 50));
      } catch {
        // Ignore — script picker is optional.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetch]);

  const togglePlatform = (p: Platform) => {
    setPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const onScriptPick = (id: string) => {
    setScriptId(id);
    if (id) {
      const s = scripts.find((x) => x.id === id);
      if (s) {
        if (!caption) setCaption(s.title);
        const f = (s.format || '').toLowerCase();
        if (f.includes('reel')) setKind('REEL');
        else if (f.includes('carousel')) setKind('CAROUSEL');
        else if (f.includes('story')) setKind('STORY');
        else setKind('IMAGE');
      }
    }
  };

  const submit = async () => {
    if (submitting) return;
    setError(null);
    if (platforms.size === 0) {
      setError('Pick at least one platform.');
      return;
    }
    if (!caption.trim() && !scriptId) {
      setError('Add a caption or pick a script.');
      return;
    }
    // Combine local date + time. The input gives us "YYYY-MM-DD" + "HH:MM"
    // already in the user's wall-clock; constructing a Date() with those
    // pieces parses them as local time, which is what we want.
    const [y, m, dd] = date.split('-').map((n) => parseInt(n, 10));
    const [hh, mm] = time.split(':').map((n) => parseInt(n, 10));
    const scheduledAt = new Date(y, (m || 1) - 1, dd || 1, hh || 0, mm || 0).toISOString();
    setSubmitting(true);
    try {
      const res = await fetch('/creator/scheduled-posts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          caption: caption.trim() || undefined,
          scriptId: scriptId || undefined,
          kind,
          platforms: Array.from(platforms),
          scheduledAt,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message ?? `Schedule failed (${res.status})`);
        setSubmitting(false);
        return;
      }
      onCreated();
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
          <div className="text-sm font-semibold text-gray-900">Schedule a post</div>
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
          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Script (optional)
              </label>
              <select
                value={scriptId}
                onChange={(e) => onScriptPick(e.target.value)}
                className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
              >
                <option value="">— None (write caption below) —</option>
                {scripts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} {s.format ? `· ${s.format}` : ''} {s.status === 'APPROVED' ? '✓' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Caption
              </label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="What's this post about?"
                className="min-h-[80px] w-full resize-y rounded-xl border border-gray-200 bg-white p-3 text-sm placeholder:text-gray-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Time
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Format
              </label>
              <div className="flex flex-wrap gap-1.5">
                {KIND_OPTIONS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className={cn(
                      'h-9 rounded-full border px-3 text-xs font-semibold capitalize',
                      kind === k
                        ? 'border-purple-600 bg-purple-600 text-white'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    )}
                  >
                    {k.toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Platforms
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PLATFORM_OPTIONS.map((p) => {
                  const Icon = p.icon;
                  const active = platforms.has(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePlatform(p.id)}
                      className={cn(
                        'flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition-colors',
                        active
                          ? 'border-purple-600 bg-purple-600 text-white'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      )}
                    >
                      <Icon className="h-4 w-4" /> {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

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
                <Loader2 className="h-4 w-4 animate-spin" /> Scheduling…
              </>
            ) : (
              <>
                <CalendarClock className="h-4 w-4" /> Schedule for{' '}
                {new Date(`${date}T${time}:00`).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
