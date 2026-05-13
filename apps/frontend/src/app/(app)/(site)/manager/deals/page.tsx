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
import { Plus, Loader2, MoreHorizontal, GripVertical, DollarSign } from 'lucide-react';
import { Button } from '@gitroom/frontend/components/shadcn/ui/button';
import { Badge } from '@gitroom/frontend/components/shadcn/ui/badge';
import { Modal } from '@gitroom/frontend/components/shadcn/ui/modal';
import { Input } from '@gitroom/frontend/components/shadcn/ui/input';
import {
  useDeals,
  useInfluencers,
  useManagerMutations,
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

const fmt = (n: number | null) =>
  n == null ? '—' : `$${Math.round(n).toLocaleString()}`;

export default function DealsPage() {
  const { data, isLoading } = useDeals();
  const { data: influencers } = useInfluencers();
  const { createDeal, moveDealStage } = useManagerMutations();

  const [optimistic, setOptimistic] = useState<DealRow[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

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
            {rows.length} active · {fmt(totalValue)} pipeline value
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
          ) : (
            <div className="flex h-full min-w-max gap-3 pb-4 lg:gap-4">
              {stages.map((stage) => (
                <KanbanColumn
                  key={stage.key}
                  stage={stage}
                  deals={byStage[stage.key]}
                  activeId={activeId}
                />
              ))}
            </div>
          )}
        </div>

        <DragOverlay>{activeDeal ? <DealCard deal={activeDeal} dragging /> : null}</DragOverlay>
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
    </div>
  );
}

function KanbanColumn({
  stage,
  deals,
  activeId,
}: {
  stage: { key: DealStageKey; label: string; accent: string };
  deals: DealRow[];
  activeId: string | null;
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
          <SortableDealCard key={d.id} deal={d} hidden={activeId === d.id} />
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

function SortableDealCard({ deal, hidden }: { deal: DealRow; hidden?: boolean }) {
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
      <DealCard deal={deal} listeners={listeners} />
    </div>
  );
}

function DealCard({
  deal,
  dragging,
  listeners,
}: {
  deal: DealRow;
  dragging?: boolean;
  listeners?: any;
}) {
  return (
    <article
      className={cn(
        'rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-colors',
        dragging ? 'rotate-2 shadow-xl ring-2 ring-purple-200' : 'hover:border-purple-300'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-gray-900">{deal.brand}</div>
          <div className="truncate text-xs text-gray-500">
            {deal.influencer?.name ?? '—'}
          </div>
        </div>
        <div className="flex items-center gap-1 text-base font-semibold text-purple-700">
          <DollarSign className="h-3.5 w-3.5" />
          {Math.round(deal.offer).toLocaleString()}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px] text-gray-400">
        <span>Floor {fmt(deal.floor)}</span>
        <span>Ceiling {fmt(deal.ceiling)}</span>
      </div>
      {listeners && (
        <div
          className="mt-3 -mx-4 -mb-4 flex cursor-grab items-center justify-center rounded-b-2xl border-t border-gray-100 py-1.5 text-gray-300 active:cursor-grabbing"
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
