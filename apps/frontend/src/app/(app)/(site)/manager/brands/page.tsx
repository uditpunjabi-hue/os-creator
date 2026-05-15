'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Plus,
  Search,
  RefreshCw,
  Loader2,
  ChevronRight,
  X,
} from 'lucide-react';
import { Button } from '@gitroom/frontend/components/shadcn/ui/button';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { SkeletonList } from '@gitroom/frontend/components/ui/skeleton';
import { cn } from '@gitroom/frontend/lib/utils';
import { useBrands, useRateCard, type BrandStatus, type BrandSummary } from '@gitroom/frontend/hooks/manager';

const CURRENCY_SYMBOL: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  INR: '₹',
  JPY: '¥',
  CAD: 'C$',
  AUD: 'A$',
};

const statusMeta: Record<BrandStatus, { label: string; class: string }> = {
  NEW: { label: 'New', class: 'bg-sky-100 text-sky-700' },
  ACTIVE: { label: 'Active', class: 'bg-emerald-100 text-emerald-700' },
  DORMANT: { label: 'Dormant', class: 'bg-amber-100 text-amber-800' },
  CHURNED: { label: 'Churned', class: 'bg-gray-100 text-gray-600' },
};

const fmtAgo = (iso: string | null) => {
  if (!iso) return 'never';
  const ms = Date.now() - new Date(iso).getTime();
  const d = Math.floor(ms / 86_400_000);
  if (d < 1) return 'today';
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
};

const fmtMoney = (n: number, sym: string) => {
  if (n === 0) return `${sym}0`;
  if (n >= 1000) return `${sym}${(n / 1000).toFixed(1)}k`;
  return `${sym}${n.toFixed(0)}`;
};

type Filter = 'all' | BrandStatus;

export default function BrandsPage() {
  const fetch = useFetch();
  const { data, isLoading, mutate } = useBrands();
  const { data: rateCard } = useRateCard();
  const sym = CURRENCY_SYMBOL[rateCard?.currency ?? 'USD'] ?? '$';
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const brands = data?.brands ?? [];

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return brands
      .filter((b) => (filter === 'all' ? true : b.status === filter))
      .filter((b) => {
        if (!q) return true;
        const hay = `${b.name} ${b.industry ?? ''} ${b.contactEmail ?? ''}`.toLowerCase();
        return hay.includes(q);
      });
  }, [brands, filter, search]);

  const sync = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetch('/manager/brands?sync=1');
      if (res.ok) {
        const fresh = await res.json();
        await mutate(fresh, { revalidate: false });
      }
    } finally {
      setSyncing(false);
    }
  }, [fetch, mutate]);

  const create = useCallback(
    async (payload: { name: string; industry?: string; contactName?: string; contactEmail?: string; notes?: string }) => {
      setCreating(true);
      try {
        const res = await fetch('/manager/brands', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          await mutate();
          setShowNew(false);
        }
      } finally {
        setCreating(false);
      }
    },
    [fetch, mutate]
  );

  const counts = useMemo(() => {
    const out: Record<Filter, number> = { all: brands.length, NEW: 0, ACTIVE: 0, DORMANT: 0, CHURNED: 0 };
    for (const b of brands) out[b.status] += 1;
    return out;
  }, [brands]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-6 lg:py-10">
      <header className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
              <Building2 className="h-4 w-4 text-emerald-700" />
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 lg:text-3xl">Brands</h1>
          </div>
          <p className="text-sm text-gray-500">
            Every brand you&apos;ve worked with. Auto-synced from your inbox.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={sync} disabled={syncing} className="h-9 gap-2">
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sync inbox
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => setShowNew(true)}
            className="h-9 gap-2 bg-purple-600 hover:bg-purple-700"
          >
            <Plus className="h-4 w-4" />
            New brand
          </Button>
        </div>
      </header>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
          <Search className="h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search brands…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
          />
        </div>
        <div className="flex items-center rounded-xl border border-gray-200 bg-white p-1">
          {(['all', 'NEW', 'ACTIVE', 'DORMANT', 'CHURNED'] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                filter === f ? 'bg-purple-600 text-white' : 'text-gray-600 hover:text-gray-900'
              )}
            >
              {f === 'all' ? 'All' : statusMeta[f].label}
              <span
                className={cn(
                  'ml-1 rounded-full px-1 text-[10px]',
                  filter === f ? 'bg-white/20' : 'bg-gray-100'
                )}
              >
                {counts[f]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {isLoading && !data ? (
        <SkeletonList count={4} />
      ) : visible.length === 0 ? (
        <EmptyState onSync={sync} syncing={syncing} hasAny={brands.length > 0} />
      ) : (
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {visible.map((b) => (
            <BrandCard key={b.id} brand={b} sym={sym} />
          ))}
        </div>
      )}

      {showNew && <NewBrandModal onClose={() => setShowNew(false)} onSubmit={create} submitting={creating} />}
    </div>
  );
}

function BrandCard({ brand, sym }: { brand: BrandSummary; sym: string }) {
  const meta = statusMeta[brand.status];
  return (
    <Link
      href={`/manager/brands/${brand.id}`}
      className="group flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-100 to-emerald-100 text-xs font-semibold text-purple-900">
        {brand.name.slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-gray-900">{brand.name}</p>
          <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-medium', meta.class)}>
            {meta.label}
          </span>
        </div>
        <p className="truncate text-xs text-gray-500">
          {brand.contactEmail ?? brand.industry ?? 'No contact info'}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
          <span>
            <span className="font-medium text-emerald-700">{fmtMoney(brand.totalEarned, sym)}</span> earned
          </span>
          <span>·</span>
          <span>
            {brand.dealsCount} {brand.dealsCount === 1 ? 'deal' : 'deals'}
          </span>
          <span>·</span>
          <span>last {fmtAgo(brand.lastInteraction)}</span>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 group-hover:text-gray-500" />
    </Link>
  );
}

function NewBrandModal({
  onClose,
  onSubmit,
  submitting,
}: {
  onClose: () => void;
  onSubmit: (p: { name: string; industry?: string; contactName?: string; contactEmail?: string; notes?: string }) => void;
  submitting: boolean;
}) {
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [notes, setNotes] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Add brand</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-col gap-3">
          <Field label="Brand name" value={name} onChange={setName} placeholder="Acme Co" required />
          <Field label="Industry" value={industry} onChange={setIndustry} placeholder="Beauty, fitness…" />
          <Field label="Contact name" value={contactName} onChange={setContactName} placeholder="Alice Smith" />
          <Field label="Contact email" value={contactEmail} onChange={setContactEmail} placeholder="alice@acme.com" type="email" />
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">Notes</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-purple-400"
              placeholder="Anything to remember about this brand…"
            />
          </div>
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() =>
              name.trim() &&
              onSubmit({
                name: name.trim(),
                industry: industry.trim() || undefined,
                contactName: contactName.trim() || undefined,
                contactEmail: contactEmail.trim().toLowerCase() || undefined,
                notes: notes.trim() || undefined,
              })
            }
            disabled={submitting || !name.trim()}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-700">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-purple-400"
      />
    </div>
  );
}

function EmptyState({ onSync, syncing, hasAny }: { onSync: () => void; syncing: boolean; hasAny: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-12 text-center">
      <Building2 className="mx-auto mb-3 h-8 w-8 text-emerald-300" />
      <p className="text-sm font-medium text-gray-700">
        {hasAny ? 'No brands match this filter' : 'No brands yet'}
      </p>
      <p className="mt-1 text-xs text-gray-500">
        {hasAny
          ? 'Try another filter or clear search.'
          : 'Sync your inbox to auto-create brand contacts from email senders.'}
      </p>
      {!hasAny && (
        <Button
          type="button"
          size="sm"
          onClick={onSync}
          disabled={syncing}
          className="mt-4 gap-2 bg-purple-600 hover:bg-purple-700"
        >
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Sync inbox
        </Button>
      )}
    </div>
  );
}
