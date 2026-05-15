import 'server-only';
import { memoryCache } from './memory-cache';
import { getGoogleTokenForOrg } from './google-token';

const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';
const CACHE_TTL_SECONDS = 5 * 60;
const BRAND_SEARCH_QUERY =
  'in:inbox newer_than:90d (subject:collab OR subject:partnership OR ' +
  'subject:sponsored OR subject:campaign OR subject:ambassador OR ' +
  'subject:"brand deal" OR subject:"paid promotion" OR ' +
  '"brand deal" OR "paid partnership" OR "influencer campaign")';

const META_KEY = (orgId: string, threadId: string) => `gmail:meta:${orgId}:${threadId}`;
const LIST_CACHE_KEY = (orgId: string, q: string) => `gmail:list:${orgId}:${q || '_default'}`;
const THREAD_CACHE_KEY = (orgId: string, threadId: string) => `gmail:thread:${orgId}:${threadId}`;

export type ThreadStatus =
  | 'NEW_LEAD'
  | 'IN_NEGOTIATION'
  | 'CLOSED_WON'
  | 'CLOSED_LOST'
  | 'REJECTED';

export interface EmailMessage {
  id: string;
  from: string;
  to: string;
  at: string;
  body: string;
}

export interface EmailThread {
  id: string;
  brand: string;
  email: string;
  subject: string;
  preview: string;
  messages: EmailMessage[];
  status: ThreadStatus;
  starred: boolean;
  updatedAt: string;
  unread: boolean;
}

export interface ReplyInput {
  body: string;
  template?: string;
}

interface GmailPayload {
  partId?: string;
  mimeType?: string;
  headers?: Array<{ name: string; value: string }>;
  body?: { data?: string; size?: number };
  parts?: GmailPayload[];
}

interface GmailMessageResponse {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailPayload;
}

interface GmailThreadResponse {
  id: string;
  messages: GmailMessageResponse[];
  historyId?: string;
}

interface GmailListResponse {
  threads?: Array<{ id: string; snippet?: string; historyId?: string }>;
}

const SAMPLE_TEMPLATES = [
  {
    id: 'interested',
    name: 'Interested — ask for brief',
    subject: 'Re: {{subject}}',
    body:
      "Hi {{name}},\n\nThanks for reaching out — we'd love to learn more. Can you share the campaign brief, deliverable count, and budget range?\n\nBest,\n{{me}}",
  },
  {
    id: 'counter',
    name: 'Counter offer',
    subject: 'Re: {{subject}}',
    body:
      "Hi {{name}},\n\nThanks for the offer. Based on our creator's current rate card and the scope you described, we'd land at {{counter_amount}} for the package. Happy to walk through the breakdown on a quick call.\n\nBest,\n{{me}}",
  },
  {
    id: 'not_interested',
    name: 'Not interested — friendly close',
    subject: 'Re: {{subject}}',
    body:
      "Hi {{name}},\n\nReally appreciate you thinking of us. This particular fit doesn't align with our current focus, but please keep us in mind for future campaigns.\n\nBest,\n{{me}}",
  },
  {
    id: 'follow_up',
    name: 'Polite follow-up',
    subject: 'Following up on {{subject}}',
    body:
      "Hi {{name}},\n\nJust bumping this thread — wanted to make sure my last note didn't get buried. Happy to schedule a quick sync if that's easier.\n\nBest,\n{{me}}",
  },
];

export async function listGmailThreads(orgId: string, query?: string): Promise<EmailThread[]> {
  const conn = await getGoogleTokenForOrg(orgId);
  if (!conn) return [];

  const q = query?.trim() ? `${BRAND_SEARCH_QUERY} ${query.trim()}` : BRAND_SEARCH_QUERY;
  const cacheKey = LIST_CACHE_KEY(orgId, query?.trim() ?? '');
  const cached = memoryCache.get<EmailThread[]>(cacheKey);
  if (cached) return cached;

  try {
    const listRes = await fetch(
      `${GMAIL_BASE}/threads?maxResults=20&q=${encodeURIComponent(q)}`,
      { headers: { Authorization: `Bearer ${conn.token}` } }
    );
    if (!listRes.ok) {
      console.warn(`Gmail list failed (${listRes.status}): ${(await listRes.text()).slice(0, 200)}`);
      return [];
    }
    const list = (await listRes.json()) as GmailListResponse;
    const ids = (list.threads ?? []).map((t) => t.id);
    if (ids.length === 0) {
      memoryCache.set(cacheKey, [], CACHE_TTL_SECONDS);
      return [];
    }
    const threads: EmailThread[] = [];
    for (let i = 0; i < ids.length; i += 5) {
      const slice = ids.slice(i, i + 5);
      const hydrated = await Promise.all(
        slice.map((id) => fetchAndShapeThread(orgId, id, conn.token))
      );
      for (const t of hydrated) if (t) threads.push(t);
    }
    threads.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
    memoryCache.set(cacheKey, threads, CACHE_TTL_SECONDS);
    return threads;
  } catch (e) {
    console.error(`Gmail listThreads crashed: ${(e as Error).message}`);
    return [];
  }
}

export async function getGmailThread(orgId: string, threadId: string): Promise<EmailThread | null> {
  const conn = await getGoogleTokenForOrg(orgId);
  if (!conn) return null;
  return fetchAndShapeThread(orgId, threadId, conn.token);
}

export async function replyGmail(
  orgId: string,
  threadId: string,
  body: ReplyInput
): Promise<EmailThread | null> {
  const conn = await getGoogleTokenForOrg(orgId);
  if (!conn) return null;

  const thread = await fetchAndShapeThread(orgId, threadId, conn.token);
  if (!thread) return null;

  const lastMessage = thread.messages[thread.messages.length - 1];
  const replyTo = thread.email;
  const subject = thread.subject.startsWith('Re:') ? thread.subject : `Re: ${thread.subject}`;

  const raw = [
    `To: ${replyTo}`,
    `Subject: ${subject}`,
    `In-Reply-To: ${lastMessage?.id ?? ''}`,
    `References: ${lastMessage?.id ?? ''}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    body.body,
  ].join('\r\n');

  const encoded = Buffer.from(raw, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  try {
    const sendRes = await fetch(`${GMAIL_BASE}/messages/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${conn.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ raw: encoded, threadId }),
    });
    if (!sendRes.ok) {
      console.warn(`Gmail send failed (${sendRes.status}): ${(await sendRes.text()).slice(0, 200)}`);
      return null;
    }
  } catch (e) {
    console.error(`Gmail send crashed: ${(e as Error).message}`);
    return null;
  }

  memoryCache.del(THREAD_CACHE_KEY(orgId, threadId));
  memoryCache.delPattern(`gmail:list:${orgId}:*`);
  return fetchAndShapeThread(orgId, threadId, conn.token);
}

export async function setGmailStatus(
  orgId: string,
  threadId: string,
  status: ThreadStatus
): Promise<EmailThread | null> {
  const meta = readMeta(orgId, threadId);
  writeMeta(orgId, threadId, { ...meta, status });
  return getGmailThread(orgId, threadId);
}

export async function setGmailStarred(
  orgId: string,
  threadId: string,
  starred: boolean
): Promise<EmailThread | null> {
  const meta = readMeta(orgId, threadId);
  writeMeta(orgId, threadId, { ...meta, starred });
  return getGmailThread(orgId, threadId);
}

export function listGmailTemplates() {
  return SAMPLE_TEMPLATES;
}

/**
 * Send a brand-new email (not a thread reply). Used by the Payments page's
 * "Send reminder" action. Returns true on success, false if Google isn't
 * connected or the send call errored — callers should surface a user-visible
 * message accordingly.
 */
export async function sendGmailEmail(
  orgId: string,
  args: { to: string; subject: string; body: string }
): Promise<boolean> {
  const conn = await getGoogleTokenForOrg(orgId);
  if (!conn) return false;

  const raw = [
    `To: ${args.to}`,
    `Subject: ${args.subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    args.body,
  ].join('\r\n');
  const encoded = Buffer.from(raw, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  try {
    const res = await fetch(`${GMAIL_BASE}/messages/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${conn.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ raw: encoded }),
    });
    if (!res.ok) {
      console.warn(`Gmail send (fresh) failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`Gmail send (fresh) crashed: ${(e as Error).message}`);
    return false;
  }
}

// =========================================================================
// helpers
// =========================================================================

async function fetchAndShapeThread(
  orgId: string,
  threadId: string,
  token: string
): Promise<EmailThread | null> {
  const cacheKey = THREAD_CACHE_KEY(orgId, threadId);
  const cached = memoryCache.get<EmailThread>(cacheKey);
  if (cached) {
    const meta = readMeta(orgId, threadId);
    return { ...cached, status: meta.status, starred: meta.starred };
  }

  const res = await fetch(`${GMAIL_BASE}/threads/${threadId}?format=full`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    console.warn(`Gmail get thread ${threadId} failed (${res.status})`);
    return null;
  }
  const t = (await res.json()) as GmailThreadResponse;
  if (!t.messages?.length) return null;

  const shaped = shape(t);
  const meta = readMeta(orgId, threadId);
  const out: EmailThread = { ...shaped, status: meta.status, starred: meta.starred };
  memoryCache.set(cacheKey, shaped, CACHE_TTL_SECONDS);
  return out;
}

function shape(thread: GmailThreadResponse): EmailThread {
  const messages: EmailMessage[] = thread.messages.map((m) => {
    const headers = m.payload?.headers ?? [];
    const from = headerValue(headers, 'From') ?? 'unknown';
    const to = headerValue(headers, 'To') ?? '';
    const date = m.internalDate
      ? new Date(parseInt(m.internalDate, 10)).toISOString()
      : new Date().toISOString();
    const body = decodeBody(m.payload) || m.snippet || '';
    return { id: m.id, from, to, at: date, body };
  });
  const last = thread.messages[thread.messages.length - 1];
  const headers = thread.messages[0].payload?.headers ?? [];
  const subject = headerValue(headers, 'Subject') ?? '(no subject)';
  const fromHeader = headerValue(headers, 'From') ?? 'unknown';
  const { name: brand, email } = parseSender(fromHeader);
  const updatedAt = last.internalDate
    ? new Date(parseInt(last.internalDate, 10)).toISOString()
    : new Date().toISOString();
  const unread = !!last.labelIds?.includes('UNREAD');
  const preview = (last.snippet || messages[messages.length - 1].body || '')
    .slice(0, 200)
    .replace(/\s+/g, ' ')
    .trim();

  return {
    id: thread.id,
    brand,
    email,
    subject,
    preview,
    messages,
    status: 'NEW_LEAD',
    starred: false,
    updatedAt,
    unread,
  };
}

function readMeta(orgId: string, threadId: string) {
  const parsed = memoryCache.get<{ status?: ThreadStatus; starred?: boolean }>(
    META_KEY(orgId, threadId)
  );
  return {
    status: parsed?.status ?? ('NEW_LEAD' as ThreadStatus),
    starred: parsed?.starred ?? false,
  };
}

function writeMeta(
  orgId: string,
  threadId: string,
  meta: { status: ThreadStatus; starred: boolean }
) {
  memoryCache.set(META_KEY(orgId, threadId), meta);
}

function headerValue(headers: Array<{ name: string; value: string }>, key: string): string | undefined {
  return headers.find((h) => h.name.toLowerCase() === key.toLowerCase())?.value;
}

function parseSender(raw: string): { name: string; email: string } {
  const m = raw.match(/^"?(.*?)"?\s*<([^>]+)>$/);
  if (m) return { name: m[1].trim() || m[2], email: m[2].trim() };
  return { name: raw.trim(), email: raw.trim() };
}

function decodeBody(payload?: GmailPayload): string {
  if (!payload) return '';
  const plain = findPart(payload, 'text/plain');
  if (plain?.body?.data) return base64UrlDecode(plain.body.data);
  const html = findPart(payload, 'text/html');
  if (html?.body?.data) return stripHtml(base64UrlDecode(html.body.data));
  if (payload.body?.data) return base64UrlDecode(payload.body.data);
  return '';
}

function findPart(payload: GmailPayload, mimeType: string): GmailPayload | undefined {
  if (payload.mimeType === mimeType) return payload;
  for (const part of payload.parts ?? []) {
    const found = findPart(part, mimeType);
    if (found) return found;
  }
  return undefined;
}

function base64UrlDecode(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  return Buffer.from(b64 + pad, 'base64').toString('utf8');
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
