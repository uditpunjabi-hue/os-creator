import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';
import { GoogleTokenService } from '@gitroom/backend/services/google/google-token.service';
import type {
  EmailProvider,
  EmailThread,
  EmailMessage,
  ReplyInput,
  ThreadStatus,
} from '@gitroom/backend/services/providers/email.provider';

const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';
const CACHE_TTL_SECONDS = 5 * 60;
const BRAND_SEARCH_QUERY =
  'in:inbox newer_than:90d (subject:collab OR subject:partnership OR ' +
  'subject:sponsored OR subject:campaign OR subject:ambassador OR ' +
  'subject:"brand deal" OR subject:"paid promotion" OR ' +
  '"brand deal" OR "paid partnership" OR "influencer campaign")';

// Local DB store key for thread metadata (status + starred).
const META_KEY = (orgId: string, threadId: string) =>
  `gmail:meta:${orgId}:${threadId}`;
const LIST_CACHE_KEY = (orgId: string, q: string) =>
  `gmail:list:${orgId}:${q || '_default'}`;
const THREAD_CACHE_KEY = (orgId: string, threadId: string) =>
  `gmail:thread:${orgId}:${threadId}`;

interface GmailListResponse {
  threads?: Array<{ id: string; snippet?: string; historyId?: string }>;
}

interface GmailThreadResponse {
  id: string;
  messages: GmailMessageResponse[];
  historyId?: string;
}

interface GmailMessageResponse {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailPayload;
}

interface GmailPayload {
  partId?: string;
  mimeType?: string;
  headers?: Array<{ name: string; value: string }>;
  body?: { data?: string; size?: number };
  parts?: GmailPayload[];
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

@Injectable()
export class GmailEmailProvider implements EmailProvider {
  private readonly logger = new Logger(GmailEmailProvider.name);

  constructor(
    private prisma: PrismaService,
    private googleToken: GoogleTokenService
  ) {}

  async listThreads(orgId: string, query?: string): Promise<EmailThread[]> {
    const conn = await this.googleToken.getValidAccessTokenForOrg(orgId);
    if (!conn) return [];

    const q = query?.trim()
      ? `${BRAND_SEARCH_QUERY} ${query.trim()}`
      : BRAND_SEARCH_QUERY;

    const cacheKey = LIST_CACHE_KEY(orgId, query?.trim() ?? '');
    try {
      const cached = await ioRedis.get(cacheKey);
      if (cached) return JSON.parse(cached) as EmailThread[];
    } catch {}

    try {
      const listRes = await fetch(
        `${GMAIL_BASE}/threads?maxResults=20&q=${encodeURIComponent(q)}`,
        { headers: { Authorization: `Bearer ${conn.token}` } }
      );
      if (!listRes.ok) {
        this.logger.warn(
          `Gmail threads list failed (${listRes.status}): ${(await listRes.text()).slice(0, 200)}`
        );
        return [];
      }
      const list = (await listRes.json()) as GmailListResponse;
      const ids = (list.threads ?? []).map((t) => t.id);
      if (ids.length === 0) {
        await ioRedis.set(cacheKey, '[]', 'EX', CACHE_TTL_SECONDS);
        return [];
      }

      // Hydrate each thread (5 in parallel batches to stay friendly).
      const threads: EmailThread[] = [];
      for (let i = 0; i < ids.length; i += 5) {
        const slice = ids.slice(i, i + 5);
        const hydrated = await Promise.all(
          slice.map((id) => this.fetchAndShapeThread(orgId, id, conn.token))
        );
        for (const t of hydrated) {
          if (t) threads.push(t);
        }
      }

      threads.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
      await ioRedis.set(cacheKey, JSON.stringify(threads), 'EX', CACHE_TTL_SECONDS);
      return threads;
    } catch (e) {
      this.logger.error(`Gmail listThreads crashed: ${(e as Error).message}`);
      return [];
    }
  }

  async getThread(orgId: string, threadId: string): Promise<EmailThread | null> {
    const conn = await this.googleToken.getValidAccessTokenForOrg(orgId);
    if (!conn) return null;
    return this.fetchAndShapeThread(orgId, threadId, conn.token);
  }

  async reply(orgId: string, threadId: string, body: ReplyInput): Promise<EmailThread | null> {
    const conn = await this.googleToken.getValidAccessTokenForOrg(orgId);
    if (!conn) return null;

    const thread = await this.fetchAndShapeThread(orgId, threadId, conn.token);
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
        this.logger.warn(
          `Gmail send failed (${sendRes.status}): ${(await sendRes.text()).slice(0, 200)}`
        );
        return null;
      }
    } catch (e) {
      this.logger.error(`Gmail send crashed: ${(e as Error).message}`);
      return null;
    }

    // Invalidate caches for this thread + list.
    try {
      await ioRedis.del(THREAD_CACHE_KEY(orgId, threadId));
      const keys = await ioRedis.keys(`gmail:list:${orgId}:*`);
      if (keys.length) await ioRedis.del(...keys);
    } catch {}

    return this.fetchAndShapeThread(orgId, threadId, conn.token);
  }

  async setStatus(orgId: string, threadId: string, status: ThreadStatus): Promise<EmailThread | null> {
    const meta = await this.readMeta(orgId, threadId);
    await this.writeMeta(orgId, threadId, { ...meta, status });
    return this.getThread(orgId, threadId);
  }

  async setStarred(orgId: string, threadId: string, starred: boolean): Promise<EmailThread | null> {
    const meta = await this.readMeta(orgId, threadId);
    await this.writeMeta(orgId, threadId, { ...meta, starred });
    return this.getThread(orgId, threadId);
  }

  async listTemplates() {
    return SAMPLE_TEMPLATES;
  }

  // =========================================================================
  // helpers
  // =========================================================================

  private async fetchAndShapeThread(
    orgId: string,
    threadId: string,
    token: string
  ): Promise<EmailThread | null> {
    const cacheKey = THREAD_CACHE_KEY(orgId, threadId);
    try {
      const cached = await ioRedis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as EmailThread;
        const meta = await this.readMeta(orgId, threadId);
        return { ...parsed, status: meta.status, starred: meta.starred };
      }
    } catch {}

    const res = await fetch(`${GMAIL_BASE}/threads/${threadId}?format=full`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      this.logger.warn(
        `Gmail get thread ${threadId} failed (${res.status})`
      );
      return null;
    }
    const t = (await res.json()) as GmailThreadResponse;
    if (!t.messages?.length) return null;

    const shaped = this.shape(t);
    const meta = await this.readMeta(orgId, threadId);
    const out: EmailThread = { ...shaped, status: meta.status, starred: meta.starred };
    try {
      await ioRedis.set(cacheKey, JSON.stringify(shaped), 'EX', CACHE_TTL_SECONDS);
    } catch {}
    return out;
  }

  private shape(thread: GmailThreadResponse): EmailThread {
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

  private async readMeta(orgId: string, threadId: string) {
    try {
      const raw = await ioRedis.get(META_KEY(orgId, threadId));
      if (raw) {
        const parsed = JSON.parse(raw) as { status?: ThreadStatus; starred?: boolean };
        return {
          status: parsed.status ?? ('NEW_LEAD' as ThreadStatus),
          starred: parsed.starred ?? false,
        };
      }
    } catch {}
    return { status: 'NEW_LEAD' as ThreadStatus, starred: false };
  }

  private async writeMeta(
    orgId: string,
    threadId: string,
    meta: { status: ThreadStatus; starred: boolean }
  ) {
    try {
      await ioRedis.set(META_KEY(orgId, threadId), JSON.stringify(meta));
    } catch {}
  }
}

function headerValue(headers: Array<{ name: string; value: string }>, key: string): string | undefined {
  return headers.find((h) => h.name.toLowerCase() === key.toLowerCase())?.value;
}

function parseSender(raw: string): { name: string; email: string } {
  // Forms: "Name <email>" or just "email"
  const m = raw.match(/^"?(.*?)"?\s*<([^>]+)>$/);
  if (m) return { name: m[1].trim() || m[2], email: m[2].trim() };
  return { name: raw.trim(), email: raw.trim() };
}

function decodeBody(payload?: GmailPayload): string {
  if (!payload) return '';
  // Prefer text/plain. Fall back to text/html stripped.
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
