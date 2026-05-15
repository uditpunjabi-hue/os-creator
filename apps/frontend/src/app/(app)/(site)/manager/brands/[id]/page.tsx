'use client';

import { use, useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Mail,
  Briefcase,
  DollarSign,
  Calendar,
  ExternalLink,
  Save,
  Trash2,
  Loader2,
  Building2,
} from 'lucide-react';
import { Button } from '@gitroom/frontend/components/shadcn/ui/button';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { cn } from '@gitroom/frontend/lib/utils';
import { useBrand, useRateCard, type BrandStatus } from '@gitroom/frontend/hooks/manager';

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

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function BrandDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const fetch = useFetch();
  const router = useRouter();
  const { data, isLoading, mutate } = useBrand(id);
  const [notes, setNotes] = useState<string | null>(null);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const symbol = useCallback((code?: string) => CURRENCY_SYMBOL[code ?? data?.currency ?? 'USD'] ?? '$', [data]);

  const patch = useCallback(
    async (payload: Record<string, unknown>) => {
      setSavingField(Object.keys(payload)[0]);
      try {
        const res = await fetch(`/manager/brands/${id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          await mutate();
        }
      } finally {
        setSavingField(null);
      }
    },
    [fetch, id, mutate]
  );

  const remove = useCallback(async () => {
    if (!confirm('Delete this brand contact? The underlying deals and payments will NOT be affected.')) return;
    setDeleting(true);
    try {
      const res = await fetch(`/manager/brands/${id}`, { method: 'DELETE' });
      if (res.ok) router.push('/manager/brands');
    } finally {
      setDeleting(false);
    }
  }, [fetch, id, router]);

  if (isLoading && !data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="h-32 animate-pulse rounded-2xl bg-gray-100" />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <p className="text-sm text-gray-500">Brand not found.</p>
        <Link href="/manager/brands" className="mt-3 inline-flex items-center gap-1 text-sm text-purple-600">
          <ArrowLeft className="h-3 w-3" /> Back to brands
        </Link>
      </div>
    );
  }
  const sym = symbol(data.currency);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 lg:px-6 lg:py-10">
      <Link
        href="/manager/brands"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Brands
      </Link>

      <header className="mb-6 flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 lg:flex-row lg:items-start">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-100 to-emerald-100 text-base font-semibold text-purple-900">
          {data.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold text-gray-900">{data.name}</h1>
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', statusMeta[data.status].class)}>
              {statusMeta[data.status].label}
            </span>
          </div>
          {data.contactEmail && (
            <p className="mt-1 inline-flex items-center gap-1 text-sm text-gray-600">
              <Mail className="h-3.5 w-3.5" />
              <a href={`mailto:${data.contactEmail}`} className="hover:text-purple-600">
                {data.contactEmail}
              </a>
            </p>
          )}
          {data.industry && <p className="mt-1 text-xs text-gray-500">{data.industry}</p>}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={data.status}
            onChange={(e) => patch({ status: e.target.value as BrandStatus })}
            disabled={savingField === 'status'}
            className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-xs"
          >
            {Object.entries(statusMeta).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={remove}
            disabled={deleting}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-rose-50 hover:text-rose-600"
            aria-label="Delete brand"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={DollarSign} label="Total earned" value={`${sym}${data.totalEarned.toFixed(0)}`} tone="emerald" />
        <StatTile icon={Briefcase} label="Deals" value={String(data.dealsCount)} tone="purple" />
        <StatTile icon={Mail} label="Email threads" value={String(data.threads.length)} tone="sky" />
        <StatTile
          icon={Calendar}
          label="Last contact"
          value={data.lastInteraction ? new Date(data.lastInteraction).toLocaleDateString() : '—'}
          tone="amber"
        />
      </div>

      <Section title="Notes">
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <textarea
            rows={3}
            value={notes ?? data.notes ?? ''}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything to remember about this brand…"
            className="w-full resize-none rounded-lg border border-transparent bg-gray-50 px-3 py-2 text-sm outline-none focus:border-purple-400 focus:bg-white"
          />
          <div className="mt-2 flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                if (notes !== null) patch({ notes });
              }}
              disabled={savingField === 'notes' || notes === null}
              className="h-8 gap-1.5"
            >
              {savingField === 'notes' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save
            </Button>
          </div>
        </div>
      </Section>

      <Section title={`Deals (${data.deals.length})`}>
        {data.deals.length === 0 ? (
          <EmptyMini icon={Briefcase} text="No deals with this brand yet." />
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {data.deals.map((d) => (
              <Link
                key={d.id}
                href={`/manager/deals?dealId=${d.id}`}
                className="group flex items-start justify-between gap-2 rounded-xl border border-gray-200 bg-white p-3 transition-shadow hover:shadow-md"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {sym}{d.offer.toFixed(0)}
                  </p>
                  <p className="text-xs text-gray-500">{d.stage}</p>
                  {d.deadline && (
                    <p className="mt-0.5 text-[11px] text-gray-400">due {new Date(d.deadline).toLocaleDateString()}</p>
                  )}
                </div>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-gray-300 group-hover:text-gray-500" />
              </Link>
            ))}
          </div>
        )}
      </Section>

      <Section title={`Payments (${data.payments.length})`}>
        {data.payments.length === 0 ? (
          <EmptyMini icon={DollarSign} text="No payments yet." />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Amount</th>
                  <th className="px-4 py-2 text-left font-medium">Paid</th>
                  <th className="px-4 py-2 text-left font-medium">Method</th>
                  <th className="px-4 py-2 text-left font-medium">Ref</th>
                </tr>
              </thead>
              <tbody>
                {data.payments.map((p) => (
                  <tr key={p.id} className="border-t border-gray-100">
                    <td className="px-4 py-2 font-medium text-emerald-700">
                      {symbol(p.currency)}{p.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {p.paidAt ? new Date(p.paidAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-2 text-gray-600">{p.method ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-500">{p.reference ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title={`Recent email threads (${data.threads.length})`}>
        {data.threads.length === 0 ? (
          <EmptyMini icon={Mail} text="No recent emails for this brand." />
        ) : (
          <ul className="flex flex-col gap-2">
            {data.threads.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/manager/inbox?thread=${t.id}`}
                  className="block rounded-xl border border-gray-200 bg-white p-3 transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900">{t.subject || '(no subject)'}</p>
                    <span className="shrink-0 text-[11px] text-gray-400">
                      {new Date(t.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-xs text-gray-500">{t.preview}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Briefcase;
  label: string;
  value: string;
  tone: 'emerald' | 'purple' | 'sky' | 'amber';
}) {
  const map = {
    emerald: 'bg-emerald-50 text-emerald-700',
    purple: 'bg-purple-50 text-purple-700',
    sky: 'bg-sky-50 text-sky-700',
    amber: 'bg-amber-50 text-amber-800',
  } as const;
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3">
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className={cn('inline-flex h-5 w-5 items-center justify-center rounded-md', map[tone])}>
          <Icon className="h-3 w-3" />
        </span>
        <span className="text-[11px] uppercase tracking-wide text-gray-500">{label}</span>
      </div>
      <p className="text-lg font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h2>
      {children}
    </section>
  );
}

function EmptyMini({ icon: Icon, text }: { icon: typeof Mail; text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 bg-white py-6 text-center">
      <Icon className="mx-auto mb-2 h-5 w-5 text-gray-300" />
      <p className="text-xs text-gray-500">{text}</p>
    </div>
  );
}
