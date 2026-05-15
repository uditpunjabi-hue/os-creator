'use client';

import { useEffect, useState } from 'react';
import {
  Bell,
  Plus,
  ArrowDownRight,
  ArrowUpRight,
  Wallet,
  Loader2,
  CheckCircle2,
  FileText,
  Trash2,
  Sparkles,
  X,
  Send,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@gitroom/frontend/components/shadcn/ui/button';
import { Badge } from '@gitroom/frontend/components/shadcn/ui/badge';
import { Modal } from '@gitroom/frontend/components/shadcn/ui/modal';
import { Input } from '@gitroom/frontend/components/shadcn/ui/input';
import {
  useInfluencers,
  useManagerMutations,
  usePayments,
  usePaymentSummary,
  type PaymentRow,
  type PaymentStatusKey,
} from '@gitroom/frontend/hooks/manager';
import { cn } from '@gitroom/frontend/lib/utils';

const statusMeta: Record<
  PaymentStatusKey,
  { label: string; variant: 'secondary' | 'warning' | 'success' | 'destructive' }
> = {
  PENDING: { label: 'Pending', variant: 'secondary' },
  INVOICED: { label: 'Invoiced', variant: 'warning' },
  PAID: { label: 'Paid', variant: 'success' },
  OVERDUE: { label: 'Overdue', variant: 'destructive' },
};

const fmt = (n: number, c = '$') => `${c}${Math.round(n).toLocaleString()}`;
const fmtDate = (s: string | null) => {
  if (!s) return '—';
  const d = new Date(s);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export default function PaymentsPage() {
  const { data: payments, isLoading } = usePayments();
  const { data: summary } = usePaymentSummary();
  const { data: influencers } = useInfluencers();
  const { paymentAction, deletePayment } = useManagerMutations();
  const [addOpen, setAddOpen] = useState(false);
  // Payment being reminded — opens the AI-drafted reminder modal.
  const [reminderPayment, setReminderPayment] = useState<PaymentRow | null>(null);

  const summaries = [
    {
      label: 'Pending',
      value: summary?.pending ?? 0,
      tone: 'bg-amber-50 text-amber-700',
      icon: Wallet,
      sub: 'Awaiting payment',
    },
    {
      label: 'Overdue',
      value: summary?.overdue ?? 0,
      tone: 'bg-red-50 text-red-700',
      icon: ArrowDownRight,
      sub: 'Past due date',
    },
    {
      label: 'Received',
      value: summary?.paid ?? 0,
      tone: 'bg-green-50 text-green-700',
      icon: ArrowUpRight,
      sub: 'Paid out',
    },
  ];

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 lg:px-8 lg:py-5">
        <div>
          <div className="text-lg font-semibold text-gray-900">Payments</div>
          <div className="text-xs text-gray-500">Track invoices across every brand</div>
        </div>
        <Button
          size="sm"
          className="h-11"
          onClick={() => setAddOpen(true)}
          disabled={(influencers?.length ?? 0) === 0}
          title={(influencers?.length ?? 0) === 0 ? 'Add a creator first' : undefined}
        >
          <Plus className="h-4 w-4" /> New
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 lg:px-8 lg:py-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {summaries.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="text-xs uppercase tracking-wider text-gray-500">{s.label}</div>
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${s.tone}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3 text-2xl font-semibold text-gray-900">{fmt(s.value)}</div>
                <div className="mt-1 text-xs text-gray-400">{s.sub}</div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="hidden grid-cols-[1.4fr_1.2fr_1fr_1fr_0.8fr_120px] gap-3 border-b border-gray-100 bg-gray-50 px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 lg:grid">
            <div>Brand</div>
            <div>Influencer</div>
            <div>Amount</div>
            <div>Due</div>
            <div>Status</div>
            <div className="text-right">Actions</div>
          </div>

          {isLoading && !payments ? (
            <div className="flex items-center justify-center px-5 py-12 text-sm text-gray-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading payments…
            </div>
          ) : (payments ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center px-5 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-50 text-purple-600">
                <Wallet className="h-6 w-6" />
              </div>
              <div className="mt-4 text-sm font-semibold text-gray-900">No payments yet</div>
              <p className="mt-1 text-xs text-gray-500">
                Track invoices, mark them paid, and send reminders.
              </p>
              {(influencers?.length ?? 0) > 0 && (
                <Button className="mt-4 h-11" onClick={() => setAddOpen(true)}>
                  <Plus className="h-4 w-4" /> Add first payment
                </Button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {(payments ?? []).map((p) => (
                <PaymentRowItem
                  key={p.id}
                  payment={p}
                  onAction={(action) => paymentAction(p.id, action)}
                  onRemind={() => setReminderPayment(p)}
                  onDelete={() => deletePayment(p.id)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      <AddPaymentModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        influencers={influencers ?? []}
      />

      {reminderPayment && (
        <ReminderDraftSheet
          payment={reminderPayment}
          onClose={() => setReminderPayment(null)}
          onSent={() => setReminderPayment(null)}
        />
      )}
    </div>
  );
}

function PaymentRowItem({
  payment,
  onAction,
  onRemind,
  onDelete,
}: {
  payment: PaymentRow;
  onAction: (a: 'mark_invoiced' | 'mark_paid') => Promise<any>;
  onRemind: () => void;
  onDelete: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  // Auto-flag overdue rows in the UI even when the DB hasn't transitioned —
  // matches what the summary endpoint computes.
  const isOverdue =
    payment.paymentStatus !== 'PAID' &&
    !!payment.dueAt &&
    new Date(payment.dueAt).getTime() < Date.now();
  const effective: PaymentStatusKey =
    payment.paymentStatus === 'PAID'
      ? 'PAID'
      : isOverdue
      ? 'OVERDUE'
      : payment.paymentStatus;
  const meta = statusMeta[effective];

  const run = async (action: 'mark_invoiced' | 'mark_paid') => {
    setBusy(action);
    try {
      await onAction(action);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <li>
      <div
        className={cn(
          'grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-4 lg:grid-cols-[1.4fr_1.2fr_1fr_1fr_0.8fr_120px] lg:px-5 lg:py-3',
          isOverdue && 'border-l-4 border-rose-400 bg-rose-50/40'
        )}
      >
        <div className="flex flex-col gap-1 lg:contents">
          <div className="text-sm font-semibold text-gray-900">{payment.brand}</div>
          <div className="text-xs text-gray-500 lg:text-sm lg:text-gray-700">
            {payment.influencer?.name ?? '—'}
          </div>
          <div className="text-xs text-gray-500 lg:hidden">Due {fmtDate(payment.dueAt)}</div>
        </div>
        <div className="flex flex-col items-end gap-1 lg:flex-row lg:items-center lg:gap-0 lg:col-start-3">
          <div className="text-sm font-semibold text-gray-900">
            {fmt(payment.amount, payment.currency === 'USD' ? '$' : `${payment.currency} `)}
          </div>
        </div>
        <div className="hidden text-sm text-gray-500 lg:block">{fmtDate(payment.dueAt)}</div>
        <div className="hidden lg:block">
          <Badge variant={meta.variant}>{meta.label}</Badge>
        </div>
        <div className="lg:hidden">
          <Badge variant={meta.variant}>{meta.label}</Badge>
        </div>
        <div className="col-span-2 mt-2 flex flex-wrap items-center justify-end gap-1 lg:col-span-1 lg:mt-0">
          {payment.paymentStatus !== 'PAID' && (
            <>
              {payment.paymentStatus === 'PENDING' && (
                <button
                  type="button"
                  onClick={() => run('mark_invoiced')}
                  disabled={busy !== null}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                  title="Mark as invoiced"
                >
                  {busy === 'mark_invoiced' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileText className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={() => run('mark_paid')}
                disabled={busy !== null}
                className="rounded-lg px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
                title="Mark as paid"
              >
                {busy === 'mark_paid' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={onRemind}
                className="rounded-lg px-2 py-1 text-xs font-medium text-purple-700 hover:bg-purple-50"
                title="Draft reminder with AI and send"
              >
                <Bell className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={async () => {
              if (!confirm(`Delete ${payment.brand} payment?`)) return;
              try {
                await onDelete();
              } catch (e) {
                alert((e as Error).message);
              }
            }}
            className="rounded-lg px-2 py-1 text-xs text-gray-400 hover:bg-red-50 hover:text-red-600"
            title="Delete payment"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </li>
  );
}

interface AddPaymentModalProps {
  open: boolean;
  onClose: () => void;
  influencers: { id: string; name: string; handle: string | null }[];
}

function AddPaymentModal({ open, onClose, influencers }: AddPaymentModalProps) {
  const { createPayment } = useManagerMutations();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    brand: '',
    influencerId: '',
    amount: '',
    description: '',
    dueAt: '',
    status: 'PENDING' as PaymentStatusKey,
  });

  useEffect(() => {
    if (open && !form.influencerId && influencers.length > 0) {
      setForm((f) => ({ ...f, influencerId: influencers[0].id }));
    }
  }, [open, influencers]);

  const submit = async () => {
    if (!form.brand.trim()) return setError('Brand is required');
    if (!form.influencerId) return setError('Pick an influencer');
    if (!form.amount || Number(form.amount) <= 0) return setError('Amount must be positive');
    setSubmitting(true);
    setError(null);
    try {
      await createPayment({
        brand: form.brand.trim(),
        influencerId: form.influencerId,
        amount: Number(form.amount),
        description: form.description.trim() || undefined,
        dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : undefined,
        paymentStatus: form.status,
      });
      setForm({ brand: '', influencerId: '', amount: '', description: '', dueAt: '', status: 'PENDING' });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New payment"
      description="Invoice or expected payment from a brand."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} className="h-11">
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting} className="h-11">
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
        <FieldGroup label="Brand *">
          <Input
            value={form.brand}
            onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
            placeholder="Bloom & Co."
          />
        </FieldGroup>
        <FieldGroup label="Influencer *">
          <select
            value={form.influencerId}
            onChange={(e) => setForm((f) => ({ ...f, influencerId: e.target.value }))}
            className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
          >
            {influencers.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </FieldGroup>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="Amount *">
            <Input
              type="number"
              min={0}
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="3500"
            />
          </FieldGroup>
          <FieldGroup label="Due">
            <Input
              type="date"
              value={form.dueAt}
              onChange={(e) => setForm((f) => ({ ...f, dueAt: e.target.value }))}
            />
          </FieldGroup>
        </div>
        <FieldGroup label="Status">
          <select
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as PaymentStatusKey }))}
            className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
          >
            <option value="PENDING">Pending</option>
            <option value="INVOICED">Invoiced</option>
            <option value="PAID">Paid</option>
          </select>
        </FieldGroup>
        <FieldGroup label="Description">
          <Input
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="3 reels + 5 stories"
          />
        </FieldGroup>
      </div>
    </Modal>
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

// ---------------------------------------------------------------------------
// Reminder draft sheet — slides up on tap, fetches an AI-drafted email,
// lets the user edit subject/body, then sends via Gmail. The draft endpoint
// always returns a payload (deterministic fallback on Claude timeout) so the
// sheet never gets stuck waiting.
// ---------------------------------------------------------------------------

function ReminderDraftSheet({
  payment,
  onClose,
  onSent,
}: {
  payment: PaymentRow;
  onClose: () => void;
  onSent: () => void;
}) {
  const { draftPaymentReminder, paymentAction } = useManagerMutations();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [tone, setTone] = useState<'friendly' | 'firm' | 'final'>('friendly');
  const [partial, setPartial] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const draft = await draftPaymentReminder(payment.id);
        if (cancelled) return;
        setSubject(draft.subject);
        setBody(draft.body);
        setTone(draft.tone);
        setPartial(!!draft.partial);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [payment.id, draftPaymentReminder]);

  const send = async () => {
    if (sending || !subject.trim() || !body.trim()) return;
    setSending(true);
    setError(null);
    try {
      await paymentAction(payment.id, 'send_reminder', {
        subject: subject.trim(),
        body: body.trim(),
      });
      onSent();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const toneTone =
    tone === 'final'
      ? 'border-rose-300 bg-rose-50 text-rose-800'
      : tone === 'firm'
      ? 'border-amber-300 bg-amber-50 text-amber-800'
      : 'border-emerald-300 bg-emerald-50 text-emerald-800';

  const recipientEmail = payment.influencer && (payment.influencer as { email?: string }).email;

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 backdrop-blur-sm lg:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl lg:max-w-lg lg:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-gray-100 px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-purple-700">
              <Sparkles className="h-3 w-3" /> AI payment reminder
            </div>
            <div className="truncate text-sm font-semibold text-gray-900">
              {payment.brand} · {fmt(payment.amount, payment.currency === 'USD' ? '$' : `${payment.currency} `)}
            </div>
            <div className="truncate text-[11px] text-gray-500">
              {payment.influencer?.name ?? '—'}
              {recipientEmail ? ` · ${recipientEmail}` : ' · no email on file'}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Drafting with Illuminati AI…
            </div>
          )}
          {!loading && (
            <div className="flex flex-col gap-3">
              {partial && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <div>
                    AI timed out — showing a rule-based draft. Edit before sending or close and try again.
                  </div>
                </div>
              )}
              <div className={cn('inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider', toneTone)}>
                {tone} tone
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  Subject
                </label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  Body
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="min-h-[180px] w-full resize-y rounded-xl border border-gray-200 bg-white p-3 text-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
                />
              </div>
              {!recipientEmail && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                  Add an email address to {payment.influencer?.name ?? 'this contact'} in the roster before sending.
                </div>
              )}
              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 p-3">
          <Button
            className="h-12 w-full"
            onClick={send}
            disabled={loading || sending || !recipientEmail || !subject.trim() || !body.trim()}
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Sending…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" /> Send via Gmail
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
