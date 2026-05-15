'use client';

import { use, useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Send,
  CheckCircle2,
  Printer,
  Trash2,
  Loader2,
  Eye,
  Link as LinkIcon,
} from 'lucide-react';
import { Button } from '@gitroom/frontend/components/shadcn/ui/button';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useInvoice, type InvoiceStatus } from '@gitroom/frontend/hooks/manager';
import { cn } from '@gitroom/frontend/lib/utils';

const CURRENCY_SYMBOL: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', CAD: 'C$', AUD: 'A$',
};

const statusMeta: Record<InvoiceStatus, { label: string; class: string }> = {
  DRAFT: { label: 'Draft', class: 'bg-gray-100 text-gray-700' },
  SENT: { label: 'Sent', class: 'bg-sky-100 text-sky-700' },
  VIEWED: { label: 'Viewed', class: 'bg-violet-100 text-violet-700' },
  PAID: { label: 'Paid', class: 'bg-emerald-100 text-emerald-700' },
  OVERDUE: { label: 'Overdue', class: 'bg-rose-100 text-rose-700' },
  VOID: { label: 'Void', class: 'bg-gray-100 text-gray-400' },
};

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const fetch = useFetch();
  const router = useRouter();
  const { data, isLoading, mutate } = useInvoice(id);
  const [sending, setSending] = useState(false);
  const [marking, setMarking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const sym = CURRENCY_SYMBOL[data?.currency ?? 'USD'] ?? '$';

  const send = useCallback(async () => {
    if (!data) return;
    setActionError(null);
    setSending(true);
    try {
      const res = await fetch(`/manager/invoices/${id}/send`, { method: 'POST' });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(json.message || 'Send failed');
      }
      await mutate();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setSending(false);
    }
  }, [data, fetch, id, mutate]);

  const markPaid = useCallback(async () => {
    setMarking(true);
    try {
      await fetch(`/manager/invoices/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'PAID' }),
      });
      await mutate();
    } finally {
      setMarking(false);
    }
  }, [fetch, id, mutate]);

  const remove = useCallback(async () => {
    if (!confirm('Delete this invoice?')) return;
    setDeleting(true);
    try {
      const res = await fetch(`/manager/invoices/${id}`, { method: 'DELETE' });
      if (res.ok) router.push('/manager/invoices');
    } finally {
      setDeleting(false);
    }
  }, [fetch, id, router]);

  const copyLink = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/p/inv/${id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* silently ignored */
    }
  }, [id]);

  if (isLoading && !data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="h-32 animate-pulse rounded-2xl bg-gray-100" />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-gray-500">Invoice not found.</p>
        <Link href="/manager/invoices" className="mt-3 inline-flex items-center gap-1 text-sm text-purple-600">
          <ArrowLeft className="h-3 w-3" /> Back to invoices
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 lg:px-6 lg:py-10">
      <Link
        href="/manager/invoices"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Invoices
      </Link>

      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h1 className="font-mono text-2xl font-semibold text-gray-900">{data.number}</h1>
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', statusMeta[data.status].class)}>
              {statusMeta[data.status].label}
            </span>
          </div>
          <p className="text-sm text-gray-500">to {data.brandName}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={copyLink}
            className="h-9 gap-1.5"
          >
            <LinkIcon className="h-3.5 w-3.5" />
            {copied ? 'Copied!' : 'Copy link'}
          </Button>
          <Link
            href={`/p/inv/${data.id}`}
            target="_blank"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-700 hover:bg-gray-50"
          >
            <Eye className="h-3.5 w-3.5" />
            View
          </Link>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="h-9 gap-1.5"
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </Button>
          {data.status !== 'PAID' && (
            <Button
              type="button"
              size="sm"
              onClick={markPaid}
              disabled={marking}
              className="h-9 gap-1.5 bg-emerald-600 hover:bg-emerald-700"
            >
              {marking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Mark paid
            </Button>
          )}
          {(data.status === 'DRAFT' || data.status === 'SENT' || data.status === 'OVERDUE') && (
            <Button
              type="button"
              size="sm"
              onClick={send}
              disabled={sending || !data.brandEmail}
              className="h-9 gap-1.5 bg-purple-600 hover:bg-purple-700"
              title={!data.brandEmail ? 'Add brand email first' : 'Send via Gmail'}
            >
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {data.status === 'DRAFT' ? 'Send' : 'Resend'}
            </Button>
          )}
          <button
            type="button"
            onClick={remove}
            disabled={deleting}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-rose-50 hover:text-rose-600"
            aria-label="Delete invoice"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {actionError && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {actionError}
        </div>
      )}

      <article className="rounded-2xl border border-gray-200 bg-white p-6 print:border-0 print:p-0">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-500">From</p>
            <p className="mt-1 text-sm font-medium text-gray-900">{data.fromName ?? '—'}</p>
            {data.fromEmail && <p className="text-xs text-gray-500">{data.fromEmail}</p>}
            {data.fromAddress && <p className="mt-1 whitespace-pre-line text-xs text-gray-500">{data.fromAddress}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-gray-500">Invoice</p>
            <p className="mt-1 font-mono text-sm font-semibold text-gray-900">{data.number}</p>
            <p className="text-xs text-gray-500">Issued {new Date(data.createdAt).toLocaleDateString()}</p>
            {data.dueAt && <p className="text-xs text-gray-500">Due {new Date(data.dueAt).toLocaleDateString()}</p>}
          </div>
        </div>

        <div className="mb-6">
          <p className="text-xs uppercase tracking-wider text-gray-500">Bill to</p>
          <p className="mt-1 text-sm font-medium text-gray-900">{data.brandName}</p>
          {data.brandEmail && <p className="text-xs text-gray-500">{data.brandEmail}</p>}
          {data.brandAddress && (
            <p className="mt-1 whitespace-pre-line text-xs text-gray-500">{data.brandAddress}</p>
          )}
        </div>

        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="py-2 text-left font-medium">Description</th>
              <th className="py-2 text-right font-medium">Qty</th>
              <th className="py-2 text-right font-medium">Unit price</th>
              <th className="py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((i, idx) => (
              <tr key={idx} className="border-b border-gray-100">
                <td className="py-3 text-gray-900">{i.description}</td>
                <td className="py-3 text-right text-gray-700">{i.quantity}</td>
                <td className="py-3 text-right text-gray-700">{sym}{i.unitPrice.toFixed(2)}</td>
                <td className="py-3 text-right font-medium text-gray-900">
                  {sym}{(i.quantity * i.unitPrice).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex flex-col items-end gap-1 text-sm">
          <Line label="Subtotal" value={`${sym}${data.subtotal.toFixed(2)}`} />
          {data.taxRate > 0 && (
            <Line label={`Tax (${(data.taxRate * 100).toFixed(1)}%)`} value={`${sym}${data.taxAmount.toFixed(2)}`} />
          )}
          <Line label="Total" value={`${data.currency} ${data.total.toFixed(2)}`} bold />
        </div>

        {data.notes && (
          <div className="mt-6 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
            <p className="mb-1 font-medium uppercase tracking-wide text-gray-500">Notes</p>
            <p className="whitespace-pre-line">{data.notes}</p>
          </div>
        )}
        {data.terms && (
          <div className="mt-3 text-xs text-gray-500">
            <p className="mb-1 font-medium uppercase tracking-wide">Terms</p>
            <p className="whitespace-pre-line">{data.terms}</p>
          </div>
        )}
      </article>
    </div>
  );
}

function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div
      className={cn(
        'flex w-full max-w-xs items-center justify-between',
        bold && 'border-t border-gray-200 pt-2 text-base font-semibold'
      )}
    >
      <span className={cn(bold ? 'text-gray-900' : 'text-gray-500')}>{label}</span>
      <span className={cn(bold ? 'text-gray-900' : 'text-gray-900', 'font-medium')}>{value}</span>
    </div>
  );
}
