'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Sparkles,
  Plus,
  Search,
  ChevronRight,
  ChevronDown,
  Loader2,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Hash,
  Megaphone,
  Mic,
  Film,
  Eye,
  Star,
  ArrowLeft,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@gitroom/frontend/components/shadcn/ui/button';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { SkeletonList } from '@gitroom/frontend/components/ui/skeleton';
import { cn } from '@gitroom/frontend/lib/utils';

type Status = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'SCHEDULED' | 'PUBLISHED' | 'REJECTED';
type Filter = 'ALL' | Status;

interface ScriptItem {
  id: string;
  title: string;
  format: string;
  status: Status;
  updatedAt: string;
  body: string;
  feedback?: string | null;
}

const statusMeta: Record<Status, { label: string; chipClass: string; dotClass: string }> = {
  DRAFT: { label: 'Draft', chipClass: 'bg-gray-100 text-gray-700', dotClass: 'bg-gray-400' },
  IN_REVIEW: { label: 'In review', chipClass: 'bg-amber-100 text-amber-800', dotClass: 'bg-amber-500' },
  APPROVED: { label: 'Approved', chipClass: 'bg-emerald-100 text-emerald-800', dotClass: 'bg-emerald-500' },
  SCHEDULED: { label: 'Scheduled', chipClass: 'bg-purple-100 text-purple-800', dotClass: 'bg-purple-500' },
  PUBLISHED: { label: 'Published', chipClass: 'bg-blue-100 text-blue-800', dotClass: 'bg-blue-500' },
  REJECTED: { label: 'Rejected', chipClass: 'bg-rose-100 text-rose-800', dotClass: 'bg-rose-500' },
};

const filters: { key: Filter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'DRAFT', label: 'Drafts' },
  { key: 'IN_REVIEW', label: 'Review' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'SCHEDULED', label: 'Scheduled' },
  { key: 'PUBLISHED', label: 'Published' },
];

const fmtAgo = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
};

const firstLine = (body: string) =>
  (body.match(/Hook:\s*(.+)/i)?.[1] ?? body.split('\n').find((l) => l.trim()) ?? '').slice(0, 160);

export default function ScriptsPage() {
  const fetch = useFetch();
  const params = useSearchParams();
  const [scripts, setScripts] = useState<ScriptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [q, setQ] = useState('');
  const [genOpen, setGenOpen] = useState(false);
  const [prefillPrompt, setPrefillPrompt] = useState<string>('');

  // Deep-link: /creator/content/scripts?prompt=<text> opens the Generate panel
  // with the prompt pre-filled. Used by the "Act on this" CTAs on Profile.
  useEffect(() => {
    const p = params.get('prompt');
    if (p) {
      setPrefillPrompt(p);
      setGenOpen(true);
    }
  }, [params]);

  const reload = useCallback(async () => {
    try {
      const res = await fetch('/creator/scripts');
      if (!res.ok) {
        setScripts([]);
        return;
      }
      const rows = (await res.json()) as Array<{
        id: string;
        title: string;
        format: string;
        body: string;
        feedback: string | null;
        status: Status;
        updatedAt: string;
      }>;
      setScripts(
        rows.map((r) => ({
          id: r.id,
          title: r.title,
          format: r.format,
          status: r.status,
          updatedAt: r.updatedAt,
          body: r.body,
          feedback: r.feedback,
        }))
      );
    } finally {
      setLoading(false);
    }
  }, [fetch]);

  useEffect(() => {
    reload();
  }, [reload]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return scripts.filter((s) => {
      if (filter !== 'ALL' && s.status !== filter) return false;
      if (term && !s.title.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [filter, q]);

  return (
    <div className="flex h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="flex items-start justify-between gap-2 px-4 py-3 lg:px-8 lg:py-5">
          <div className="min-w-0">
            <div className="text-lg font-semibold text-gray-900">Scripts</div>
            <div className="truncate text-xs text-gray-500">
              {loading ? 'Loading…' : `${filtered.length} of ${scripts.length} · AI drafts, your review, your voice`}
            </div>
          </div>
          <Button className="h-11 shrink-0" onClick={() => setGenOpen((v) => !v)}>
            <Sparkles className="h-4 w-4" /> Generate
          </Button>
        </div>

        <div className="flex flex-col gap-2 px-4 pb-3 lg:px-8">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              inputMode="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search scripts"
              className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
            />
          </div>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  'h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors',
                  filter === f.key
                    ? 'border-purple-600 bg-purple-600 text-white'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {genOpen && (
        <GeneratePanel
          initialPrompt={prefillPrompt}
          onClose={() => { setGenOpen(false); setPrefillPrompt(''); reload(); }}
        />
      )}

      <div className="flex-1 overflow-y-auto px-4 py-3 lg:px-8 lg:py-5">
        {loading && (
          <div className="lg:grid lg:grid-cols-2 lg:gap-3 xl:grid-cols-3">
            <SkeletonList count={6} />
          </div>
        )}
        {!loading && (
        <ul className="flex flex-col gap-2 lg:grid lg:grid-cols-2 lg:gap-3 xl:grid-cols-3">
          {filtered.map((s) => (
            <li key={s.id}>
              <Link
                href={`/creator/content/scripts/${s.id}`}
                className="group flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 transition-colors hover:border-purple-300 active:bg-purple-50/40"
              >
                <div
                  className={cn(
                    'mt-1 h-2 w-2 shrink-0 rounded-full',
                    statusMeta[s.status].dotClass
                  )}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="truncate text-sm font-semibold text-gray-900">
                      {s.title}
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-500" />
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-gray-500">{firstLine(s.body)}</p>
                  <div className="mt-3 flex items-center gap-2 text-[11px] text-gray-400">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 font-medium',
                        statusMeta[s.status].chipClass
                      )}
                    >
                      {statusMeta[s.status].label}
                    </span>
                    <span>·</span>
                    <span>{s.format}</span>
                    <span>·</span>
                    <span>{fmtAgo(s.updatedAt)}</span>
                  </div>
                  {s.feedback && (
                    <div className="mt-2 rounded-lg border border-rose-100 bg-rose-50 px-2 py-1.5 text-[11px] text-rose-700">
                      <span className="font-semibold">Feedback:</span> {s.feedback}
                    </div>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-16 text-center">
            <div className="rounded-full bg-purple-100 p-3 text-purple-600">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="text-sm font-medium text-gray-900">No scripts here</div>
            <div className="max-w-xs text-xs text-gray-500">
              Try a different filter, or describe a new piece and let the AI draft a script.
            </div>
            <Button onClick={() => setGenOpen(true)}>
              <Plus className="h-4 w-4" /> Generate script
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// 6-agent pipeline UI
// ===========================================================================

type AgentKey =
  | 'profile'
  | 'competitor'
  | 'trends'
  | 'strategy'
  | 'script'
  | 'quality'
  | 'revisedScript'
  | 'revisedQuality';

type AgentStatus = 'pending' | 'running' | 'done' | 'error';

interface AgentStep {
  key: AgentKey;
  label: string;
  hint: string;
  icon: typeof Eye;
}

const baseSteps: AgentStep[] = [
  { key: 'profile', label: 'Analyzing your profile', hint: 'Pulling top posts, engagement, audience signals', icon: Eye },
  { key: 'competitor', label: 'Scanning competitors', hint: 'Cross-referencing 7 tracked creators', icon: Search },
  { key: 'trends', label: 'Finding trends', hint: 'Trending formats, audio, hashtags', icon: Sparkles },
  { key: 'strategy', label: 'Building strategy', hint: 'Angle, hook style, differentiator', icon: Megaphone },
  { key: 'script', label: 'Writing script', hint: 'Hook, body, CTA, caption, hashtags', icon: Mic },
  { key: 'quality', label: 'Reviewing quality', hint: 'Predicted performance + score', icon: Star },
];

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

interface AgentOutputs {
  profile?: any;
  competitor?: any;
  trends?: any;
  strategy?: any;
  script?: ScriptDraft;
  quality?: QualityReview;
  revisedScript?: ScriptDraft;
  revisedQuality?: QualityReview;
}

const TONES = ['educational', 'entertaining', 'inspirational', 'promotional'] as const;
const CONTENT_TYPES = ['reel', 'post', 'story', 'carousel'] as const;

function GeneratePanel({ onClose, initialPrompt }: { onClose: () => void; initialPrompt?: string }) {
  const { backendUrl } = useVariables();
  const [prompt, setPrompt] = useState(initialPrompt ?? '');
  useEffect(() => {
    if (initialPrompt) setPrompt(initialPrompt);
  }, [initialPrompt]);
  const [contentType, setContentType] = useState<(typeof CONTENT_TYPES)[number]>('reel');
  const [tone, setTone] = useState<(typeof TONES)[number]>('educational');
  const [status, setStatus] = useState<Record<AgentKey, AgentStatus>>({
    profile: 'pending',
    competitor: 'pending',
    trends: 'pending',
    strategy: 'pending',
    script: 'pending',
    quality: 'pending',
    revisedScript: 'pending',
    revisedQuality: 'pending',
  });
  const [outputs, setOutputs] = useState<AgentOutputs>({});
  const [phase, setPhase] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [revised, setRevised] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const start = async () => {
    if (!prompt.trim()) return;
    setPhase('running');
    setError(null);
    setOutputs({});
    setRevised(false);
    setStatus({
      profile: 'pending',
      competitor: 'pending',
      trends: 'pending',
      strategy: 'pending',
      script: 'pending',
      quality: 'pending',
      revisedScript: 'pending',
      revisedQuality: 'pending',
    });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`${backendUrl}/creator/scripts/generate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), contentType, tone }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const payload = await res.json().catch(() => ({}));
        if (res.status === 503) {
          setError(
            payload.message ??
              'AI script generation is not configured yet. Set ANTHROPIC_API_KEY in .env and restart the backend.'
          );
        } else {
          setError(payload.message ?? `Generation failed (${res.status})`);
        }
        setPhase('error');
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          let event: any;
          try {
            event = JSON.parse(trimmed);
          } catch {
            continue;
          }
          handleEvent(event);
        }
      }
      setPhase((p) => (p === 'error' ? p : 'done'));
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setError((e as Error).message);
        setPhase('error');
      }
    } finally {
      abortRef.current = null;
    }
  };

  const handleEvent = (event: any) => {
    switch (event.kind) {
      case 'agent_start':
        setStatus((s) => ({ ...s, [event.agent as AgentKey]: 'running' }));
        if (event.agent === 'revisedScript' || event.agent === 'revisedQuality') {
          setRevised(true);
        }
        break;
      case 'agent_done':
        setStatus((s) => ({ ...s, [event.agent as AgentKey]: 'done' }));
        setOutputs((o) => ({ ...o, [event.agent as AgentKey]: event.output }));
        break;
      case 'agent_error':
        setStatus((s) => ({ ...s, [event.agent as AgentKey]: 'error' }));
        setError(`${event.agent} agent failed: ${event.error}`);
        break;
      case 'pipeline_error':
        setError(event.error);
        setPhase('error');
        break;
      case 'pipeline_done':
        setPhase('done');
        break;
    }
  };

  const reset = () => {
    abortRef.current?.abort();
    setPhase('idle');
    setError(null);
    setOutputs({});
    setRevised(false);
  };

  const finalScript = outputs.revisedScript ?? outputs.script;
  const finalQuality = outputs.revisedQuality ?? outputs.quality;

  return (
    <div className="border-b border-purple-100 bg-gradient-to-b from-purple-50/60 to-white px-4 py-4 lg:px-8">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-purple-700">
          <Sparkles className="h-3.5 w-3.5" /> AI script pipeline
        </div>
        <button
          onClick={() => {
            reset();
            onClose();
          }}
          className="text-xs font-medium text-gray-500 hover:text-gray-900"
        >
          Close
        </button>
      </div>

      {phase === 'idle' && (
        <IdleForm
          prompt={prompt}
          setPrompt={setPrompt}
          contentType={contentType}
          setContentType={setContentType}
          tone={tone}
          setTone={setTone}
          error={error}
          onStart={start}
        />
      )}

      {(phase === 'running' || phase === 'error') && (
        <PipelineProgress
          status={status}
          outputs={outputs}
          revised={revised}
          error={error}
          onCancel={reset}
        />
      )}

      {phase === 'done' && finalScript && finalQuality && (
        <PipelineResult
          script={finalScript}
          quality={finalQuality}
          wasRevised={revised}
          onApprove={() => {
            reset();
            onClose();
          }}
          onRevise={start}
          onReject={reset}
        />
      )}
    </div>
  );
}

function IdleForm({
  prompt,
  setPrompt,
  contentType,
  setContentType,
  tone,
  setTone,
  error,
  onStart,
}: {
  prompt: string;
  setPrompt: (v: string) => void;
  contentType: (typeof CONTENT_TYPES)[number];
  setContentType: (v: (typeof CONTENT_TYPES)[number]) => void;
  tone: (typeof TONES)[number];
  setTone: (v: (typeof TONES)[number]) => void;
  error: string | null;
  onStart: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="e.g. 30-second reel for a course launch, 3 quick points and a CTA to comment 'COURSE'."
        className="min-h-[96px] w-full resize-y rounded-xl border border-gray-200 bg-white p-3 text-sm placeholder:text-gray-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
      />
      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {error}
        </div>
      )}
      <div className="flex flex-col gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Format</div>
        <div className="flex flex-wrap gap-1.5">
          {CONTENT_TYPES.map((f) => (
            <button
              key={f}
              onClick={() => setContentType(f)}
              className={cn(
                'h-8 rounded-full border px-3 text-xs font-medium capitalize',
                contentType === f
                  ? 'border-purple-600 bg-purple-600 text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Tone</div>
        <div className="flex flex-wrap gap-1.5">
          {TONES.map((t) => (
            <button
              key={t}
              onClick={() => setTone(t)}
              className={cn(
                'h-8 rounded-full border px-3 text-xs font-medium capitalize',
                tone === t
                  ? 'border-purple-600 bg-purple-600 text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="flex justify-end">
        <Button className="h-11" onClick={onStart} disabled={!prompt.trim()}>
          <Sparkles className="h-4 w-4" /> Run pipeline
        </Button>
      </div>
    </div>
  );
}

function PipelineProgress({
  status,
  outputs,
  revised,
  error,
  onCancel,
}: {
  status: Record<AgentKey, AgentStatus>;
  outputs: AgentOutputs;
  revised: boolean;
  error: string | null;
  onCancel: () => void;
}) {
  const steps = revised
    ? [
        ...baseSteps,
        { key: 'revisedScript' as AgentKey, label: 'Rewriting with reviewer notes', hint: 'Quality score below 70 — auto-revising', icon: RefreshCw },
        { key: 'revisedQuality' as AgentKey, label: 'Re-reviewing revised script', hint: 'Final pass', icon: Star },
      ]
    : baseSteps;

  return (
    <div className="flex flex-col gap-2">
      {steps.map((step) => {
        const st = status[step.key];
        const Icon = step.icon;
        const sample = previewOf(step.key, outputs);
        return (
          <div
            key={step.key}
            className={cn(
              'flex items-start gap-3 rounded-xl border p-3 transition-colors',
              st === 'running'
                ? 'border-purple-300 bg-white shadow-sm'
                : st === 'done'
                ? 'border-emerald-200 bg-emerald-50/40'
                : st === 'error'
                ? 'border-rose-200 bg-rose-50/40'
                : 'border-gray-200 bg-white opacity-70'
            )}
          >
            <div
              className={cn(
                'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                st === 'done'
                  ? 'bg-emerald-100 text-emerald-700'
                  : st === 'running'
                  ? 'bg-purple-100 text-purple-700'
                  : st === 'error'
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-gray-100 text-gray-400'
              )}
            >
              {st === 'done' ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : st === 'running' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : st === 'error' ? (
                <XCircle className="h-4 w-4" />
              ) : (
                <Icon className="h-3.5 w-3.5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900">{step.label}</div>
              <div className="text-xs text-gray-500">{sample ?? step.hint}</div>
            </div>
          </div>
        );
      })}
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {error}
        </div>
      )}
      <div className="flex justify-end pt-1">
        <Button variant="outline" className="h-9" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function previewOf(key: AgentKey, outputs: AgentOutputs): string | null {
  switch (key) {
    case 'profile':
      return outputs.profile?.audienceInsights?.slice(0, 100) ?? null;
    case 'competitor':
      return outputs.competitor?.keyTakeaway?.slice(0, 100) ?? null;
    case 'trends':
      return outputs.trends?.timingAdvice?.slice(0, 100) ?? null;
    case 'strategy':
      return outputs.strategy?.contentAngle?.slice(0, 100) ?? null;
    case 'script':
      return outputs.script?.hook?.slice(0, 100) ?? null;
    case 'quality':
      return outputs.quality
        ? `Score ${outputs.quality.qualityScore} · ${outputs.quality.verdict}`
        : null;
    case 'revisedScript':
      return outputs.revisedScript?.hook?.slice(0, 100) ?? null;
    case 'revisedQuality':
      return outputs.revisedQuality
        ? `Re-score ${outputs.revisedQuality.qualityScore} · ${outputs.revisedQuality.verdict}`
        : null;
  }
}

function PipelineResult({
  script,
  quality,
  wasRevised,
  onApprove,
  onRevise,
  onReject,
}: {
  script: ScriptDraft;
  quality: QualityReview;
  wasRevised: boolean;
  onApprove: () => void;
  onRevise: () => void;
  onReject: () => void;
}) {
  const score = quality.qualityScore;
  const scoreTone =
    score >= 80
      ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
      : score >= 60
      ? 'border-amber-300 bg-amber-50 text-amber-800'
      : 'border-rose-300 bg-rose-50 text-rose-700';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-200 bg-white p-4">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-gray-500">
            {wasRevised ? 'Revised script' : 'Script'}
          </div>
          <div className="truncate text-base font-semibold text-gray-900">{script.title}</div>
          <div className="text-xs text-gray-500">
            {quality.predictedViews} · {quality.predictedEngagement}
          </div>
        </div>
        <div className={cn('flex flex-col items-center rounded-xl border px-3 py-2 text-center', scoreTone)}>
          <span className="text-[10px] font-semibold uppercase tracking-wide">Quality</span>
          <span className="text-xl font-bold leading-tight">{score}</span>
          <span className="text-[10px] font-medium">{quality.verdict}</span>
        </div>
      </div>

      <ResultSection icon={Megaphone} label="Hook">
        <p className="text-sm font-medium text-gray-900">{script.hook}</p>
      </ResultSection>
      <ResultSection icon={Mic} label="Body" defaultOpen>
        <p className="whitespace-pre-wrap text-sm text-gray-800">{script.body}</p>
      </ResultSection>
      <ResultSection icon={ChevronRight} label="CTA">
        <p className="text-sm font-medium text-gray-900">{script.cta}</p>
      </ResultSection>
      <ResultSection icon={Mic} label="Caption">
        <p className="whitespace-pre-wrap text-sm text-gray-800">{script.caption}</p>
      </ResultSection>
      <ResultSection icon={Hash} label={`Hashtags (${script.hashtags.length})`}>
        <div className="flex flex-wrap gap-1.5">
          {script.hashtags.map((h) => (
            <span
              key={h}
              className="rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700"
            >
              {h.startsWith('#') ? h : `#${h}`}
            </span>
          ))}
        </div>
      </ResultSection>
      <ResultSection icon={Film} label={`Filming notes · ${script.estimatedDuration}`}>
        <p className="whitespace-pre-wrap text-sm text-gray-800">{script.filmingNotes}</p>
      </ResultSection>

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

      <div className="flex flex-wrap gap-2 pt-1">
        <Button className="h-11 flex-1" onClick={onApprove}>
          <CheckCircle2 className="h-4 w-4" /> Approve · move to Create
        </Button>
        <Button variant="outline" className="h-11" onClick={onRevise}>
          <RefreshCw className="h-4 w-4" /> Revise
        </Button>
        <Button variant="outline" className="h-11" onClick={onReject}>
          <ArrowLeft className="h-4 w-4" /> Start over
        </Button>
      </div>
    </div>
  );
}

function ResultSection({
  icon: Icon,
  label,
  children,
  defaultOpen = false,
}: {
  icon: typeof Eye;
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-gray-50"
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
      {open && <div className="border-t border-gray-100 px-4 py-3">{children}</div>}
    </div>
  );
}
