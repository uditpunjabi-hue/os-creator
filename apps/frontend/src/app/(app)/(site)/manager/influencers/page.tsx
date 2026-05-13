'use client';

import { useMemo, useState } from 'react';
import { Plus, Search, Instagram, TrendingUp, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@gitroom/frontend/components/shadcn/ui/button';
import { Badge } from '@gitroom/frontend/components/shadcn/ui/badge';
import { Modal } from '@gitroom/frontend/components/shadcn/ui/modal';
import { Input } from '@gitroom/frontend/components/shadcn/ui/input';
import { useInfluencers, useManagerMutations, type InfluencerRow } from '@gitroom/frontend/hooks/manager';

const initials = (name: string) =>
  name
    .split(' ')
    .map((s) => s[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

const palette = [
  'from-pink-300 to-purple-400',
  'from-amber-300 to-rose-400',
  'from-teal-300 to-emerald-400',
  'from-indigo-300 to-purple-500',
  'from-sky-300 to-blue-500',
  'from-rose-300 to-orange-400',
];
const hueFor = (id: string) => palette[parseInt(id.slice(0, 8), 16) % palette.length];

const formatFollowers = (n: number | null) => {
  if (!n) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
};

export default function InfluencersPage() {
  const { data, isLoading } = useInfluencers();
  const { createInfluencer, deleteInfluencer } = useManagerMutations();
  const [query, setQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    handle: '',
    platform: 'instagram',
    followers: '',
    engagement: '',
    email: '',
  });

  const filtered = useMemo(() => {
    const list = data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.handle ?? '').toLowerCase().includes(q)
    );
  }, [data, query]);

  const resetForm = () =>
    setForm({ name: '', handle: '', platform: 'instagram', followers: '', engagement: '', email: '' });

  const onCreate = async () => {
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createInfluencer({
        name: form.name.trim(),
        handle: form.handle.trim() || undefined,
        platform: form.platform || undefined,
        followers: form.followers ? Number(form.followers) : undefined,
        engagement: form.engagement ? Number(form.engagement) : undefined,
        email: form.email.trim() || undefined,
      });
      resetForm();
      setAddOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (id: string, name: string) => {
    if (!confirm(`Remove ${name}? Their deals and commercials stay.`)) return;
    try {
      await deleteInfluencer(id);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-col gap-3 border-b border-gray-200 bg-white px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-5">
        <div>
          <div className="text-lg font-semibold text-gray-900">Roster</div>
          <div className="text-xs text-gray-500">
            {data?.length ?? 0} creator{(data?.length ?? 0) === 1 ? '' : 's'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 lg:w-64 lg:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search creators"
              className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
            />
          </div>
          <Button className="h-11 shrink-0" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 lg:px-8 lg:py-6">
        {isLoading && !data ? (
          <div className="flex items-center justify-center py-12 text-sm text-gray-400">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading roster…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState onAdd={() => setAddOpen(true)} hasQuery={!!query} />
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((r) => (
              <InfluencerCard key={r.id} influencer={r} onDelete={onDelete} />
            ))}
          </div>
        )}
      </div>

      <Modal
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
          setError(null);
        }}
        title="Add influencer"
        description="They'll show up in deal and payment dropdowns immediately."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAddOpen(false)} className="h-11">
              Cancel
            </Button>
            <Button onClick={onCreate} disabled={submitting} className="h-11">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Create
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
          )}
          <FieldGroup label="Name *">
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Kira Shah"
            />
          </FieldGroup>
          <div className="grid grid-cols-2 gap-3">
            <FieldGroup label="Handle">
              <Input
                value={form.handle}
                onChange={(e) => setForm((f) => ({ ...f, handle: e.target.value }))}
                placeholder="@kira.shoots"
              />
            </FieldGroup>
            <FieldGroup label="Platform">
              <select
                value={form.platform}
                onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}
                className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
              >
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
                <option value="youtube">YouTube</option>
                <option value="x">X</option>
                <option value="linkedin">LinkedIn</option>
              </select>
            </FieldGroup>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FieldGroup label="Followers">
              <Input
                value={form.followers}
                onChange={(e) => setForm((f) => ({ ...f, followers: e.target.value }))}
                placeholder="125000"
                type="number"
                min={0}
              />
            </FieldGroup>
            <FieldGroup label="Engagement %">
              <Input
                value={form.engagement}
                onChange={(e) => setForm((f) => ({ ...f, engagement: e.target.value }))}
                placeholder="6.1"
                type="number"
                step="0.1"
                min={0}
                max={100}
              />
            </FieldGroup>
          </div>
          <FieldGroup label="Email">
            <Input
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="kira@studio.com"
              type="email"
            />
          </FieldGroup>
        </div>
      </Modal>
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-700">
      <span>{label}</span>
      {children}
    </label>
  );
}

function EmptyState({ onAdd, hasQuery }: { onAdd: () => void; hasQuery: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-50 text-purple-600">
        <Instagram className="h-6 w-6" />
      </div>
      <div className="mt-4 text-sm font-semibold text-gray-900">
        {hasQuery ? 'No creators match that search' : 'Your roster is empty'}
      </div>
      <p className="mt-1 text-xs text-gray-500">
        {hasQuery
          ? 'Try a different name or handle.'
          : 'Add the creators you manage to start tracking deals and payments.'}
      </p>
      {!hasQuery && (
        <Button className="mt-4 h-11" onClick={onAdd}>
          <Plus className="h-4 w-4" /> Add your first creator
        </Button>
      )}
    </div>
  );
}

function InfluencerCard({
  influencer,
  onDelete,
}: {
  influencer: InfluencerRow;
  onDelete: (id: string, name: string) => void;
}) {
  return (
    <article className="group flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-purple-300">
      <div className="flex items-start gap-3">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${hueFor(influencer.id)} text-base font-semibold text-white shadow-sm`}
        >
          {initials(influencer.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-gray-900">{influencer.name}</div>
          <div className="flex items-center gap-1 truncate text-xs text-gray-500">
            <Instagram className="h-3 w-3" />
            {influencer.handle ?? '—'}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onDelete(influencer.id, influencer.name)}
          className="hidden h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 group-hover:flex"
          aria-label="Remove creator"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-lg bg-gray-50 p-2">
          <div className="text-gray-400">Followers</div>
          <div className="text-sm font-semibold text-gray-900">{formatFollowers(influencer.followers)}</div>
        </div>
        <div className="rounded-lg bg-gray-50 p-2">
          <div className="text-gray-400">Engagement</div>
          <div className="text-sm font-semibold text-gray-900">
            {influencer.engagement != null ? `${influencer.engagement}%` : '—'}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Badge variant="secondary">
          {influencer._count?.deals ?? 0} active deal
          {(influencer._count?.deals ?? 0) === 1 ? '' : 's'}
        </Badge>
        {influencer._count && influencer._count.commercials > 0 && (
          <div className="flex items-center gap-1 text-[11px] font-medium text-purple-700">
            <TrendingUp className="h-3 w-3" />
            {influencer._count.commercials} commercials
          </div>
        )}
      </div>
    </article>
  );
}
