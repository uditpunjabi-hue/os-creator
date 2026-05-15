'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus,
  Loader2,
  MoreHorizontal,
  GripVertical,
  DollarSign,
  Sparkles,
  AlertTriangle,
  TrendingUp,
  X,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import { Button } from '@gitroom/frontend/components/shadcn/ui/button';
import { Badge } from '@gitroom/frontend/components/shadcn/ui/badge';
import { Modal } from '@gitroom/frontend/components/shadcn/ui/modal';
import { Input } from '@gitroom/frontend/components/shadcn/ui/input';
import {
  useDeals,
  useInfluencers,
  useManagerMutations,
  useRateCard,
  type DealAdvice,
  type DealRow,
  type DealStageKey,
} from '@gitroom/frontend/hooks/manager';
import { cn } from '@gitroom/frontend/lib/utils';

const stages: { key: DealStageKey; label: string; accent: string }[] = [
  { key: 'LEAD', label: 'Lead', accent: 'bg-gray-100 text-gray-700' },
  { key: 'PROPOSAL_SENT', label: 'Proposal', accent: 'bg-blue-100 text-blue-700' },
  { key: 'NEGOTIATING', label: 'Negotiating', accent: 'bg-amber-100 text-amber-700' },
  { key: 'CONTRACT', label: 'Contract', accent: 'bg-indigo-100 text-indigo-700' },
  { key: 'PAYMENT', label: 'Payment', accent: 'bg-purple-100 text-purple-700' },
  { key: 'COMPLETED', label: 'Done', accent: 'bg-green-100 text-green-700' },
];

// Currency symbol comes from the org's RateCard so every page in the
// product reads the same setting (default ₹ for INR). The number-format is
// kept in one helper so adding new amount surfaces stays consistent.
const CURRENCY_SYMBOL: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
};
const fmtAmount = (n: number | null, sym: string) =>
  n == null ? '—' : `${sym}${Math.round(n).toLocaleString()}`;

export default function DealsPage() {
  const { data, isLoading } = useDeals();
  const { data: influencers } = useInfluencers();
  const { data: rateCard } = useRateCard();
  const { createDeal, moveDealStage } = useManagerMutations();
  const sym = CURRENCY_SYMBOL[rateCard?.currency ?? 'INR'] ?? '₹';

  const [optimistic, setOptimistic] = useState<DealRow[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  // Tapping a card opens the detail panel; tracked by id so the SWR list can
  // refresh under us without losing the open state.
  const [detailDealId, setDetailDealId] = useState<string | null>(null);

  const rows = optimistic ?? data ?? [];
  const byStage = useMemo(() => {
    const map: Record<DealStageKey, DealRow[]> = {
      LEAD: [],
      PROPOSAL_SENT: [],
      NEGOTIATING: [],
      CONTRACT: [],
      PAYMENT: [],
      COMPLETED: [],
    };
    for (const d of rows) map[d.stage].push(d);
    return map;
  }, [rows]);

  const totalValue = rows.reduce((a, d) => a + (d.offer ?? 0), 0);

  // Reset optimistic state once server confirms move
  useEffect(() => {
    if (!optimistic || !data) return;
    const sameLength = optimistic.length === data.length;
    const sameStages =
      sameLength && optimistic.every((o) => data.find((d) => d.id === o.id)?.stage === o.stage);
    if (sameStages) setOptimistic(null);
  }, [optimistic, data]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  const onDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);
  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const overId = e.over?.id as string | undefined;
    const draggedId = e.active.id as string;
    if (!overId) return;

    // overId is either a stage key or a deal id (when dropped on a card)
    let targetStage: DealStageKey | undefined = stages.find((s) => s.key === overId)?.key;
    if (!targetStage) {
      const overDeal = rows.find((d) => d.id === overId);
      if (overDeal) targetStage = overDeal.stage;
    }
    if (!targetStage) return;

    const current = rows.find((d) => d.id === draggedId);
    if (!current || current.stage === targetStage) return;

    const next = rows.map((d) => (d.id === draggedId ? { ...d, stage: targetStage! } : d));
    setOptimistic(next);
    try {
      await moveDealStage(draggedId, targetStage);
    } catch (err) {
      setOptimistic(null);
      alert(`Move failed: ${(err as Error).message}`);
    }
  };

  const activeDeal = activeId ? rows.find((d) => d.id === activeId) ?? null : null;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 lg:px-8 lg:py-5">
        <div>
          <div className="text-lg font-semibold text-gray-900">Deals</div>
          <div className="text-xs text-gray-500">
            {rows.length} active · {fmtAmount(totalValue, sym)} pipeline value
          </div>
        </div>
        <Button
          className="h-11"
          onClick={() => setAddOpen(true)}
          disabled={(influencers?.length ?? 0) === 0}
          title={(influencers?.length ?? 0) === 0 ? 'Add a creator first' : undefined}
        >
          <Plus className="h-4 w-4" /> New deal
        </Button>
      </header>

      {(influencers?.length ?? 0) === 0 && (
        <div className="mx-4 mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 lg:mx-8">
          You need at least one creator in your roster before you can create a deal.{' '}
          <a href="/manager/influencers" className="font-medium underline">
            Go to Roster
          </a>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="flex-1 overflow-x-auto overflow-y-hidden px-4 pt-4 lg:px-8 lg:pt-6">
          {isLoading && !data ? (
            <div className="flex items-center justify-center py-12 text-sm text-gray-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading deals…
            </div>
          ) : rows.length === 0 ? (
            <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-4 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-purple-100 text-purple-700">
                <Plus className="h-6 w-6" />
              </div>
              <div>
                <div className="text-base font-semibold text-gray-900">
                  No deals yet
                </div>
                <div className="mt-1 max-w-sm text-sm text-gray-600">
                  Track brand collaborations from first email to final payment.
                  Add one to see your pipeline come to life.
                </div>
              </div>
              <Button
                className="h-11"
                onClick={() => setAddOpen(true)}
                disabled={(influencers?.length ?? 0) === 0}
                title={(influencers?.length ?? 0) === 0 ? 'Add a creator first' : undefined}
              >
                <Plus className="h-4 w-4" /> Create your first deal
              </Button>
              {(influencers?.length ?? 0) === 0 && (
                <a
                  href="/manager/influencers"
                  className="text-xs font-medium text-purple-600 hover:text-purple-700"
                >
                  Set up a creator profile first →
                </a>
              )}
            </div>
          ) : (
            <div className="flex h-full min-w-max gap-3 pb-4 lg:gap-4">
              {stages.map((stage) => (
                <KanbanColumn
                  key={stage.key}
                  stage={stage}
                  deals={byStage[stage.key]}
                  activeId={activeId}
                  onOpenDeal={setDetailDealId}
                  sym={sym}
                />
              ))}
            </div>
          )}
        </div>

        <DragOverlay>{activeDeal ? <DealCard deal={activeDeal} sym={sym} dragging /> : null}</DragOverlay>
      </DndContext>

      <AddDealModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={async (body) => {
          await createDeal(body);
          setAddOpen(false);
        }}
        influencers={influencers ?? []}
      />

      {detailDealId && (
        <DealDetailSheet
          deal={rows.find((d) => d.id === detailDealId) ?? null}
          sym={sym}
          onClose={() => setDetailDealId(null)}
        />
      )}
    </div>
  );
}

function KanbanColumn({
  stage,
  deals,
  activeId,
  onOpenDeal,
  sym,
}: {
  stage: { key: DealStageKey; label: string; accent: string };
  deals: DealRow[];
  activeId: string | null;
  onOpenDeal: (id: string) => void;
  sym: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.key });
  return (
    <div className="flex w-[280px] flex-col gap-3 lg:w-[300px]">
      <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 shadow-sm">
        <div className="flex items-center gap-2">
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', stage.accent)}>
            {stage.label}
          </span>
          <span className="text-xs text-gray-500">{deals.length}</span>
        </div>
        <button className="text-gray-400 hover:text-gray-700" aria-label="Stage actions">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-[120px] flex-col gap-3 rounded-2xl border-2 border-dashed border-transparent p-1 transition-colors',
          isOver && 'border-purple-300 bg-purple-50/40'
        )}
      >
        {deals.map((d) => (
          <SortableDealCard key={d.id} deal={d} sym={sym} hidden={activeId === d.id} onOpen={onOpenDeal} />
        ))}
        {deals.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-xs text-gray-400">
            Drop here
          </div>
        )}
      </div>
    </div>
  );
}

function SortableDealCard({
  deal,
  sym,
  hidden,
  onOpen,
}: {
  deal: DealRow;
  sym: string;
  hidden?: boolean;
  onOpen?: (id: string) => void;
}) {
  const { setNodeRef, transform, transition, listeners, attributes, isDragging } = useSortable({
    id: deal.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: hidden ? 0 : isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <DealCard deal={deal} sym={sym} listeners={listeners} onOpen={onOpen} />
    </div>
  );
}

function DealCard({
  deal,
  sym,
  dragging,
  listeners,
  onOpen,
}: {
  deal: DealRow;
  sym: string;
  dragging?: boolean;
  listeners?: any;
  onOpen?: (id: string) => void;
}) {
  // Top half of the card is the tap target for the detail modal; the bottom
  // strip with the grip remains the drag handle, so taps and drags don't
  // collide.
  return (
    <article
      className={cn(
        'rounded-2xl border border-gray-200 bg-white shadow-sm transition-colors',
        dragging ? 'rotate-2 shadow-xl ring-2 ring-purple-200' : 'hover:border-purple-300'
      )}
    >
      <button
        type="button"
        onClick={() => onOpen?.(deal.id)}
        className="flex w-full flex-col gap-3 rounded-2xl px-4 pb-3 pt-4 text-left transition-colors hover:bg-gray-50/60"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-gray-900">{deal.brand}</div>
            <div className="truncate text-xs text-gray-500">
              {deal.influencer?.name ?? '—'}
            </div>
          </div>
          <div className="text-base font-semibold text-purple-700">
            {sym}
            {Math.round(deal.offer).toLocaleString()}
          </div>
        </div>
        <div className="flex items-center justify-between text-[11px] text-gray-400">
          <span>Floor {fmtAmount(deal.floor, sym)}</span>
          <span>Ceiling {fmtAmount(deal.ceiling, sym)}</span>
        </div>
      </button>
      {listeners && (
        <div
          className="flex cursor-grab items-center justify-center rounded-b-2xl border-t border-gray-100 py-1.5 text-gray-300 active:cursor-grabbing"
          {...listeners}
          style={{ touchAction: 'none' }}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </div>
      )}
    </article>
  );
}

interface AddDealModalProps {
  open: boolean;
  onClose: () => void;
  influencers: { id: string; name: string; handle: string | null }[];
  onSubmit: (body: {
    brand: string;
    influencerId: string;
    offer: number;
    floor?: number;
    ceiling?: number;
    stage?: DealStageKey;
    notes?: string;
  }) => Promise<void>;
}

function AddDealModal({ open, onClose, influencers, onSubmit }: AddDealModalProps) {
  const [form, setForm] = useState({
    brand: '',
    influencerId: '',
    offer: '',
    floor: '',
    ceiling: '',
    notes: '',
    stage: 'LEAD' as DealStageKey,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && !form.influencerId && influencers.length > 0) {
      setForm((f) => ({ ...f, influencerId: influencers[0].id }));
    }
  }, [open, influencers]);

  const submit = async () => {
    if (!form.brand.trim()) return setError('Brand is required');
    if (!form.influencerId) return setError('Pick an influencer');
    if (!form.offer || Number(form.offer) <= 0) return setError('Offer must be positive');
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        brand: form.brand.trim(),
        influencerId: form.influencerId,
        offer: Number(form.offer),
        floor: form.floor ? Number(form.floor) : undefined,
        ceiling: form.ceiling ? Number(form.ceiling) : undefined,
        stage: form.stage,
        notes: form.notes.trim() || undefined,
      });
      setForm({ brand: '', influencerId: '', offer: '', floor: '', ceiling: '', notes: '', stage: 'LEAD' });
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
      title="New deal"
      description="Tracks a brand collaboration from lead to payment."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} className="h-11">
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting} className="h-11">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Create deal
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
                {i.name} {i.handle ? `· ${i.handle}` : ''}
              </option>
            ))}
          </select>
        </FieldGroup>
        <div className="grid grid-cols-3 gap-3">
          <FieldGroup label="Offer *">
            <Input
              type="number"
              min={0}
              value={form.offer}
              onChange={(e) => setForm((f) => ({ ...f, offer: e.target.value }))}
              placeholder="4200"
            />
          </FieldGroup>
          <FieldGroup label="Floor">
            <Input
              type="number"
              min={0}
              value={form.floor}
              onChange={(e) => setForm((f) => ({ ...f, floor: e.target.value }))}
              placeholder="3500"
            />
          </FieldGroup>
          <FieldGroup label="Ceiling">
            <Input
              type="number"
              min={0}
              value={form.ceiling}
              onChange={(e) => setForm((f) => ({ ...f, ceiling: e.target.value }))}
              placeholder="5500"
            />
          </FieldGroup>
        </div>
        <FieldGroup label="Stage">
          <select
            value={form.stage}
            onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value as DealStageKey }))}
            className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
          >
            {stages.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </FieldGroup>
        <FieldGroup label="Notes">
          <textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Brief, deliverables, anything to remember..."
            className="min-h-[80px] resize-y rounded-lg border border-gray-200 bg-white p-3 text-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
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
// Deal detail sheet — slide-up modal showing full deal info + AI Deal Advisor.
// Lives at the bottom of the page so it can read from the rows list directly;
// the advisor call is on-demand to avoid burning a Claude request per page
// load.
// ---------------------------------------------------------------------------

function DealDetailSheet({
  deal,
  sym,
  onClose,
}: {
  deal: DealRow | null;
  sym: string;
  onClose: () => void;
}) {
  const { fetchDealAdvice, moveDealStage, deleteDeal } = useManagerMutations();
  const [advice, setAdvice] = useState<DealAdvice | null>(null);
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [adviceError, setAdviceError] = useState<string | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    // Reset state when switching between deals.
    setAdvice(null);
    setAdviceError(null);
  }, [deal?.id]);

  if (!deal) return null;

  const runAdvisor = async () => {
    if (!deal || adviceLoading) return;
    setAdviceLoading(true);
    setAdviceError(null);
    try {
      const result = await fetchDealAdvice(deal.id);
      setAdvice(result);
    } catch (e) {
      setAdviceError((e as Error).message);
    } finally {
      setAdviceLoading(false);
    }
  };

  const verdictTone =
    advice?.verdict === 'STRONG'
      ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
      : advice?.verdict === 'FAIR'
      ? 'border-amber-300 bg-amber-50 text-amber-800'
      : advice?.verdict === 'WEAK'
      ? 'border-rose-300 bg-rose-50 text-rose-700'
      : advice?.verdict === 'WALK_AWAY'
      ? 'border-rose-500 bg-rose-100 text-rose-800'
      : 'border-gray-200 bg-gray-50 text-gray-700';

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 backdrop-blur-sm lg:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl lg:max-w-2xl lg:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-gray-100 px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-gray-900">{deal.brand}</div>
            <div className="text-xs text-gray-500">
              {deal.influencer?.name ?? '—'}
              {deal.influencer?.handle && (
                <span className="text-gray-400"> · @{deal.influencer.handle}</span>
              )}
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
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-2">
              <PriceTile label="Offer" value={deal.offer} sym={sym} accent="text-purple-700" />
              <PriceTile label="Floor" value={deal.floor} sym={sym} />
              <PriceTile label="Ceiling" value={deal.ceiling} sym={sym} />
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                Stage
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {stages.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => {
                      if (s.key !== deal.stage) void moveDealStage(deal.id, s.key);
                    }}
                    className={cn(
                      'h-8 rounded-full border px-3 text-[11px] font-semibold transition-colors',
                      s.key === deal.stage
                        ? 'border-purple-600 bg-purple-600 text-white'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {deal.notes && (
              <div className="rounded-2xl border border-gray-200 bg-white p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  Notes
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{deal.notes}</p>
              </div>
            )}

            {/* AI Deal Advisor — on-demand to keep Claude calls scoped to
                deals the user is actively reviewing. */}
            <div className="rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50/50 to-white p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-purple-700">
                    <Sparkles className="h-3 w-3" /> AI Deal Advisor
                  </div>
                  <div className="text-[11px] text-gray-500">
                    Score, counter-offer, red flags, and negotiation points
                  </div>
                </div>
                <Button
                  className="h-9 shrink-0"
                  onClick={runAdvisor}
                  disabled={adviceLoading}
                >
                  {adviceLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Analysing…
                    </>
                  ) : advice ? (
                    <>
                      <Sparkles className="h-4 w-4" /> Re-analyse
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" /> Analyse
                    </>
                  )}
                </Button>
              </div>

              {adviceError && (
                <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                  {adviceError}
                </div>
              )}

              {advice && (
                <div className="mt-3 flex flex-col gap-3">
                  {advice.partial && (
                    <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <div>
                        AI timed out — showing a rule-based recommendation. Tap re-analyse to retry the full LLM read.
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <ScorePill score={advice.score} verdict={advice.verdict} tone={verdictTone} />
                    {advice.counterOffer != null && (
                      <div className="flex-1 rounded-xl border border-purple-200 bg-white p-2.5">
                        <div className="text-[10px] uppercase tracking-wide text-purple-700">
                          Suggested counter
                        </div>
                        <div className="text-base font-bold text-gray-900">
                          {sym}{advice.counterOffer.toLocaleString()}
                        </div>
                      </div>
                    )}
                  </div>
                  {advice.counterReasoning && (
                    <div className="text-xs leading-relaxed text-gray-800">
                      <span className="font-semibold">Why:</span> {advice.counterReasoning}
                    </div>
                  )}
                  {advice.marketBenchmark && (
                    <div className="flex items-start gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-gray-200">
                      <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-purple-600" />
                      <div className="text-[11px] text-gray-700">{advice.marketBenchmark}</div>
                    </div>
                  )}
                  {advice.redFlags.length > 0 && (
                    <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-3">
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-rose-700">
                        <AlertTriangle className="h-3 w-3" /> Red flags
                      </div>
                      <ul className="mt-1 list-disc pl-4 text-xs text-rose-800">
                        {advice.redFlags.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {advice.negotiationPoints.length > 0 && (
                    <div className="rounded-xl border border-purple-100 bg-purple-50/60 p-3">
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-purple-700">
                        <CheckCircle2 className="h-3 w-3" /> Negotiation points
                      </div>
                      <ul className="mt-1 list-disc pl-4 text-xs text-purple-900">
                        {advice.negotiationPoints.map((p, i) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={async () => {
                if (!confirm('Delete this deal?')) return;
                await deleteDeal(deal.id);
                onClose();
              }}
              className="inline-flex h-10 items-center justify-center gap-1.5 self-start rounded-full border border-rose-200 bg-white px-3 text-xs font-medium text-rose-700 hover:bg-rose-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete deal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PriceTile({
  label,
  value,
  sym,
  accent,
}: {
  label: string;
  value: number | null;
  sym: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className={cn('mt-0.5 text-base font-bold text-gray-900', accent)}>{fmtAmount(value, sym)}</div>
    </div>
  );
}

function ScorePill({
  score,
  verdict,
  tone,
}: {
  score: number;
  verdict: DealAdvice['verdict'];
  tone: string;
}) {
  const label =
    verdict === 'STRONG'
      ? 'Strong'
      : verdict === 'FAIR'
      ? 'Fair'
      : verdict === 'WEAK'
      ? 'Weak'
      : 'Walk away';
  return (
    <div className={cn('flex flex-col items-center rounded-xl border px-3 py-2 text-center', tone)}>
      <span className="text-[9px] font-semibold uppercase tracking-wide">Score</span>
      <span className="text-xl font-bold leading-tight">{score}</span>
      <span className="text-[10px] font-semibold uppercase">{label}</span>
    </div>
  );
}
