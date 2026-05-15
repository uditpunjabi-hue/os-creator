'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Inbox as InboxIcon,
  Search,
  Reply,
  ChevronLeft,
  Star,
  Loader2,
  Sparkles,
  Mail,
  ArrowRight,
} from 'lucide-react';
import { Badge } from '@gitroom/frontend/components/shadcn/ui/badge';
import { Button } from '@gitroom/frontend/components/shadcn/ui/button';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { SkeletonList } from '@gitroom/frontend/components/ui/skeleton';
import {
  useInboxThreads,
  useInboxTemplates,
  useManagerMutations,
  useManagerProfile,
  type EmailThread,
  type ThreadStatus,
} from '@gitroom/frontend/hooks/manager';
import { cn } from '@gitroom/frontend/lib/utils';

const statusMeta: Record<
  ThreadStatus,
  { label: string; variant: 'default' | 'warning' | 'success' | 'destructive' | 'secondary' }
> = {
  NEW_LEAD: { label: 'New Lead', variant: 'default' },
  IN_NEGOTIATION: { label: 'In Negotiation', variant: 'warning' },
  CLOSED_WON: { label: 'Closed Won', variant: 'success' },
  CLOSED_LOST: { label: 'Closed Lost', variant: 'secondary' },
  REJECTED: { label: 'Rejected', variant: 'destructive' },
};

const fmtTime = (s: string) => {
  const d = new Date(s);
  const now = Date.now();
  const delta = (now - d.getTime()) / 1000;
  if (delta < 60) return 'now';
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;
  if (delta < 7 * 86400) return `${Math.floor(delta / 86400)}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

type InboxFilter = 'all' | 'brands' | 'starred';

export default function InboxPage() {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filter, setFilter] = useState<InboxFilter>('all');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  const { data: inboxRes, isLoading } = useInboxThreads(debounced);
  const { data: profile } = useManagerProfile();
  const googleConnected = profile?.connections.google.connected ?? false;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const all = inboxRes?.threads ?? [];
  const inboxStatus = inboxRes?.status ?? 'ok';
  const selected = useMemo(
    () => all.find((t) => t.id === selectedId) ?? null,
    [all, selectedId]
  );

  const brandCount = all.filter((t) => t.isBrand).length;
  const starredCount = all.filter((t) => t.starred).length;
  const unreadCount = all.filter((t) => t.unread).length;

  const filtered = useMemo(() => {
    if (filter === 'brands') return all.filter((t) => t.isBrand);
    if (filter === 'starred') return all.filter((t) => t.starred);
    return all;
  }, [all, filter]);

  // Three distinct empty states:
  //  - Google not connected at all → "Connect Google" CTA (existing)
  //  - Google was connected but the token's stale → "Reconnect Google" CTA
  //  - Connected + token good + no mail → "Inbox is empty" copy
  const showConnectGoogle =
    !isLoading && (inboxStatus === 'not_connected' || !googleConnected) && all.length === 0;
  const showReconnectGoogle =
    !isLoading && inboxStatus === 'token_invalid';

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-col gap-3 border-b border-gray-200 bg-white px-4 py-3 lg:px-8 lg:py-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
              <InboxIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-900">Inbox</div>
              <div className="text-xs text-gray-500">
                {unreadCount} unread · {brandCount} brand · {starredCount} starred
              </div>
            </div>
          </div>
          <div className="relative w-full lg:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search subject, sender, body…"
              className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
            />
          </div>
        </div>

        {/* Filter tabs — All / Brands / Starred. The counts are always over
            the full thread list, so switching filters doesn't change the
            badge numbers (matches Gmail-style chip behavior). */}
        <div className="flex gap-1.5 overflow-x-auto">
          {([
            { id: 'all', label: 'All', count: all.length },
            { id: 'brands', label: 'Brands', count: brandCount },
            { id: 'starred', label: 'Starred', count: starredCount },
          ] as Array<{ id: InboxFilter; label: string; count: number }>).map((tab) => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={cn(
                  'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors',
                  active
                    ? 'border-purple-600 bg-purple-600 text-white'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    'inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums',
                    active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                  )}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div
          className={cn(
            'w-full overflow-y-auto bg-white lg:w-[380px] lg:border-r lg:border-gray-200',
            selected ? 'hidden lg:block' : 'block'
          )}
        >
          {isLoading && !inboxRes ? (
            <div className="p-4">
              <SkeletonList count={6} />
            </div>
          ) : showReconnectGoogle ? (
            <ReconnectGoogleEmpty />
          ) : showConnectGoogle ? (
            <ConnectGoogleEmpty />
          ) : filtered.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-gray-500">
              {debounced
                ? `No threads matching "${debounced}".`
                : filter === 'brands'
                ? 'No brand emails yet — collab / partnership / campaign threads will show up here automatically.'
                : filter === 'starred'
                ? 'No starred threads yet. Tap the star on any email to pin it here.'
                : 'Inbox is empty — recent emails will show up here.'}
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filtered.map((t) => (
                <ThreadRow
                  key={t.id}
                  thread={t}
                  active={selectedId === t.id}
                  onSelect={() => setSelectedId(t.id)}
                />
              ))}
            </ul>
          )}
        </div>

        <div className={cn('flex-1 overflow-y-auto bg-gray-50 lg:bg-white', selected ? 'block' : 'hidden lg:block')}>
          {selected ? (
            <ThreadView thread={selected} onBack={() => setSelectedId(null)} />
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-sm text-gray-400">
              Select a thread to read it
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ThreadRow({
  thread,
  active,
  onSelect,
}: {
  thread: EmailThread;
  active: boolean;
  onSelect: () => void;
}) {
  const meta = statusMeta[thread.status];
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'flex w-full flex-col gap-1.5 px-4 py-4 text-left transition-colors min-h-[80px]',
          active ? 'bg-purple-50' : 'hover:bg-gray-50',
          'active:bg-gray-100'
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {thread.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-purple-600" />}
            {thread.starred && <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />}
            <span className={cn('truncate text-sm', thread.unread ? 'font-semibold text-gray-900' : 'text-gray-700')}>
              {thread.brand}
            </span>
          </div>
          <span className="shrink-0 text-xs text-gray-400">{fmtTime(thread.updatedAt)}</span>
        </div>
        <div className="line-clamp-1 text-sm text-gray-700">{thread.subject}</div>
        <div className="line-clamp-1 text-xs text-gray-500">{thread.preview}</div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {/* Brand badge — purple, sits next to the existing status chip so
              both surfaces of intent are visible on the same row. Only
              renders when the server flagged the thread as brand-related. */}
          {thread.isBrand && (
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-700">
              <Sparkles className="h-2.5 w-2.5" /> Brand
            </span>
          )}
          {/* Only show the deal-status pill on brand threads. For random
              non-brand emails (newsletters, receipts, friends) the NEW_LEAD
              default reads as noise — hide it. */}
          {thread.isBrand && <Badge variant={meta.variant}>{meta.label}</Badge>}
        </div>
      </button>
    </li>
  );
}

interface AiReplyOption {
  stance: 'interested' | 'info_request' | 'decline';
  label: string;
  subject: string;
  body: string;
  why: string;
}

function ThreadView({ thread, onBack }: { thread: EmailThread; onBack: () => void }) {
  const { data: templates } = useInboxTemplates();
  const { replyToThread, setThreadStatus, setThreadStarred } = useManagerMutations();
  const fetch = useFetch();
  const [replyBody, setReplyBody] = useState('');
  const [sending, setSending] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [aiOptions, setAiOptions] = useState<AiReplyOption[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const meta = statusMeta[thread.status];

  const suggestReply = async () => {
    setAiLoading(true);
    setAiError(null);
    setAiOptions(null);
    try {
      const res = await fetch(`/manager/inbox/threads/${thread.id}/suggest-reply`, {
        method: 'POST',
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        setAiError(text.slice(0, 200) || `Suggest failed (${res.status})`);
        return;
      }
      const data = (await res.json()) as { options: AiReplyOption[] };
      setAiOptions(data.options ?? []);
    } catch (e) {
      setAiError((e as Error).message);
    } finally {
      setAiLoading(false);
    }
  };

  const applyTemplate = (templateId: string) => {
    const tpl = templates?.find((t) => t.id === templateId);
    if (!tpl) return;
    setReplyBody(
      tpl.body
        .replace(/{{name}}/g, thread.brand)
        .replace(/{{subject}}/g, thread.subject)
        .replace(/{{me}}/g, 'You')
        .replace(/{{counter_amount}}/g, '$4,500')
    );
  };

  const onSend = async () => {
    if (!replyBody.trim()) return;
    setSending(true);
    try {
      await replyToThread(thread.id, replyBody);
      setReplyBody('');
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const changeStatus = async (status: ThreadStatus) => {
    setSavingStatus(true);
    try {
      await setThreadStatus(thread.id, status);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSavingStatus(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-8">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-sm font-medium text-purple-700 lg:hidden"
      >
        <ChevronLeft className="h-4 w-4" /> Back
      </button>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-lg font-semibold text-gray-900 lg:text-xl">{thread.subject}</h2>
            <button
              onClick={() => setThreadStarred(thread.id, !thread.starred)}
              className="rounded-full p-1 text-gray-400 hover:text-amber-500"
              aria-label="Toggle star"
            >
              <Star className={cn('h-4 w-4', thread.starred && 'fill-amber-400 text-amber-400')} />
            </button>
          </div>
          <div className="mt-1 text-sm text-gray-500">
            <span className="font-medium text-gray-700">{thread.brand}</span>
            <span className="mx-1">·</span>
            <span className="truncate">{thread.email}</span>
          </div>
        </div>
        <Badge variant={meta.variant}>{meta.label}</Badge>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {(['NEW_LEAD', 'IN_NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST', 'REJECTED'] as ThreadStatus[]).map(
          (s) => (
            <button
              key={s}
              onClick={() => changeStatus(s)}
              disabled={savingStatus || thread.status === s}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                thread.status === s
                  ? 'border-purple-300 bg-purple-50 text-purple-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-purple-200 hover:text-purple-700'
              )}
            >
              {statusMeta[s].label}
            </button>
          )
        )}
      </div>

      <div className="flex flex-col gap-3">
        {thread.messages.map((m) => {
          const fromMe = m.from.includes('Illuminati.app') || m.from === 'you@Illuminati.app';
          return (
            <article
              key={m.id}
              className={cn(
                'rounded-2xl border bg-white p-4 text-sm shadow-sm',
                fromMe ? 'border-purple-200 bg-purple-50/40' : 'border-gray-200'
              )}
            >
              <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
                <span className="font-medium text-gray-700">{fromMe ? 'You' : m.from}</span>
                <span>{fmtTime(m.at)}</span>
              </div>
              <p className="whitespace-pre-line text-sm text-gray-800">{m.body}</p>
            </article>
          );
        })}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
        {/* AI Suggest Reply — Claude generates 3 stance variants */}
        <div className="mb-3 rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 to-white p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-700">
              <Sparkles className="h-3.5 w-3.5" /> AI Suggest Reply
            </div>
            <Button
              onClick={suggestReply}
              disabled={aiLoading}
              className="h-8 px-3 text-xs"
              style={{ backgroundColor: '#F59E0B' }}
            >
              {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Draft 3 replies'}
            </Button>
          </div>
          {aiError && (
            <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-700">
              {aiError}
            </div>
          )}
          {aiOptions && aiOptions.length > 0 && (
            <div className="mt-3 flex flex-col gap-2">
              {aiOptions.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => setReplyBody(opt.body)}
                  className="flex flex-col gap-1.5 rounded-xl border border-gray-200 bg-white p-3 text-left transition-colors hover:border-purple-300"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-gray-900">{opt.label}</div>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                        opt.stance === 'interested'
                          ? 'bg-emerald-100 text-emerald-700'
                          : opt.stance === 'info_request'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-gray-100 text-gray-700'
                      )}
                    >
                      {opt.stance.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="line-clamp-3 text-xs text-gray-700">{opt.body}</div>
                  {opt.why && (
                    <div className="text-[11px] italic text-gray-500">Why: {opt.why}</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {templates && templates.length > 0 && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-gray-400">
              <Sparkles className="mr-1 inline h-3 w-3" />
              Template:
            </span>
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => applyTemplate(t.id)}
                className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-700 hover:border-purple-200 hover:text-purple-700"
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
        <textarea
          value={replyBody}
          onChange={(e) => setReplyBody(e.target.value)}
          placeholder="Write a reply…"
          className="min-h-[120px] w-full resize-none rounded-lg border border-transparent bg-transparent p-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-100"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            Mock send · real Gmail requires OAuth
          </span>
          <Button onClick={onSend} disabled={sending || !replyBody.trim()} className="h-11">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Reply className="h-4 w-4" />}
            Send reply
          </Button>
        </div>
      </div>
    </div>
  );
}

// Friendly pre-onboarding state for users who haven't connected Google yet.
// The Inbox + AI Reply features need Gmail; everything else in Manager works
// fine without it, so the CTA is informative, not blocking.
function ReconnectGoogleEmpty() {
  const fetch = useFetch();
  const { backendUrl } = useVariables();
  // Disconnect first so the next Google OAuth start screen forces fresh
  // consent + a fresh refresh token. Awaiting matters — the route's
  // Set-Cookie cleanup has to land before we leave for the OAuth dance.
  const reconnect = async () => {
    try {
      await fetch('/manager/settings/disconnect/google', { method: 'POST' });
    } catch {
      // Continue regardless; reconnect flow will overwrite stale tokens.
    }
    window.location.href = `${backendUrl}/oauth/google/start`;
  };
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
        <Mail className="h-6 w-6" />
      </div>
      <div>
        <div className="text-base font-semibold text-gray-900">
          Unable to load emails — reconnect Google
        </div>
        <p className="mx-auto mt-1 max-w-sm text-sm text-gray-600">
          Your Google session has expired or been revoked. Reconnecting takes
          ~10 seconds and pulls your inbox back in. The rest of the app is
          unaffected.
        </p>
      </div>
      <button
        type="button"
        onClick={reconnect}
        className="inline-flex h-11 items-center gap-1.5 rounded-full bg-purple-600 px-4 text-sm font-semibold text-white hover:bg-purple-700"
      >
        Reconnect Google
        <ArrowRight className="h-4 w-4" />
      </button>
      <Link
        href="/manager/settings"
        className="text-[11px] text-gray-500 hover:text-gray-700"
      >
        Manage account in Settings →
      </Link>
    </div>
  );
}

function ConnectGoogleEmpty() {
  const { backendUrl } = useVariables();
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
        <Mail className="h-6 w-6" />
      </div>
      <div>
        <div className="text-base font-semibold text-gray-900">
          Connect Google to see your brand emails
        </div>
        <p className="mx-auto mt-1 max-w-sm text-sm text-gray-600">
          Inbox pulls collaboration threads from Gmail and lets the AI suggest replies.
          The rest of the app — deals, payments, schedule, creator features — works without it.
        </p>
      </div>
      <a
        href={`${backendUrl}/oauth/google/start`}
        className="inline-flex h-11 items-center gap-1.5 rounded-full bg-purple-600 px-4 text-sm font-semibold text-white hover:bg-purple-700"
      >
        Connect Google
        <ArrowRight className="h-4 w-4" />
      </a>
      <div className="text-[11px] text-gray-400">Takes about 10 seconds · one Google account</div>
    </div>
  );
}
