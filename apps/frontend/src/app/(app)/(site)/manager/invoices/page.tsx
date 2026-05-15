'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  Plus,
  Send,
  CheckCircle2,
  Clock,
  Eye,
  AlertCircle,
  Loader2,
  Search,
} from 'lucide-react';
import { Button } from '@gitroom/frontend/components/shadcn/ui/button';
import { SkeletonList } from '@gitroom/frontend/components/ui/skeleton';
import { cn } from '@gitroom/frontend/lib/utils';
import { useInvoices, useRateCard, type InvoiceStatus, type InvoiceSummary } from '@gitroom/frontend/hooks/manager';

const CURRENCY_SYMBOL: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', CAD: 'C$', AUD: 'A$',
};

const statusMeta: Record<InvoiceStatus, { label: string; class: string; icon: typeof Send }> = {
  DRAFT: { label: 'Draft', class: 'bg-gray-100 text-gray-700', icon: FileText },
  SENT: { label: 'Sent', class: 'bg-sky-100 text-sky-700', icon: Send },
  VIEWED: { label: 'Viewed', class: 'bg-violet-100 text-violet-700', icon: Eye },
  PAID: { label: 'Paid', class: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  OVERDUE: { label: 'Overdue', class: 'bg-rose-100 text-rose-700', icon: AlertCircle },
  VOID: { label: 'Void', class: 'bg-gray-100 text-gray-400', icon: FileText },
};

type Filter = 'all' | InvoiceStatus;

export default function InvoicesPage() {
  const { data, isLoading } = useInvoices();
  const { data: rateCard } = useRateCard();
  const sym = (code: string) => CURRENCY_SYMBOL[code] ?? CURRENCY_SYMBOL[rateCard?.currency ?? 'USD'] ?? '$';
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const invoices = data?.invoices ?? [];
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices
      .filter((i) => (filter === 'all' ? true : i.status === filter))
      .filter((i) => {
        if (!q) return true;
        return `${i.number} ${i.brandName} ${i.brandEmail ?? ''}`.toLowerCase().includes(q);
      });
  }, [invoices, filter, search]);

  const totals = useMemo(() => {
    let paid = 0;
    let outstanding = 0;
    for (const i of invoices) {
      if (i.status === 'PAID') paid += i.total;
      else if (i.status === 'SENT' || i.status === 'VIEWED' || i.status === 'OVERDUE') outstanding += i.total;
    }
    return { paid, outstanding };
  }, [invoices]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-6 lg:py-10">
      <header className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100">
              <FileText className="h-4 w-4 text-purple-700" />
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 lg:text-3xl">Invoices</h1>
          </div>
          <p className="text-sm text-gray-500">Send branded invoices. Track sent, viewed, paid.</p>
        </div>
        <Link
          href="/manager/invoices/new"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-purple-600 px-4 text-sm font-medium text-white hover:bg-purple-700"
        >
          <Plus className="h-4 w-4" />
          New invoice
        </Link>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Outstanding" value={`${sym(rateCard?.currency ?? 'USD')}${totals.outstanding.toFixed(0)}`} tone="amber" />
        <StatTile label="Paid this year" value={`${sym(rateCard?.currency ?? 'USD')}${totals.paid.toFixed(0)}`} tone="emerald" />
        <StatTile label="Total invoices" value={String(invoices.length)} tone="purple" />
        <StatTile
          label="Paid invoices"
          value={String(invoices.filter((i) => i.status === 'PAID').length)}
          tone="sky"
        />
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
          <Search className="h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search invoices…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
          />
        </div>
        <div className="flex flex-wrap items-center rounded-xl border border-gray-200 bg-white p-1">
          {(['all', 'DRAFT', 'SENT', 'VIEWED', 'PAID', 'OVERDUE'] as Filter[]).map((f) => (
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
            </button>
          ))}
        </div>
      </div>

      {isLoading && !data ? (
        <SkeletonList count={4} />
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-12 text-center">
          <FileText className="mx-auto mb-3 h-8 w-8 text-gray-300" />
          <p className="text-sm font-medium text-gray-700">No invoices match.</p>
          <Link href="/manager/invoices/new" className="mt-3 inline-block text-xs text-purple-600 hover:underline">
            Create your first invoice →
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Number</th>
                <th className="px-4 py-2 text-left font-medium">Brand</th>
                <th className="px-4 py-2 text-left font-medium">Amount</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Due</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((inv) => (
                <InvoiceRow key={inv.id} inv={inv} sym={sym(inv.currency)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function InvoiceRow({ inv, sym }: { inv: InvoiceSummary; sym: string }) {
  const meta = statusMeta[inv.status];
  const Icon = meta.icon;
  const overdue = inv.dueAt && inv.status !== 'PAID' && inv.status !== 'VOID' && new Date(inv.dueAt) < new Date();
  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50">
      <td className="px-4 py-3 font-mono text-xs text-gray-700">
        <Link href={`/manager/invoices/${inv.id}`} className="hover:text-purple-600">
          {inv.number}
        </Link>
      </td>
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-gray-900">{inv.brandName}</p>
        {inv.brandEmail && <p className="text-[11px] text-gray-500">{inv.brandEmail}</p>}
      </td>
      <td className="px-4 py-3 font-medium text-gray-900">
        {sym}{inv.total.toFixed(2)}
      </td>
      <td className="px-4 py-3">
        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', meta.class)}>
          <Icon className="h-3 w-3" />
          {meta.label}
        </span>
      </td>
      <td className={cn('px-4 py-3 text-xs', overdue ? 'font-medium text-rose-600' : 'text-gray-500')}>
        {inv.dueAt ? new Date(inv.dueAt).toLocaleDateString() : '—'}
        {overdue && ' (overdue)'}
      </td>
    </tr>
  );
}

function StatTile({ label, value, tone }: { label: string; value: string; tone: 'amber' | 'emerald' | 'purple' | 'sky' }) {
  const map = {
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
    emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    purple: 'bg-purple-50 text-purple-800 border-purple-200',
    sky: 'bg-sky-50 text-sky-800 border-sky-200',
  } as const;
  return (
    <div className={cn('rounded-2xl border p-3', map[tone])}>
      <p className="text-[11px] uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
