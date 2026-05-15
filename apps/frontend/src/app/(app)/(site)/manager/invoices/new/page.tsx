'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@gitroom/frontend/components/shadcn/ui/button';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useRateCard, useManagerProfile, type InvoiceLineItem } from '@gitroom/frontend/hooks/manager';
import { cn } from '@gitroom/frontend/lib/utils';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD'];

export default function NewInvoicePage() {
  const fetch = useFetch();
  const router = useRouter();
  const { data: rateCard } = useRateCard();
  const { data: profile } = useManagerProfile();
  const [currency, setCurrency] = useState(rateCard?.currency ?? 'USD');
  const [brandName, setBrandName] = useState('');
  const [brandEmail, setBrandEmail] = useState('');
  const [brandAddress, setBrandAddress] = useState('');
  const [fromName, setFromName] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [fromAddress, setFromAddress] = useState('');

  // Profile loads via SWR after first render — backfill the From fields
  // once it arrives, but only if the user hasn't typed anything yet (so
  // we never trample an in-progress edit).
  useEffect(() => {
    if (!profile) return;
    const full = [profile.name, profile.lastName].filter(Boolean).join(' ').trim();
    setFromName((prev) => (prev ? prev : full));
    setFromEmail((prev) => (prev ? prev : profile.email ?? ''));
  }, [profile]);

  // Same pattern for currency: pick up the rate card default once it lands.
  useEffect(() => {
    if (rateCard?.currency) setCurrency((prev) => (prev === 'USD' ? rateCard.currency : prev));
  }, [rateCard?.currency]);
  const [items, setItems] = useState<InvoiceLineItem[]>([
    { description: '1× Instagram Reel', quantity: 1, unitPrice: rateCard?.reelRate ?? 500 },
  ]);
  const [taxRate, setTaxRate] = useState(0);
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('Payment due within 30 days.');
  const [dueAt, setDueAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotal = useMemo(
    () => items.reduce((s, i) => s + Math.max(0, i.quantity * i.unitPrice), 0),
    [items]
  );
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  const updateItem = (idx: number, patch: Partial<InvoiceLineItem>) => {
    setItems((prev) => prev.map((i, k) => (k === idx ? { ...i, ...patch } : i)));
  };

  const submit = useCallback(async () => {
    setError(null);
    if (!brandName.trim()) {
      setError('Brand name is required');
      return;
    }
    if (items.length === 0 || items.every((i) => !i.description.trim())) {
      setError('At least one line item is required');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/manager/invoices', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          brandName: brandName.trim(),
          brandEmail: brandEmail.trim() || undefined,
          brandAddress: brandAddress.trim() || undefined,
          fromName: fromName.trim() || undefined,
          fromEmail: fromEmail.trim() || undefined,
          fromAddress: fromAddress.trim() || undefined,
          items: items.filter((i) => i.description.trim()),
          taxRate: taxRate / 100,
          currency,
          notes: notes.trim() || undefined,
          terms: terms.trim() || undefined,
          dueAt: dueAt || undefined,
        }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(txt || 'Could not create invoice');
      }
      const created = await res.json();
      router.push(`/manager/invoices/${created.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }, [brandName, brandEmail, brandAddress, fromName, fromEmail, fromAddress, items, taxRate, currency, notes, terms, dueAt, fetch, router]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 lg:px-6 lg:py-10">
      <Link
        href="/manager/invoices"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Invoices
      </Link>

      <h1 className="mb-6 text-2xl font-semibold text-gray-900 lg:text-3xl">New invoice</h1>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Bill to">
          <Field label="Brand name" value={brandName} onChange={setBrandName} required placeholder="Acme Co" />
          <Field label="Email" value={brandEmail} onChange={setBrandEmail} placeholder="ap@acme.com" type="email" />
          <TextArea label="Address" value={brandAddress} onChange={setBrandAddress} rows={2} />
        </Card>

        <Card title="From">
          <Field label="Your name" value={fromName} onChange={setFromName} />
          <Field label="Your email" value={fromEmail} onChange={setFromEmail} />
          <TextArea label="Your address" value={fromAddress} onChange={setFromAddress} rows={2} />
        </Card>
      </div>

      <Card title="Line items" className="mt-4">
        <div className="flex flex-col gap-2">
          {items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2">
              <input
                type="text"
                value={item.description}
                onChange={(e) => updateItem(idx, { description: e.target.value })}
                placeholder="Description"
                className="col-span-6 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-purple-400"
              />
              <input
                type="number"
                value={item.quantity}
                onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                placeholder="Qty"
                className="col-span-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-purple-400"
              />
              <input
                type="number"
                step="0.01"
                value={item.unitPrice}
                onChange={(e) => updateItem(idx, { unitPrice: Number(e.target.value) })}
                placeholder="Unit price"
                className="col-span-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-purple-400"
              />
              <button
                type="button"
                onClick={() => setItems((prev) => prev.filter((_, k) => k !== idx))}
                className="col-span-1 inline-flex items-center justify-center rounded-lg text-gray-400 hover:bg-rose-50 hover:text-rose-600"
                aria-label="Remove line"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setItems((prev) => [...prev, { description: '', quantity: 1, unitPrice: 0 }])}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-purple-600 hover:text-purple-700"
        >
          <Plus className="h-4 w-4" /> Add line
        </button>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Totals">
          <div className="space-y-2 text-sm">
            <Row label="Subtotal" value={`${subtotal.toFixed(2)}`} />
            <div className="flex items-center gap-3">
              <label className="text-xs font-medium text-gray-700">Tax %</label>
              <input
                type="number"
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value))}
                min={0}
                max={100}
                step={0.5}
                className="w-20 rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm outline-none focus:border-purple-400"
              />
              <label className="ml-auto text-xs text-gray-500">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm outline-none"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <Row label="Tax" value={taxAmount.toFixed(2)} />
            <div className="border-t border-gray-200 pt-2">
              <Row label="Total" value={`${currency} ${total.toFixed(2)}`} bold />
            </div>
          </div>
        </Card>

        <Card title="Details">
          <Field label="Due date" type="date" value={dueAt} onChange={setDueAt} />
          <TextArea label="Notes" value={notes} onChange={setNotes} rows={2} placeholder="Thanks for the collab!" />
          <TextArea label="Terms" value={terms} onChange={setTerms} rows={2} />
        </Card>
      </div>

      <div className="mt-6 flex items-center justify-end gap-2">
        <Link href="/manager/invoices" className="text-sm text-gray-500 hover:text-gray-900">
          Cancel
        </Link>
        <Button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="h-10 gap-2 bg-purple-600 hover:bg-purple-700"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Create invoice
        </Button>
      </div>
    </div>
  );
}

function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-2xl border border-gray-200 bg-white p-4', className)}>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required,
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

function TextArea({
  label,
  value,
  onChange,
  rows = 3,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-700">{label}</label>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-purple-400"
      />
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between', bold && 'text-base font-semibold')}>
      <span className={cn(bold ? 'text-gray-900' : 'text-gray-600')}>{label}</span>
      <span className={cn(bold ? 'text-gray-900' : 'text-gray-900')}>{value}</span>
    </div>
  );
}
