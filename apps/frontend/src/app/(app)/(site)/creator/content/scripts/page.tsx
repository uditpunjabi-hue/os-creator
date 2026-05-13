'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Sparkles, Plus, Search, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@gitroom/frontend/components/shadcn/ui/button';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { cn } from '@gitroom/frontend/lib/utils';

type Status = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'SCHEDULED' | 'PUBLISHED' | 'REJECTED';
type Filter = 'ALL' | Status;

interface ScriptItem {
  id: string;
  title: string;
  format: 'Reel' | 'Carousel' | 'Story' | 'Photo';
  status: Status;
  updatedAt: string;
  hook: string;
  feedback?: string;
}

const scripts: ScriptItem[] = [
  { id: '1', title: '5 lighting mistakes that ruin reels', format: 'Reel', status: 'PUBLISHED', updatedAt: '2 days ago', hook: 'Your reel looks amateur because of THIS one light' },
  { id: '2', title: 'Behind the scenes — Bloom campaign', format: 'Reel', status: 'APPROVED', updatedAt: '4h ago', hook: 'We shot a 6-figure campaign in 1 day. Here\'s how.' },
  { id: '3', title: 'My gear list at $1k', format: 'Carousel', status: 'IN_REVIEW', updatedAt: '1h ago', hook: 'Slide 1: the entire kit fits in a shoebox.' },
  { id: '4', title: 'Three product unboxings in 60s', format: 'Reel', status: 'SCHEDULED', updatedAt: 'Yesterday', hook: 'Three unboxings, sixty seconds, one rule.' },
  { id: '5', title: 'Why your hook fails in 3 seconds', format: 'Reel', status: 'DRAFT', updatedAt: '3h ago', hook: 'People scroll past your content because of THIS' },
  { id: '6', title: 'Day in the life: solo creator + AI manager', format: 'Reel', status: 'DRAFT', updatedAt: '5h ago', hook: 'I run a 6-figure studio with one human (me).' },
  { id: '7', title: 'How I price brand deals (real numbers)', format: 'Carousel', status: 'REJECTED', updatedAt: '2 days ago', hook: 'Reels start at $4,200. Here\'s why.', feedback: 'Sharing pricing publicly could undercut future negotiations. Rework as principles, not numbers.' },
  { id: '8', title: 'My morning routine (no BS edition)', format: 'Reel', status: 'PUBLISHED', updatedAt: 'Last week', hook: 'Wake 6:30, coffee, journaling, then content sprint.' },
  { id: '9', title: 'The one prompt that changed my workflow', format: 'Reel', status: 'APPROVED', updatedAt: '2h ago', hook: 'One AI prompt that 10x\'d my output.' },
];

const statusMeta: Record<Status, { label: string; chipClass: string; dotClass: string }> = {
  DRAFT: { label: 'Draft', chipClass: 'bg-gray-100 text-gray-700', dotClass: 'bg-gray-400' },
  IN_REVIEW: { label: 'In review', chipClass: 'bg-amber-100 text-amber-800', dotClass: 'bg-amber-500' },
  APPROVED: { label: 'Approved', chipClass: 'bg-emerald-100 text-emerald-800', dotClass: 'bg-emerald-500' },
  SCHEDULED: { label: 'Scheduled', chipClass: 'bg-purple-100 text-purple-800', dotClass: 'bg-purple-500' },
  PUBLISHED: { label: 'Published', chipClass: 'bg-blue-100 text-blue-800', dotClass: 'bg-blue-500' },
  REJECTED: { label: 'Rejected', chipClass: 'bg-rose-100 text-rose-800', dotClass: 'bg-rose-500' },
};

const filters: { key: Filter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'DRAFT', label: 'Drafts' },
  { key: 'IN_REVIEW', label: 'Review' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'SCHEDULED', label: 'Scheduled' },
  { key: 'PUBLISHED', label: 'Published' },
];

export default function ScriptsPage() {
  const [filter, setFilter] = useState<Filter>('ALL');
  const [q, setQ] = useState('');
  const [genOpen, setGenOpen] = useState(false);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return scripts.filter((s) => {
      if (filter !== 'ALL' && s.status !== filter) return false;
      if (term && !s.title.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [filter, q]);

  return (
    <div className="flex h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="flex items-start justify-between gap-2 px-4 py-3 lg:px-8 lg:py-5">
          <div className="min-w-0">
            <div className="text-lg font-semibold text-gray-900">Scripts</div>
            <div className="truncate text-xs text-gray-500">
              {filtered.length} of {scripts.length} · AI drafts, your review, your voice
            </div>
          </div>
          <Button className="h-11 shrink-0" onClick={() => setGenOpen((v) => !v)}>
            <Sparkles className="h-4 w-4" /> Generate
          </Button>
        </div>

        <div className="flex flex-col gap-2 px-4 pb-3 lg:px-8">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              inputMode="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search scripts"
              className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
            />
          </div>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  'h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors',
                  filter === f.key
                    ? 'border-purple-600 bg-purple-600 text-white'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {genOpen && (
        <GeneratePanel onClose={() => setGenOpen(false)} />
      )}

      <div className="flex-1 overflow-y-auto px-4 py-3 lg:px-8 lg:py-5">
        <ul className="flex flex-col gap-2 lg:grid lg:grid-cols-2 lg:gap-3 xl:grid-cols-3">
          {filtered.map((s) => (
            <li key={s.id}>
              <Link
                href={`/creator/content/scripts/${s.id}`}
                className="group flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 transition-colors hover:border-purple-300 active:bg-purple-50/40"
              >
                <div
                  className={cn(
                    'mt-1 h-2 w-2 shrink-0 rounded-full',
                    statusMeta[s.status].dotClass
                  )}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="truncate text-sm font-semibold text-gray-900">
                      {s.title}
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-500" />
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-gray-500">{s.hook}</p>
                  <div className="mt-3 flex items-center gap-2 text-[11px] text-gray-400">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 font-medium',
                        statusMeta[s.status].chipClass
                      )}
                    >
                      {statusMeta[s.status].label}
                    </span>
                    <span>·</span>
                    <span>{s.format}</span>
                    <span>·</span>
                    <span>{s.updatedAt}</span>
                  </div>
                  {s.feedback && (
                    <div className="mt-2 rounded-lg border border-rose-100 bg-rose-50 px-2 py-1.5 text-[11px] text-rose-700">
                      <span className="font-semibold">Feedback:</span> {s.feedback}
                    </div>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-16 text-center">
            <div className="rounded-full bg-purple-100 p-3 text-purple-600">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="text-sm font-medium text-gray-900">No scripts here</div>
            <div className="max-w-xs text-xs text-gray-500">
              Try a different filter, or describe a new piece and let the AI draft a script.
            </div>
            <Button onClick={() => setGenOpen(true)}>
              <Plus className="h-4 w-4" /> Generate script
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function GeneratePanel({ onClose }: { onClose: () => void }) {
  const [prompt, setPrompt] = useState('');
  const [format, setFormat] = useState<'Reel' | 'Carousel' | 'Story' | 'Photo'>('Reel');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetch = useFetch();

  const submit = async () => {
    if (!prompt.trim()) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/creator/scripts/generate', {
        method: 'POST',
        body: JSON.stringify({ prompt: prompt.trim(), format }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        if (res.status === 503) {
          setError(
            payload.message ??
              'AI script generation is not configured yet. Set ANTHROPIC_API_KEY in .env and restart the backend.'
          );
        } else {
          setError(payload.message ?? `Generation failed (${res.status})`);
        }
        return;
      }
      setPrompt('');
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="border-b border-purple-100 bg-gradient-to-b from-purple-50/60 to-white px-4 py-4 lg:px-8">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-purple-700">
        <Sparkles className="h-3.5 w-3.5" /> AI draft
      </div>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="e.g. 30-second reel for a course launch, casual tone, 3 quick points and a CTA to comment 'COURSE'."
        className="min-h-[88px] w-full resize-y rounded-xl border border-gray-200 bg-white p-3 text-sm placeholder:text-gray-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
      />
      {error && (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {error}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {(['Reel', 'Carousel', 'Story', 'Photo'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={cn(
                'h-8 rounded-full border px-3 text-xs font-medium',
                format === f
                  ? 'border-purple-600 bg-purple-600 text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="h-10" onClick={onClose}>
            Cancel
          </Button>
          <Button className="h-10" onClick={submit} disabled={!prompt.trim() || pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {pending ? 'Drafting…' : 'Draft script'}
          </Button>
        </div>
      </div>
    </div>
  );
}
