import { Metadata } from 'next';
import Link from 'next/link';
import { getPublicInvoice } from '@gitroom/frontend/lib/server/invoice';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Invoice · Illuminati',
};

const CURRENCY_SYMBOL: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', CAD: 'C$', AUD: 'A$',
};

export default async function PublicInvoicePage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const invoice = await getPublicInvoice(id);

  if (!invoice) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 text-center">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Invoice unavailable</h1>
          <p className="mt-2 text-sm text-gray-500">
            This invoice may have been withdrawn. Contact the sender for an update.
          </p>
        </div>
      </main>
    );
  }

  const sym = CURRENCY_SYMBOL[invoice.currency] ?? '$';
  const overdue =
    invoice.dueAt && invoice.status !== 'PAID' && new Date(invoice.dueAt) < new Date();

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <header className="flex items-center justify-between">
          <Link href="/" className="text-xs text-gray-400 hover:text-gray-700">
            Illuminati
          </Link>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              invoice.status === 'PAID'
                ? 'bg-emerald-100 text-emerald-700'
                : overdue
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-sky-100 text-sky-700'
            }`}
          >
            {invoice.status === 'PAID' ? 'PAID' : overdue ? 'OVERDUE' : invoice.status}
          </span>
        </header>

        <article className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500">From</p>
              <p className="mt-1 text-sm font-medium text-gray-900">{invoice.fromName ?? '—'}</p>
              {invoice.fromEmail && <p className="text-xs text-gray-500">{invoice.fromEmail}</p>}
              {invoice.fromAddress && (
                <p className="mt-1 whitespace-pre-line text-xs text-gray-500">{invoice.fromAddress}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider text-gray-500">Invoice</p>
              <p className="mt-1 font-mono text-lg font-semibold text-gray-900">{invoice.number}</p>
              <p className="text-xs text-gray-500">
                Issued {new Date(invoice.createdAt).toLocaleDateString()}
              </p>
              {invoice.dueAt && (
                <p className="text-xs text-gray-500">
                  Due {new Date(invoice.dueAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>

          <div className="mb-8">
            <p className="text-xs uppercase tracking-wider text-gray-500">Bill to</p>
            <p className="mt-1 text-sm font-medium text-gray-900">{invoice.brandName}</p>
            {invoice.brandEmail && <p className="text-xs text-gray-500">{invoice.brandEmail}</p>}
            {invoice.brandAddress && (
              <p className="mt-1 whitespace-pre-line text-xs text-gray-500">{invoice.brandAddress}</p>
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
              {invoice.items.map((i, idx) => (
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
            <div className="flex w-full max-w-xs items-center justify-between">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-medium text-gray-900">{sym}{invoice.subtotal.toFixed(2)}</span>
            </div>
            {invoice.taxRate > 0 && (
              <div className="flex w-full max-w-xs items-center justify-between">
                <span className="text-gray-500">Tax ({(invoice.taxRate * 100).toFixed(1)}%)</span>
                <span className="font-medium text-gray-900">{sym}{invoice.taxAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="mt-1 flex w-full max-w-xs items-center justify-between border-t border-gray-200 pt-2 text-base font-semibold">
              <span className="text-gray-900">Total</span>
              <span className="text-gray-900">{invoice.currency} {invoice.total.toFixed(2)}</span>
            </div>
          </div>

          {invoice.notes && (
            <div className="mt-8 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
              <p className="mb-1 font-medium uppercase tracking-wide text-gray-500">Notes</p>
              <p className="whitespace-pre-line">{invoice.notes}</p>
            </div>
          )}
          {invoice.terms && (
            <div className="mt-3 text-xs text-gray-500">
              <p className="mb-1 font-medium uppercase tracking-wide">Terms</p>
              <p className="whitespace-pre-line">{invoice.terms}</p>
            </div>
          )}
        </article>

        <p className="text-center text-[11px] text-gray-400">
          Generated by Illuminati · Creator OS
        </p>
      </div>
    </main>
  );
}
