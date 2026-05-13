'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Inbox as InboxIcon,
  Search,
  Reply,
  ChevronLeft,
  Star,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@gitroom/frontend/components/shadcn/ui/badge';
import { Button } from '@gitroom/frontend/components/shadcn/ui/button';
import {
  useInboxThreads,
  useInboxTemplates,
  useManagerMutations,
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

export default function InboxPage() {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  const { data: threads, isLoading } = useInboxThreads(debounced);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => threads?.find((t) => t.id === selectedId) ?? null,
    [threads, selectedId]
  );

  const unreadCount = (threads ?? []).filter((t) => t.unread).length;
  const starredCount = (threads ?? []).filter((t) => t.starred).length;

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-col gap-3 border-b border-gray-200 bg-white px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
            <InboxIcon className="h-5 w-5" />
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900">Inbox</div>
            <div className="text-xs text-gray-500">
              {unreadCount} unread · {starredCount} starred
            </div>
          </div>
        </div>
        <div className="relative w-full lg:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search brand, subject, body…"
            className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
          />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div
          className={cn(
            'w-full overflow-y-auto bg-white lg:w-[380px] lg:border-r lg:border-gray-200',
            selected ? 'hidden lg:block' : 'block'
          )}
        >
          {isLoading && !threads ? (
            <div className="flex items-center justify-center py-12 text-sm text-gray-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading threads…
            </div>
          ) : (threads ?? []).length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-gray-500">
              {debounced ? `No threads matching "${debounced}".` : 'Inbox is empty.'}
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {(threads ?? []).map((t) => (
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
          <div className="flex items-center gap-2">
            {thread.unread && <span className="h-2 w-2 rounded-full bg-purple-600" />}
            {thread.starred && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
            <span className={cn('text-sm', thread.unread ? 'font-semibold text-gray-900' : 'text-gray-700')}>
              {thread.brand}
            </span>
          </div>
          <span className="text-xs text-gray-400">{fmtTime(thread.updatedAt)}</span>
        </div>
        <div className="line-clamp-1 text-sm text-gray-700">{thread.subject}</div>
        <div className="line-clamp-1 text-xs text-gray-500">{thread.preview}</div>
        <Badge variant={meta.variant} className="mt-1 w-fit">{meta.label}</Badge>
      </button>
    </li>
  );
}

function ThreadView({ thread, onBack }: { thread: EmailThread; onBack: () => void }) {
  const { data: templates } = useInboxTemplates();
  const { replyToThread, setThreadStatus, setThreadStarred } = useManagerMutations();
  const [replyBody, setReplyBody] = useState('');
  const [sending, setSending] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const meta = statusMeta[thread.status];

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
