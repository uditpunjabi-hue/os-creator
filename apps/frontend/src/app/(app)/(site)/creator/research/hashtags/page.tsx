'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  Hash,
  Search,
  Copy,
  Check,
  BookmarkPlus,
  Trash2,
  Sparkles,
  Loader2,
  TrendingUp,
  Flame,
  Zap,
  Target,
} from 'lucide-react';
import { Button } from '@gitroom/frontend/components/shadcn/ui/button';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { cn } from '@gitroom/frontend/lib/utils';
import {
  useHashtagSets,
  type HashtagGroups,
  type HashtagBucket,
  type HashtagSuggestion,
} from '@gitroom/frontend/hooks/creator-data';

const bucketMeta: Record<HashtagBucket, { label: string; icon: typeof Flame; class: string; subtitle: string }> = {
  high: { label: 'High competition', icon: Flame, class: 'border-rose-200 bg-rose-50 text-rose-700', subtitle: '>1M posts — broad reach, hard to rank' },
  medium: { label: 'Medium', icon: TrendingUp, class: 'border-amber-200 bg-amber-50 text-amber-800', subtitle: '100K–1M — sweet spot' },
  low: { label: 'Low competition', icon: Zap, class: 'border-emerald-200 bg-emerald-50 text-emerald-700', subtitle: '<100K — best for growth' },
  niche: { label: 'Niche', icon: Target, class: 'border-violet-200 bg-violet-50 text-violet-700', subtitle: 'Community-specific' },
};

export default function HashtagsPage() {
  const fetch = useFetch();
  const [topic, setTopic] = useState('');
  const [groups, setGroups] = useState<HashtagGroups | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [savingSet, setSavingSet] = useState(false);
  const [setName, setSetName] = useState('');
  const { data: savedData, mutate: mutateSets } = useHashtagSets();

  const research = useCallback(async () => {
    const t = topic.trim();
    if (!t || loading) return;
    setLoading(true);
    setError(null);
    setSelected(new Set());
    try {
      const res = await fetch('/creator/hashtags/research', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ topic: t }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(txt || `Request failed (${res.status})`);
      }
      const data = (await res.json()) as HashtagGroups;
      setGroups(data);
      // Pre-select all low + niche — usually the most useful for the user.
      const preset = new Set<string>([...data.low, ...data.niche].map((h) => h.tag));
      setSelected(preset);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [topic, loading, fetch]);

  const allHashtags = useMemo<HashtagSuggestion[]>(() => {
    if (!groups) return [];
    return [...groups.high, ...groups.medium, ...groups.low, ...groups.niche];
  }, [groups]);

  const toggle = (tag: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const selectedTags = useMemo(
    () => allHashtags.filter((h) => selected.has(h.tag)).map((h) => h.tag),
    [allHashtags, selected]
  );

  const copyAll = useCallback(async () => {
    const text = selectedTags.length > 0 ? selectedTags.join(' ') : allHashtags.map((h) => h.tag).join(' ');
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — silent */
    }
  }, [selectedTags, allHashtags]);

  const saveAsSet = useCallback(async () => {
    const tags = selectedTags.length > 0 ? selectedTags : allHashtags.map((h) => h.tag);
    if (tags.length === 0) return;
    const name = setName.trim() || groups?.topic || 'Untitled set';
    setSavingSet(true);
    try {
      await fetch('/creator/hashtags/sets', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, topic: groups?.topic, tags }),
      });
      setSetName('');
      await mutateSets();
    } finally {
      setSavingSet(false);
    }
  }, [selectedTags, allHashtags, setName, groups, fetch, mutateSets]);

  const deleteSet = useCallback(
    async (id: string) => {
      await fetch(`/creator/hashtags/sets/${id}`, { method: 'DELETE' });
      await mutateSets();
    },
    [fetch, mutateSets]
  );

  const sets = savedData?.sets ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 lg:px-6 lg:py-10">
      <header className="mb-6">
        <div className="mb-1 flex items-center gap-2">
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100">
            <Hash className="h-4 w-4 text-sky-700" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 lg:text-3xl">Hashtag research</h1>
        </div>
        <p className="text-sm text-gray-500">
          Enter a topic. We&apos;ll group 30 hashtags by competition so you can mix high-reach with low-rank options.
        </p>
      </header>

      <div className="mb-6 flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
          <Search className="h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="e.g. 'fitness motivation', 'small biz marketing'"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void research();
            }}
            className="flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
          />
        </div>
        <Button
          type="button"
          onClick={research}
          disabled={loading || topic.trim().length === 0}
          className="h-10 gap-2 bg-purple-600 hover:bg-purple-700"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Research
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      {!groups && !loading && (
        <SavedSets sets={sets} onDelete={deleteSet} onCopy={(tags) => navigator.clipboard?.writeText(tags.join(' '))} />
      )}

      {groups && (
        <>
          {groups.frequentlyUsed.length > 0 && (
            <div className="mb-4 rounded-xl border border-gray-200 bg-white p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                You frequently use
              </p>
              <div className="flex flex-wrap gap-1.5">
                {groups.frequentlyUsed.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-purple-200 bg-purple-50 p-3">
            <span className="text-xs font-medium text-purple-900">
              {selected.size} of 30 selected
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="Set name (optional)"
                value={setName}
                onChange={(e) => setSetName(e.target.value)}
                className="h-8 rounded-lg border border-purple-200 bg-white px-2 text-xs outline-none placeholder:text-purple-400"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={saveAsSet}
                disabled={savingSet}
                className="h-8 gap-1.5 border-purple-300 text-purple-900"
              >
                {savingSet ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <BookmarkPlus className="h-3.5 w-3.5" />
                )}
                Save set
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={copyAll}
                className="h-8 gap-1.5 bg-purple-600 hover:bg-purple-700"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : `Copy ${selectedTags.length || 'all'}`}
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {(['high', 'medium', 'low', 'niche'] as HashtagBucket[]).map((b) => (
              <BucketGroup
                key={b}
                bucket={b}
                items={groups[b]}
                selected={selected}
                onToggle={toggle}
                frequent={groups.frequentlyUsed}
              />
            ))}
          </div>

          <div className="mt-6">
            <SavedSets sets={sets} onDelete={deleteSet} onCopy={(tags) => navigator.clipboard?.writeText(tags.join(' '))} />
          </div>
        </>
      )}
    </div>
  );
}

function BucketGroup({
  bucket,
  items,
  selected,
  onToggle,
  frequent,
}: {
  bucket: HashtagBucket;
  items: HashtagSuggestion[];
  selected: Set<string>;
  onToggle: (t: string) => void;
  frequent: string[];
}) {
  const meta = bucketMeta[bucket];
  const Icon = meta.icon;
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4">
      <header className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <span
              className={cn(
                'inline-flex h-6 w-6 items-center justify-center rounded-md',
                meta.class.split(' ').slice(1).join(' ')
              )}
            >
              <Icon className="h-3 w-3" />
            </span>
            {meta.label}
            <span className="text-xs font-normal text-gray-500">· {items.length} tags</span>
          </h2>
          <p className="mt-0.5 text-[11px] text-gray-500">{meta.subtitle}</p>
        </div>
      </header>
      <div className="flex flex-wrap gap-1.5">
        {items.map((h) => {
          const isSelected = selected.has(h.tag);
          const isFrequent = frequent.includes(h.tag);
          return (
            <button
              key={h.tag}
              type="button"
              onClick={() => onToggle(h.tag)}
              title={h.rationale ? `${h.estimatedPosts} · ${h.rationale}` : h.estimatedPosts}
              className={cn(
                'group inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-all',
                isSelected
                  ? 'border-purple-400 bg-purple-100 text-purple-900'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
              )}
            >
              {isSelected && <Check className="h-3 w-3" />}
              <span>{h.tag}</span>
              <span className="text-[10px] font-normal text-gray-500 group-hover:text-gray-700">
                {h.estimatedPosts}
              </span>
              {isFrequent && (
                <span className="rounded-full bg-amber-100 px-1 text-[9px] text-amber-800">used</span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SavedSets({
  sets,
  onDelete,
  onCopy,
}: {
  sets: Array<{ id: string; name: string; topic: string | null; tags: string[]; updatedAt: string }>;
  onDelete: (id: string) => void;
  onCopy: (tags: string[]) => void;
}) {
  if (sets.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-10 text-center">
        <Hash className="mx-auto mb-2 h-7 w-7 text-gray-300" />
        <p className="text-sm font-medium text-gray-700">No saved sets yet</p>
        <p className="mt-1 text-xs text-gray-500">Research a topic and save your favorite groups.</p>
      </div>
    );
  }
  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Saved sets</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {sets.map((s) => (
          <article key={s.id} className="rounded-2xl border border-gray-200 bg-white p-4">
            <header className="mb-2 flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-gray-900">{s.name}</p>
                {s.topic && <p className="text-[11px] text-gray-500">Topic · {s.topic}</p>}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onCopy(s.tags)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  aria-label="Copy set"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(s.id)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-rose-50 hover:text-rose-600"
                  aria-label="Delete set"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </header>
            <div className="flex flex-wrap gap-1">
              {s.tags.slice(0, 12).map((t) => (
                <span key={t} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">
                  {t}
                </span>
              ))}
              {s.tags.length > 12 && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
                  +{s.tags.length - 12}
                </span>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
