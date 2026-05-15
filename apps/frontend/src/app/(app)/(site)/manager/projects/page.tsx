'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Briefcase,
  Calendar as CalendarIcon,
  FileText,
  Loader2,
  Plus,
  Wallet,
  X,
} from 'lucide-react';
import { Button } from '@gitroom/frontend/components/shadcn/ui/button';
import {
  useContracts,
  useDeals,
  useManagerMutations,
  usePayments,
  useRateCard,
  type DealRow,
  type DealStageKey,
  type ContractRow,
  type PaymentRow,
} from '@gitroom/frontend/hooks/manager';
import { cn } from '@gitroom/frontend/lib/utils';

// ---------------------------------------------------------------------------
// Projects = the single end-to-end view of a brand engagement. Each Deal is
// the unit of work; we hang the linked Contract + linked BrandCommercial
// (payment) off it so the creator sees one card from lead through paid.
//
// The Kanban stages map 1:1 to the underlying DealStage enum the database
// already uses — moving a card just calls the existing /deals/[id]/stage
// endpoint. No schema changes; this is purely a UI rollup over data that
// was previously split across three pages.
// ---------------------------------------------------------------------------

interface ProjectCard {
  deal: DealRow;
  contract: ContractRow | null;
  payment: PaymentRow | null;
}

const STAGES: { key: DealStageKey; label: string; accent: string }[] = [
  { key: 'LEAD', label: 'Lead', accent: 'bg-gray-100 text-gray-700' },
  { key: 'PROPOSAL_SENT', label: 'Proposal', accent: 'bg-blue-100 text-blue-700' },
  { key: 'NEGOTIATING', label: 'Negotiating', accent: 'bg-amber-100 text-amber-700' },
  { key: 'CONTRACT', label: 'Contract', accent: 'bg-indigo-100 text-indigo-700' },
  { key: 'PAYMENT', label: 'Payment', accent: 'bg-purple-100 text-purple-700' },
  { key: 'COMPLETED', label: 'Complete', accent: 'bg-emerald-100 text-emerald-700' },
];

const CURRENCY_SYMBOL: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

export default function ProjectsPage() {
  const { data: deals, isLoading: dealsLoading } = useDeals();
  const { data: contracts } = useContracts();
  const { data: payments } = usePayments();
  const { data: rateCard } = useRateCard();
  const { moveDealStage } = useManagerMutations();
  const [activeId, setActiveId] = useState<string | null>(null);

  const currencySymbol = CURRENCY_SYMBOL[rateCard?.currency ?? 'INR'] ?? '₹';

  // Build one card per deal, attaching the most recent contract + payment
  // that point to it. Deals without a contract / payment yet still show; the
  // card surface communicates "what's missing for this project to advance."
  const projects = useMemo<ProjectCard[]>(() => {
    if (!deals) return [];
    const contractByDeal = new Map<string, ContractRow>();
    for (const c of contracts ?? []) {
      if (c.dealId) contractByDeal.set(c.dealId, c);
    }
    const paymentByDeal = new Map<string, PaymentRow>();
    for (const p of payments ?? []) {
      if (p.dealId) paymentByDeal.set(p.dealId, p);
    }
    return deals.map((deal) => ({
      deal,
      contract: contractByDeal.get(deal.id) ?? null,
      payment: paymentByDeal.get(deal.id) ?? null,
    }));
  }, [deals, contracts, payments]);

  const byStage = useMemo(() => {
    const m: Record<DealStageKey, ProjectCard[]> = {
      LEAD: [],
      PROPOSAL_SENT: [],
      NEGOTIATING: [],
      CONTRACT: [],
      PAYMENT: [],
      COMPLETED: [],
    };
    for (const p of projects) m[p.deal.stage].push(p);
    return m;
  }, [projects]);

  const totalValue = projects.reduce((s, p) => s + (Number(p.deal.offer) || 0), 0);
  const activeProject = activeId ? projects.find((p) => p.deal.id === activeId) ?? null : null;

  const move = async (id: string, stage: DealStageKey) => {
    try {
      await moveDealStage(id, stage);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 lg:px-8 lg:py-5">
        <div className="min-w-0">
          <div className="text-lg font-semibold text-gray-900">Projects</div>
          <div className="text-xs text-gray-500">
            {projects.length} {projects.length === 1 ? 'project' : 'projects'} ·{' '}
            {currencySymbol}
            {Math.round(totalValue).toLocaleString()} pipeline value
          </div>
        </div>
        <Link
          href="/manager/deals"
          className="inline-flex h-11 items-center gap-1.5 rounded-full bg-purple-600 px-4 text-sm font-semibold text-white hover:bg-purple-700"
        >
          <Plus className="h-4 w-4" /> New project
        </Link>
      </header>

      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        {dealsLoading && !deals ? (
          <div className="flex items-center justify-center py-12 text-sm text-gray-400">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading projects…
          </div>
        ) : projects.length === 0 ? (
          <EmptyProjects />
        ) : (
          <div className="flex h-full min-w-max gap-3 px-4 pt-4 pb-4 lg:gap-4 lg:px-8 lg:pt-6">
            {STAGES.map((stage) => (
              <Column
                key={stage.key}
                stage={stage}
                items={byStage[stage.key]}
                currencySymbol={currencySymbol}
                onMove={move}
                onOpen={setActiveId}
              />
            ))}
          </div>
        )}
      </div>

      {activeProject && (
        <DetailSheet
          project={activeProject}
          currencySymbol={currencySymbol}
          onClose={() => setActiveId(null)}
        />
      )}
    </div>
  );
}

function EmptyProjects() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-purple-100 text-purple-700">
        <Briefcase className="h-6 w-6" />
      </div>
      <div>
        <div className="text-base font-semibold text-gray-900">No projects yet</div>
        <p className="mt-1 max-w-sm text-sm text-gray-600">
          Projects roll up your brand deals, contracts, and payments into one
          board. Create a deal to start your first project.
        </p>
      </div>
      <Link
        href="/manager/deals"
        className="inline-flex h-11 items-center gap-1.5 rounded-full bg-purple-600 px-4 text-sm font-semibold text-white hover:bg-purple-700"
      >
        <Plus className="h-4 w-4" /> Create your first deal
      </Link>
    </div>
  );
}

function Column({
  stage,
  items,
  currencySymbol,
  onMove,
  onOpen,
}: {
  stage: { key: DealStageKey; label: string; accent: string };
  items: ProjectCard[];
  currencySymbol: string;
  onMove: (id: string, stage: DealStageKey) => Promise<void>;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="flex w-[280px] shrink-0 flex-col gap-3 lg:w-[300px]">
      <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 shadow-sm">
        <div className="flex items-center gap-2">
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', stage.accent)}>
            {stage.label}
          </span>
          <span className="text-xs text-gray-500">{items.length}</span>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {items.map((p) => (
          <ProjectCardView
            key={p.deal.id}
            project={p}
            currencySymbol={currencySymbol}
            onMove={onMove}
            onOpen={onOpen}
          />
        ))}
        {items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-xs text-gray-400">
            No projects in this stage
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectCardView({
  project,
  currencySymbol,
  onMove,
  onOpen,
}: {
  project: ProjectCard;
  currencySymbol: string;
  onMove: (id: string, stage: DealStageKey) => Promise<void>;
  onOpen: (id: string) => void;
}) {
  const { deal, contract, payment } = project;
  const deadline =
    payment?.dueAt ?? contract?.expiresAt ?? null;
  return (
    <article
      className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-colors hover:border-purple-300"
    >
      <button
        type="button"
        onClick={() => onOpen(deal.id)}
        className="flex w-full flex-col gap-3 px-4 pb-3 pt-4 text-left transition-colors hover:bg-gray-50/60"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-gray-900">{deal.brand}</div>
            <div className="truncate text-xs text-gray-500">
              {deal.influencer?.name ?? '—'}
            </div>
          </div>
          <div className="text-base font-semibold text-purple-700">
            {currencySymbol}
            {Math.round(deal.offer).toLocaleString()}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Tiny status chips so the card communicates which artifacts exist
              without forcing the user to open three different pages. */}
          <Chip
            icon={FileText}
            label={
              contract
                ? `Contract · ${contract.status.toLowerCase()}`
                : 'No contract'
            }
            tone={contract?.status === 'SIGNED' ? 'good' : contract ? 'neutral' : 'muted'}
          />
          <Chip
            icon={Wallet}
            label={
              payment
                ? `Payment · ${(payment.paymentStatus ?? '').toLowerCase()}`
                : 'No invoice'
            }
            tone={
              payment?.paymentStatus === 'PAID'
                ? 'good'
                : payment?.paymentStatus === 'OVERDUE'
                ? 'bad'
                : payment
                ? 'neutral'
                : 'muted'
            }
          />
          {deadline && (
            <Chip
              icon={CalendarIcon}
              label={new Date(deadline).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
              tone="neutral"
            />
          )}
        </div>
      </button>
      {/* Mobile-friendly stage chip row — tap to advance without drag.
          Drag is supported on the Deals page; on this page we keep things
          simple with explicit stage chips. */}
      <div className="flex gap-1 overflow-x-auto border-t border-gray-100 bg-gray-50/60 px-2 py-1.5">
        {STAGES.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => s.key !== deal.stage && void onMove(deal.id, s.key)}
            className={cn(
              'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors',
              s.key === deal.stage
                ? 'bg-purple-600 text-white'
                : 'bg-white text-gray-600 hover:bg-purple-50 hover:text-purple-700'
            )}
            title={`Move to ${s.label}`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </article>
  );
}

function Chip({
  icon: Icon,
  label,
  tone,
}: {
  icon: typeof Briefcase;
  label: string;
  tone: 'good' | 'bad' | 'neutral' | 'muted';
}) {
  const tones = {
    good: 'bg-emerald-50 text-emerald-700',
    bad: 'bg-rose-50 text-rose-700',
    neutral: 'bg-blue-50 text-blue-700',
    muted: 'bg-gray-100 text-gray-500',
  } as const;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
        tones[tone]
      )}
    >
      <Icon className="h-2.5 w-2.5" /> {label}
    </span>
  );
}

function DetailSheet({
  project,
  currencySymbol,
  onClose,
}: {
  project: ProjectCard;
  currencySymbol: string;
  onClose: () => void;
}) {
  const { deal, contract, payment } = project;
  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 backdrop-blur-sm lg:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl lg:max-w-xl lg:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-gray-900">{deal.brand}</div>
            <div className="truncate text-xs text-gray-500">
              {deal.influencer?.name ?? '—'} · {currencySymbol}
              {Math.round(deal.offer).toLocaleString()}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-3">
            <RowLink
              href="/manager/deals"
              icon={Briefcase}
              title="Deal"
              detail={`${currencySymbol}${Math.round(deal.offer).toLocaleString()} · ${deal.stage.replace('_', ' ').toLowerCase()}`}
            />
            <RowLink
              href="/manager/contracts"
              icon={FileText}
              title="Contract"
              detail={
                contract
                  ? `${contract.templateName} · ${contract.status.toLowerCase()}`
                  : 'Not generated yet'
              }
              muted={!contract}
            />
            <RowLink
              href="/manager/payments"
              icon={Wallet}
              title="Payment"
              detail={
                payment
                  ? `${currencySymbol}${Math.round(payment.amount).toLocaleString()} · ${(payment.paymentStatus ?? '').toLowerCase()}`
                  : 'No invoice yet'
              }
              muted={!payment}
            />
          </div>

          {deal.notes && (
            <div className="mt-4 rounded-xl border border-gray-200 bg-white p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                Notes
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{deal.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RowLink({
  href,
  icon: Icon,
  title,
  detail,
  muted,
}: {
  href: string;
  icon: typeof Briefcase;
  title: string;
  detail: string;
  muted?: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 transition-colors hover:border-purple-300"
    >
      <div
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-xl',
          muted ? 'bg-gray-100 text-gray-400' : 'bg-purple-100 text-purple-700'
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-gray-900">{title}</div>
        <div className={cn('truncate text-xs', muted ? 'text-gray-400' : 'text-gray-600')}>
          {detail}
        </div>
      </div>
    </Link>
  );
}
