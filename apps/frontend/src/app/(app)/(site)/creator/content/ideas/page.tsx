'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Lightbulb,
  RefreshCw,
  Heart,
  X,
  Sparkles,
  TrendingUp,
  Users,
  Calendar as CalendarIcon,
  Star,
  Loader2,
  Film,
  Image as ImageIcon,
  Layers,
} from 'lucide-react';
import { Button } from '@gitroom/frontend/components/shadcn/ui/button';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { SkeletonList } from '@gitroom/frontend/components/ui/skeleton';
import { cn } from '@gitroom/frontend/lib/utils';
import {
  useContentIdeas,
  type ContentIdea,
  type IdeaStatus,
  type IdeaSource,
} from '@gitroom/frontend/hooks/creator-data';

type Filter = 'all' | 'new' | 'saved';

const sourceMeta: Record<IdeaSource, { label: string; icon: typeof TrendingUp; class: string }> = {
  TRENDING: { label: 'Trending', icon: TrendingUp, class: 'bg-rose-50 text-rose-700 border-rose-200' },
  INSPIRATION: { label: 'Inspiration', icon: Users, class: 'bg-violet-50 text-violet-700 border-violet-200' },
  SEASONAL: { label: 'Seasonal', icon: CalendarIcon, class: 'bg-amber-50 text-amber-800 border-amber-200' },
  TOP_PERFORMING: { label: 'Your top', icon: Star, class: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  EVERGREEN: { label: 'Evergreen', icon: Sparkles, class: 'bg-sky-50 text-sky-700 border-sky-200' },
};

const formatIcon = (fmt: string) => {
  const f = fmt.toLowerCase();
  if (f === 'reel') return Film;
  if (f === 'carousel') return Layers;
  if (f === 'story') return ImageIcon;
  return ImageIcon;
};

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export default function IdeasPage() {
  const fetch = useFetch();
  const router = useRouter();
  const { data, isLoading, mutate } = useContentIdeas();
  const [filter, setFilter] = useState<Filter>('all');
  const [regenerating, setRegenerating] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const ideas = data?.ideas ?? [];
  const filtered = useMemo(() => {
    if (filter === 'all') return ideas.filter((i) => i.status !== 'DISMISSED');
    if (filter === 'saved') return ideas.filter((i) => i.status === 'SAVED');
    return ideas.filter((i) => i.status === 'NEW');
  }, [filter, ideas]);

  const regenerate = useCallback(async () => {
    setRegenerating(true);
    try {
      const res = await fetch('/creator/ideas', { method: 'POST' });
      if (res.ok) {
        const next = await res.json();
        await mutate(next, { revalidate: false });
      }
    } finally {
      setRegenerating(false);
    }
  }, [fetch, mutate]);

  const updateStatus = useCallback(
    async (id: string, status: IdeaStatus) => {
      setPendingId(id);
      const prev = data;
      // Optimistic — update locally so the swipe feels instant.
      if (data) {
        const next = {
          ...data,
          ideas: data.ideas.map((i) => (i.id === id ? { ...i, status } : i)),
        };
        await mutate(next, { revalidate: false });
      }
      try {
        const res = await fetch(`/creator/ideas/${id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ status }),
        });
        if (!res.ok && prev) {
          await mutate(prev, { revalidate: false });
        }
      } finally {
        setPendingId(null);
      }
    },
    [data, fetch, mutate]
  );

  const generateScript = useCallback(
    (idea: ContentIdea) => {
      void updateStatus(idea.id, 'USED');
      const prompt = idea.hook ? `${idea.title}\n\nHook: ${idea.hook}` : idea.title;
      router.push(`/creator/content/scripts?prompt=${encodeURIComponent(prompt)}`);
    },
    [router, updateStatus]
  );

  const savedCount = ideas.filter((i) => i.status === 'SAVED').length;
  const newCount = ideas.filter((i) => i.status === 'NEW').length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-6 lg:py-10">
      <header className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
              <Lightbulb className="h-4 w-4 text-amber-700" />
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 lg:text-3xl">Ideas</h1>
          </div>
          <p className="text-sm text-gray-500">
            10 weekly ideas, picked by your AI manager.{' '}
            {data?.weekOf && (
              <span className="text-gray-400">
                Week of {fmtDate(data.weekOf)} · refreshes every Monday
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex h-9 items-center rounded-full border border-gray-200 bg-white p-1">
            {(
              [
                { k: 'all' as const, label: 'All', count: ideas.filter((i) => i.status !== 'DISMISSED').length },
                { k: 'new' as const, label: 'New', count: newCount },
                { k: 'saved' as const, label: 'Saved', count: savedCount },
              ]
            ).map((t) => (
              <button
                key={t.k}
                type="button"
                onClick={() => setFilter(t.k)}
                className={cn(
                  'inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors',
                  filter === t.k ? 'bg-purple-600 text-white' : 'text-gray-600 hover:text-gray-900'
                )}
              >
                {t.label}
                <span
                  className={cn(
                    'inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px]',
                    filter === t.k ? 'bg-white/20' : 'bg-gray-100'
                  )}
                >
                  {t.count}
                </span>
              </button>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={regenerate}
            disabled={regenerating}
            className="h-9 gap-2"
          >
            {regenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span>Regenerate</span>
          </Button>
        </div>
      </header>

      {isLoading && !data ? (
        <SkeletonList count={6} />
      ) : filtered.length === 0 ? (
        <EmptyState filter={filter} onRegenerate={regenerate} regenerating={regenerating} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              pending={pendingId === idea.id}
              onSave={() => updateStatus(idea.id, idea.status === 'SAVED' ? 'NEW' : 'SAVED')}
              onDismiss={() => updateStatus(idea.id, 'DISMISSED')}
              onGenerate={() => generateScript(idea)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface IdeaCardProps {
  idea: ContentIdea;
  pending: boolean;
  onSave: () => void;
  onDismiss: () => void;
  onGenerate: () => void;
}

function IdeaCard({ idea, pending, onSave, onDismiss, onGenerate }: IdeaCardProps) {
  const SrcIcon = sourceMeta[idea.source].icon;
  const FmtIcon = formatIcon(idea.format);
  const isSaved = idea.status === 'SAVED';
  return (
    <article
      className={cn(
        'group relative flex flex-col rounded-2xl border bg-white p-4 transition-shadow',
        'hover:shadow-md',
        pending && 'opacity-60',
        isSaved ? 'border-purple-300' : 'border-gray-200'
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium',
            sourceMeta[idea.source].class
          )}
        >
          <SrcIcon className="h-3 w-3" />
          {sourceMeta[idea.source].label}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-700">
          <FmtIcon className="h-3 w-3" />
          {idea.format}
        </span>
      </div>
      <h3 className="mb-2 text-sm font-semibold leading-snug text-gray-900">{idea.title}</h3>
      {idea.hook && (
        <p className="mb-3 line-clamp-3 text-xs leading-relaxed text-gray-600">
          <span className="font-medium text-gray-700">Hook · </span>
          {idea.hook}
        </p>
      )}
      {idea.rationale && (
        <p className="mb-3 line-clamp-2 text-[11px] italic leading-relaxed text-gray-400">
          {idea.rationale}
        </p>
      )}
      {typeof idea.estimatedEngagement === 'number' && (
        <div className="mb-3 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
          <TrendingUp className="h-3 w-3" />
          ~{idea.estimatedEngagement.toFixed(1)}% engagement
        </div>
      )}
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onSave}
            disabled={pending}
            aria-label={isSaved ? 'Unsave idea' : 'Save idea'}
            className={cn(
              'inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
              isSaved ? 'bg-purple-100 text-purple-700' : 'text-gray-400 hover:bg-gray-100 hover:text-rose-600'
            )}
          >
            <Heart className={cn('h-4 w-4', isSaved && 'fill-current')} />
          </button>
          <button
            type="button"
            onClick={onDismiss}
            disabled={pending}
            aria-label="Dismiss idea"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={onGenerate}
          disabled={pending}
          className="h-8 gap-1.5 bg-purple-600 px-3 text-xs hover:bg-purple-700"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Generate Script
        </Button>
      </div>
    </article>
  );
}

function EmptyState({
  filter,
  onRegenerate,
  regenerating,
}: {
  filter: Filter;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  if (filter === 'saved') {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-12 text-center">
        <Heart className="mx-auto mb-3 h-8 w-8 text-gray-300" />
        <p className="text-sm font-medium text-gray-700">No saved ideas yet</p>
        <p className="mt-1 text-xs text-gray-500">
          Tap the heart on an idea to keep it for later.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-12 text-center">
      <Lightbulb className="mx-auto mb-3 h-8 w-8 text-amber-300" />
      <p className="text-sm font-medium text-gray-700">No ideas for this filter</p>
      <p className="mt-1 text-xs text-gray-500">Regenerate to get a fresh batch.</p>
      <Button
        type="button"
        size="sm"
        onClick={onRegenerate}
        disabled={regenerating}
        className="mt-4 gap-2 bg-purple-600 hover:bg-purple-700"
      >
        {regenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        Regenerate
      </Button>
    </div>
  );
}
