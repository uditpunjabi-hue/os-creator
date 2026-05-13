'use client';

import { useEffect, useState } from 'react';
import {
  Video,
  Scissors,
  Subtitles,
  CheckCircle2,
  Circle,
  Upload,
  ChevronRight,
  Sparkles,
  Clock,
  Loader2,
} from 'lucide-react';
import { Button } from '@gitroom/frontend/components/shadcn/ui/button';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { cn } from '@gitroom/frontend/lib/utils';

type Stage = 'IDEA' | 'FILMING' | 'EDITING' | 'READY' | 'SCHEDULED' | 'PUBLISHED';

interface Piece {
  id: string;
  title: string;
  format: string;
  stage: Stage;
  hook: string;
  scheduledFor?: string;
  approvedAt: string;
  checks: { film: boolean; edit: boolean; captions: boolean; finalReview: boolean };
}

interface ApiPiece {
  id: string;
  title: string;
  format: string;
  status: Stage;
  hook: string | null;
  scheduledAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  checklist: { film?: boolean; edit?: boolean; captions?: boolean; finalReview?: boolean } | null;
  script?: { id: string; title: string } | null;
}

const fmtAgo = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 60) return 'just now';
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? '1 day ago' : `${d} days ago`;
};

const fmtScheduled = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString([], { weekday: 'short' })} · ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
};

const shapeFromApi = (r: ApiPiece): Piece => ({
  id: r.id,
  title: r.title,
  format: r.format,
  stage: r.status,
  hook: r.hook ?? '',
  scheduledFor: r.scheduledAt ? fmtScheduled(r.scheduledAt) : undefined,
  approvedAt: r.approvedAt ? `Approved ${fmtAgo(r.approvedAt)}` : `Created ${fmtAgo(r.createdAt)}`,
  checks: {
    film: !!r.checklist?.film,
    edit: !!r.checklist?.edit,
    captions: !!r.checklist?.captions,
    finalReview: !!r.checklist?.finalReview,
  },
});

const stageMeta: Record<Stage, { label: string; chipClass: string; barClass: string }> = {
  IDEA: { label: 'Idea', chipClass: 'bg-gray-100 text-gray-700', barClass: 'bg-gray-300' },
  FILMING: { label: 'Filming', chipClass: 'bg-rose-100 text-rose-700', barClass: 'bg-rose-500' },
  EDITING: { label: 'Editing', chipClass: 'bg-amber-100 text-amber-700', barClass: 'bg-amber-500' },
  READY: { label: 'Ready', chipClass: 'bg-emerald-100 text-emerald-700', barClass: 'bg-emerald-500' },
  SCHEDULED: { label: 'Scheduled', chipClass: 'bg-purple-100 text-purple-700', barClass: 'bg-purple-500' },
  PUBLISHED: { label: 'Published', chipClass: 'bg-blue-100 text-blue-700', barClass: 'bg-blue-500' },
};

const checklistRows: Array<{
  key: keyof Piece['checks'];
  label: string;
  icon: typeof Video;
  hint: string;
}> = [
  { key: 'film', label: 'Film', icon: Video, hint: 'Capture the raw footage.' },
  { key: 'edit', label: 'Edit', icon: Scissors, hint: 'Cut, color, and pace the final.' },
  { key: 'captions', label: 'Captions & cover', icon: Subtitles, hint: 'Add burned-in captions and a cover frame.' },
  { key: 'finalReview', label: 'Final review', icon: CheckCircle2, hint: 'Watch on phone, tweak audio, approve.' },
];

const progressOf = (p: Piece) => {
  const done = Object.values(p.checks).filter(Boolean).length;
  return { done, total: 4, pct: Math.round((done / 4) * 100) };
};

export default function CreatePage() {
  const fetch = useFetch();
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/creator/content-pieces');
        if (!res.ok) {
          if (!cancelled) setLoading(false);
          return;
        }
        const rows = (await res.json()) as ApiPiece[];
        if (cancelled) return;
        const shaped = rows.map(shapeFromApi);
        setPieces(shaped);
        if (shaped[0]) setActiveId(shaped[0].id);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetch]);

  const active = pieces.find((p) => p.id === activeId) ?? pieces[0];

  const toggle = (id: string, key: keyof Piece['checks']) => {
    setPieces((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, checks: { ...p.checks, [key]: !p.checks[key] } } : p
      )
    );
  };

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-gray-200 bg-white px-4 py-3 lg:px-8 lg:py-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-lg font-semibold text-gray-900">Create</div>
            <div className="text-xs text-gray-500">
              Approved scripts move through filming and editing until they&rsquo;re ready to schedule.
            </div>
          </div>
          <Button className="h-11 shrink-0" variant="outline">
            <Sparkles className="h-4 w-4" /> Idea board
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        <aside className="border-b border-gray-200 bg-white lg:w-[360px] lg:shrink-0 lg:border-b-0 lg:border-r">
          {loading && pieces.length === 0 && (
            <div className="flex items-center justify-center gap-2 px-4 py-8 text-xs text-gray-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading content pieces…
            </div>
          )}
          {!loading && pieces.length === 0 && (
            <div className="px-4 py-8 text-center text-xs text-gray-500">
              No content in production yet. Approve a script to start the filming workflow.
            </div>
          )}
          <ul className="flex flex-col">
            {pieces.map((p) => {
              const prog = progressOf(p);
              const selected = active?.id === p.id;
              return (
                <li key={p.id}>
                  <button
                    onClick={() => setActiveId(p.id)}
                    className={cn(
                      'flex w-full items-start gap-3 border-b border-gray-100 px-4 py-3 text-left transition-colors lg:px-5',
                      selected ? 'bg-purple-50/60' : 'hover:bg-gray-50'
                    )}
                  >
                    <div
                      className={cn(
                        'mt-1 h-2 w-2 shrink-0 rounded-full',
                        stageMeta[p.stage].barClass
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="truncate text-sm font-semibold text-gray-900">
                          {p.title}
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-500">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 font-medium',
                            stageMeta[p.stage].chipClass
                          )}
                        >
                          {stageMeta[p.stage].label}
                        </span>
                        <span>{p.format}</span>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={cn('h-full', stageMeta[p.stage].barClass)}
                          style={{ width: `${prog.pct}%` }}
                        />
                      </div>
                      <div className="mt-1 text-[11px] text-gray-400">
                        {prog.done}/{prog.total} done · {p.approvedAt}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {active && (
          <section className="flex-1 overflow-y-auto bg-gray-50 px-4 py-4 lg:px-8 lg:py-6">
            <div className="mx-auto flex max-w-2xl flex-col gap-4">
              <div className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-5">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 font-medium',
                      stageMeta[active.stage].chipClass
                    )}
                  >
                    {stageMeta[active.stage].label}
                  </span>
                  <span>·</span>
                  <span>{active.format}</span>
                  {active.scheduledFor && (
                    <>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1 text-purple-700">
                        <Clock className="h-3 w-3" /> {active.scheduledFor}
                      </span>
                    </>
                  )}
                </div>
                <div className="text-base font-semibold text-gray-900">{active.title}</div>
                <p className="text-sm text-gray-600">{active.hook}</p>
              </div>

              <div className="flex flex-col gap-1 rounded-2xl border border-gray-200 bg-white p-2">
                {checklistRows.map((row) => {
                  const Icon = row.icon;
                  const done = active.checks[row.key];
                  return (
                    <button
                      key={row.key}
                      onClick={() => toggle(active.id, row.key)}
                      className={cn(
                        'flex items-start gap-3 rounded-xl p-3 text-left transition-colors active:bg-gray-100',
                        done ? 'bg-emerald-50/50' : 'hover:bg-gray-50'
                      )}
                    >
                      <div
                        className={cn(
                          'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border',
                          done
                            ? 'border-emerald-500 bg-emerald-500 text-white'
                            : 'border-gray-300 bg-white text-gray-300'
                        )}
                      >
                        {done ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-3 w-3" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                          <Icon className="h-3.5 w-3.5 text-gray-400" />
                          {row.label}
                        </div>
                        <div className="text-xs text-gray-500">{row.hint}</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-gray-300 bg-white p-5 text-center">
                <div className="mx-auto rounded-full bg-purple-100 p-3 text-purple-600">
                  <Upload className="h-5 w-5" />
                </div>
                <div className="text-sm font-semibold text-gray-900">Upload the final cut</div>
                <div className="text-xs text-gray-500">
                  MP4 / MOV up to 1 GB. Once uploaded, this piece becomes ready to schedule.
                </div>
                <Button className="mx-auto h-11" variant="outline">
                  <Upload className="h-4 w-4" /> Choose file
                </Button>
              </div>

              <Button
                className="h-12 w-full"
                disabled={!Object.values(active.checks).every(Boolean) || active.stage === 'SCHEDULED'}
                onClick={() => {
                  if (active.stage !== 'SCHEDULED') {
                    // Pipeline hand-off: ready content moves into Schedule.
                    window.location.href = '/creator/schedule';
                  }
                }}
              >
                {active.stage === 'SCHEDULED' ? 'Already scheduled' : 'Mark ready to schedule →'}
              </Button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
