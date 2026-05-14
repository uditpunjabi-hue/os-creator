'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Copy,
  Eye,
  Film,
  Hash,
  Loader2,
  Megaphone,
  Mic,
  Play,
  Sparkles,
  Star,
} from 'lucide-react';
import { Button } from '@gitroom/frontend/components/shadcn/ui/button';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { cn } from '@gitroom/frontend/lib/utils';

type Status = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'SCHEDULED' | 'PUBLISHED' | 'REJECTED';

interface ScriptDraft {
  title: string;
  hook: string;
  body: string;
  cta: string;
  caption: string;
  hashtags: string[];
  estimatedDuration: string;
  filmingNotes: string;
}

interface QualityReview {
  qualityScore: number;
  predictedViews: string;
  predictedEngagement: string;
  strengths: string[];
  improvements: string[];
  verdict: 'PUBLISH' | 'REVISE' | 'RETHINK';
}

interface ProfileAnalysis {
  audienceInsights?: string;
  strengths?: string[];
  weaknesses?: string[];
  recommendations?: string[];
}

interface CompetitorAnalysis {
  keyTakeaway?: string;
  viralHooks?: string[];
  contentGaps?: string[];
  opportunities?: string[];
}

interface TrendAnalysis {
  trendingFormats?: string[];
  hotTopics?: string[];
  recommendedHashtags?: string[];
  timingAdvice?: string;
}

interface StrategyBrief {
  contentAngle?: string;
  hookStyle?: string;
  keyMessage?: string;
  differentiator?: string;
  estimatedPerformance?: string;
}

interface RevisionAttempt {
  attempt: number;
  script: ScriptDraft;
  quality: QualityReview;
}

interface AgentOutputs {
  profile?: ProfileAnalysis;
  competitor?: CompetitorAnalysis;
  trends?: TrendAnalysis;
  strategy?: StrategyBrief;
  script?: ScriptDraft;
  quality?: QualityReview;
  revisedScript?: ScriptDraft;
  revisedQuality?: QualityReview;
  revisions?: RevisionAttempt[];
}

interface ScriptDetail {
  id: string;
  title: string;
  format: string;
  prompt: string | null;
  body: string;
  feedback: string | null;
  status: Status;
  qualityScore: number | null;
  agentOutputs: AgentOutputs | null;
  createdAt: string;
  updatedAt: string;
  contentPieceId: string | null;
}

const statusMeta: Record<Status, { label: string; chipClass: string }> = {
  DRAFT: { label: 'Draft', chipClass: 'bg-gray-100 text-gray-700' },
  IN_REVIEW: { label: 'In review', chipClass: 'bg-amber-100 text-amber-800' },
  APPROVED: { label: 'Approved', chipClass: 'bg-emerald-100 text-emerald-800' },
  SCHEDULED: { label: 'Scheduled', chipClass: 'bg-purple-100 text-purple-800' },
  PUBLISHED: { label: 'Published', chipClass: 'bg-blue-100 text-blue-800' },
  REJECTED: { label: 'Rejected', chipClass: 'bg-rose-100 text-rose-800' },
};

// Pulls the most polished script payload — the revision wins if it scored
// higher than the initial; otherwise the original.
const finalScriptOf = (out: AgentOutputs | null | undefined): ScriptDraft | null => {
  if (!out) return null;
  return out.revisedScript ?? out.script ?? null;
};

const finalQualityOf = (out: AgentOutputs | null | undefined): QualityReview | null => {
  if (!out) return null;
  return out.revisedQuality ?? out.quality ?? null;
};

const scoreToneBox = (score: number) =>
  score >= 80
    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
    : score >= 60
    ? 'border-amber-300 bg-amber-50 text-amber-800'
    : 'border-rose-300 bg-rose-50 text-rose-700';

export default function ScriptDetailPage() {
  const fetch = useFetch();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [detail, setDetail] = useState<ScriptDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/creator/scripts/${id}`);
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).message ?? `Load failed (${res.status})`);
        return;
      }
      setDetail((await res.json()) as ScriptDetail);
    } finally {
      setLoading(false);
    }
  }, [fetch, id]);

  useEffect(() => {
    load();
  }, [load]);

  const draft = useMemo(() => finalScriptOf(detail?.agentOutputs), [detail]);
  const quality = useMemo(() => finalQualityOf(detail?.agentOutputs), [detail]);

  // "Move to Create" — if a ContentPiece already exists for this script, jump
  // straight there. Otherwise call /approve which marks the script APPROVED
  // AND spawns a piece, then routes to it. Both branches end at the same
  // filming workflow URL.
  const onMoveToCreate = async () => {
    if (!detail || acting) return;
    setActing(true);
    try {
      if (detail.contentPieceId) {
        router.push(`/creator/content/new?piece=${detail.contentPieceId}`);
        return;
      }
      const res = await fetch(`/creator/scripts/${detail.id}/approve`, { method: 'POST' });
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).message ?? `Move failed (${res.status})`);
        setActing(false);
        return;
      }
      const { piece } = (await res.json()) as { piece: { id: string } };
      router.push(`/creator/content/new?piece=${piece.id}`);
    } catch (e) {
      setError((e as Error).message);
      setActing(false);
    }
  };

  const onDuplicate = async () => {
    if (!detail || acting) return;
    setActing(true);
    try {
      const res = await fetch(`/creator/scripts/${detail.id}/duplicate`, { method: 'POST' });
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).message ?? `Duplicate failed (${res.status})`);
        setActing(false);
        return;
      }
      const { id: newId } = (await res.json()) as { id: string };
      router.push(`/creator/content/scripts/${newId}`);
    } catch (e) {
      setError((e as Error).message);
      setActing(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3 lg:px-8 lg:py-5">
        <div className="flex items-center gap-3">
          <Link
            href="/creator/content/scripts"
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
            aria-label="Back to scripts"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-semibold text-gray-900">
              {detail?.title ?? (loading ? 'Loading…' : 'Script')}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
              {detail && (
                <>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 font-medium',
                      statusMeta[detail.status].chipClass
                    )}
                  >
                    {statusMeta[detail.status].label}
                  </span>
                  <span>·</span>
                  <span>{detail.format}</span>
                  {quality && (
                    <>
                      <span>·</span>
                      <span>{quality.predictedViews}</span>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
          {quality && (
            <div
              className={cn(
                'flex shrink-0 flex-col items-center rounded-xl border px-3 py-1.5 text-center',
                scoreToneBox(quality.qualityScore)
              )}
            >
              <span className="text-[9px] font-semibold uppercase tracking-wide">Quality</span>
              <span className="text-lg font-bold leading-tight">{quality.qualityScore}</span>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 lg:px-8 lg:py-6">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading script…
          </div>
        )}
        {error && !loading && (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            {error}
          </div>
        )}
        {!loading && detail && (
          <div className="mx-auto flex max-w-3xl flex-col gap-4">
            {/* Predicted performance + Copy all */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-200 bg-white p-4">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  Predicted performance
                </div>
                <div className="mt-1 text-sm text-gray-800">
                  {quality?.predictedViews ?? '—'}
                  {quality?.predictedEngagement && (
                    <span className="text-gray-500"> · {quality.predictedEngagement}</span>
                  )}
                </div>
                {quality?.verdict && (
                  <div className="mt-1 text-[11px] uppercase tracking-wide text-gray-500">
                    Verdict · <span className="font-semibold text-gray-800">{quality.verdict}</span>
                  </div>
                )}
              </div>
              {draft && <CopyAllButton draft={draft} />}
            </div>

            {/* Hook | Body | CTA | Caption | Hashtags | Filming notes */}
            {draft ? (
              <>
                <DetailSection icon={Megaphone} label="Hook" copyText={draft.hook}>
                  <p className="text-sm font-medium text-gray-900">{draft.hook}</p>
                </DetailSection>
                <DetailSection icon={Mic} label="Body" defaultOpen copyText={draft.body}>
                  <p className="whitespace-pre-wrap text-sm text-gray-800">{draft.body}</p>
                </DetailSection>
                <DetailSection icon={Play} label="CTA" copyText={draft.cta}>
                  <p className="text-sm font-medium text-gray-900">{draft.cta}</p>
                </DetailSection>
                <DetailSection icon={Mic} label="Caption" copyText={draft.caption}>
                  <p className="whitespace-pre-wrap text-sm text-gray-800">{draft.caption}</p>
                </DetailSection>
                <DetailSection
                  icon={Hash}
                  label={`Hashtags (${draft.hashtags.length})`}
                  copyText={draft.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')}
                >
                  <div className="flex flex-wrap gap-1.5">
                    {draft.hashtags.map((h) => (
                      <span
                        key={h}
                        className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700"
                      >
                        {h.startsWith('#') ? h : `#${h}`}
                      </span>
                    ))}
                  </div>
                </DetailSection>
                <DetailSection
                  icon={Film}
                  label={`Filming notes · ${draft.estimatedDuration}`}
                  copyText={draft.filmingNotes}
                >
                  <p className="whitespace-pre-wrap text-sm text-gray-800">{draft.filmingNotes}</p>
                </DetailSection>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-sm text-gray-500">
                The agent pipeline output is not available for this script — only the raw text below.
                <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-3 font-mono text-xs text-gray-800">
                  {detail.body}
                </pre>
              </div>
            )}

            {/* Reviewer notes */}
            {quality && (quality.strengths.length > 0 || quality.improvements.length > 0) && (
              <div className="rounded-2xl border border-purple-100 bg-purple-50/40 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-purple-700">
                  Reviewer notes
                </div>
                {quality.strengths.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs font-semibold text-gray-800">Strengths</div>
                    <ul className="mt-1 list-disc pl-4 text-xs text-gray-700">
                      {quality.strengths.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {quality.improvements.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs font-semibold text-gray-800">Improvements</div>
                    <ul className="mt-1 list-disc pl-4 text-xs text-gray-700">
                      {quality.improvements.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Agent analysis summary */}
            {detail.agentOutputs && (
              <AgentAnalysisSummary outputs={detail.agentOutputs} />
            )}

            {/* Version history — first attempt + revisions */}
            {detail.agentOutputs && (
              <VersionHistory outputs={detail.agentOutputs} />
            )}

            {/* Footer actions */}
            <div className="sticky bottom-0 flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm sm:flex-row">
              <Button
                className="h-11 flex-1"
                disabled={acting}
                onClick={onMoveToCreate}
              >
                {acting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Working…
                  </>
                ) : detail.contentPieceId ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" /> Open in Create
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" /> Move to Create
                  </>
                )}
              </Button>
              <Button variant="outline" className="h-11" disabled={acting} onClick={onDuplicate}>
                <Copy className="h-4 w-4" /> Duplicate & Edit
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailSection({
  icon: Icon,
  label,
  children,
  defaultOpen = false,
  copyText,
}: {
  icon: typeof Eye;
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  copyText?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center gap-2 text-left transition-colors hover:opacity-80"
        >
          <Icon className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-sm font-semibold text-gray-900">{label}</span>
          <ChevronDown
            className={cn(
              'ml-auto h-4 w-4 text-gray-400 transition-transform',
              open && 'rotate-180'
            )}
          />
        </button>
        {copyText && <CopyButton text={copyText} />}
      </div>
      {open && <div className="border-t border-gray-100 px-4 py-3">{children}</div>}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Silently ignore — older browsers without clipboard permission.
        }
      }}
      className={cn(
        'inline-flex h-7 items-center gap-1 rounded-full border px-2 text-[11px] font-medium transition-colors',
        copied
          ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
      )}
      aria-label={copied ? 'Copied' : 'Copy'}
    >
      {copied ? (
        <>
          <CheckCircle2 className="h-3 w-3" /> Copied
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" /> Copy
        </>
      )}
    </button>
  );
}

function CopyAllButton({ draft }: { draft: ScriptDraft }) {
  const formatted = [
    `TITLE: ${draft.title}`,
    '',
    `HOOK:\n${draft.hook}`,
    '',
    `BODY:\n${draft.body}`,
    '',
    `CTA:\n${draft.cta}`,
    '',
    `CAPTION:\n${draft.caption}`,
    '',
    `HASHTAGS:\n${draft.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')}`,
    '',
    `FILMING NOTES (${draft.estimatedDuration}):\n${draft.filmingNotes}`,
  ].join('\n');
  return <CopyButton text={formatted} />;
}

function AgentAnalysisSummary({ outputs }: { outputs: AgentOutputs }) {
  const blocks: Array<{
    label: string;
    accent: string;
    lines: Array<{ heading: string; value?: string | null; items?: string[] }>;
  }> = [];
  if (outputs.profile) {
    blocks.push({
      label: 'Profile analyst',
      accent: '#7C3AED',
      lines: [
        { heading: 'Audience insights', value: outputs.profile.audienceInsights },
        { heading: 'Strengths', items: outputs.profile.strengths },
        { heading: 'Weaknesses', items: outputs.profile.weaknesses },
      ],
    });
  }
  if (outputs.competitor) {
    blocks.push({
      label: 'Competitor scout',
      accent: '#10B981',
      lines: [
        { heading: 'Key takeaway', value: outputs.competitor.keyTakeaway },
        { heading: 'Viral hooks seen', items: outputs.competitor.viralHooks },
        { heading: 'Content gaps', items: outputs.competitor.contentGaps },
      ],
    });
  }
  if (outputs.trends) {
    blocks.push({
      label: 'Trend detector',
      accent: '#F59E0B',
      lines: [
        { heading: 'Hot topics', items: outputs.trends.hotTopics },
        { heading: 'Recommended formats', items: outputs.trends.trendingFormats },
        { heading: 'Timing advice', value: outputs.trends.timingAdvice },
      ],
    });
  }
  if (outputs.strategy) {
    blocks.push({
      label: 'Strategy architect',
      accent: '#EC4899',
      lines: [
        { heading: 'Content angle', value: outputs.strategy.contentAngle },
        { heading: 'Hook style', value: outputs.strategy.hookStyle },
        { heading: 'Key message', value: outputs.strategy.keyMessage },
        { heading: 'Differentiator', value: outputs.strategy.differentiator },
      ],
    });
  }
  if (blocks.length === 0) return null;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-gray-700">
        <Sparkles className="h-3 w-3" /> Agent analysis summary
      </div>
      <div className="flex flex-col gap-4">
        {blocks.map((b) => (
          <div key={b.label} className="border-l-2 pl-3" style={{ borderColor: b.accent }}>
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: b.accent }}>
              {b.label}
            </div>
            <div className="mt-1.5 flex flex-col gap-1.5">
              {b.lines.map((l, i) => {
                if (l.items && l.items.length > 0) {
                  return (
                    <div key={i}>
                      <div className="text-[11px] font-semibold text-gray-700">{l.heading}</div>
                      <ul className="ml-3 list-disc text-xs text-gray-600">
                        {l.items.map((it, j) => (
                          <li key={j}>{it}</li>
                        ))}
                      </ul>
                    </div>
                  );
                }
                if (l.value) {
                  return (
                    <div key={i} className="text-xs text-gray-700">
                      <span className="font-semibold">{l.heading}:</span> {l.value}
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VersionHistory({ outputs }: { outputs: AgentOutputs }) {
  const attempts: Array<{ attempt: number; score: number | null; verdict: string | null }> = [];
  if (outputs.script && outputs.quality) {
    attempts.push({
      attempt: 1,
      score: outputs.quality.qualityScore ?? null,
      verdict: outputs.quality.verdict ?? null,
    });
  }
  for (const r of outputs.revisions ?? []) {
    attempts.push({ attempt: r.attempt, score: r.quality.qualityScore ?? null, verdict: r.quality.verdict ?? null });
  }
  if (attempts.length < 2) return null;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-gray-700">
        <Star className="h-3 w-3" /> Version history
      </div>
      <ol className="flex flex-col gap-1.5">
        {attempts.map((a) => (
          <li
            key={a.attempt}
            className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2"
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-bold text-gray-700 ring-1 ring-gray-200">
              {a.attempt}
            </div>
            <div className="min-w-0 flex-1 text-sm text-gray-800">Attempt {a.attempt}</div>
            <span className="text-xs text-gray-500">{a.verdict ?? '—'}</span>
            {a.score !== null && (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-semibold',
                  a.score >= 80
                    ? 'bg-emerald-100 text-emerald-700'
                    : a.score >= 60
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-rose-100 text-rose-700'
                )}
              >
                Score {a.score}
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
