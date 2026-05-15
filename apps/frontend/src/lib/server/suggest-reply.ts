import 'server-only';
import { prisma } from './prisma';
import { getGmailThread } from './gmail';
import { callClaude } from './anthropic';

export type ReplyStance = 'interested' | 'info_request' | 'decline';

export interface ReplyOption {
  stance: ReplyStance;
  label: string;
  subject: string;
  body: string;
  why: string;
}

export interface SuggestReplyResponse {
  threadId: string;
  options: ReplyOption[];
}

const SYSTEM_PROMPT = `You are the AI manager for a solo content creator handling brand
collaboration emails. Given an inbound email thread, draft THREE distinct reply
options the creator can pick from. Each option takes a different stance:

  1. interested   — warm, professional, agrees to learn more. Asks for the
                    brief / deliverables / budget if not already provided.
                    2-4 sentences, ends in a clear next step.
  2. info_request — non-committal but engaged. Asks the 2-3 specific questions
                    the creator needs answered before deciding. 2-4 sentences.
  3. decline      — polite, brief, leaves the door open for future campaigns.
                    2-3 sentences. No reasons / no negotiation.

Write in a confident, conversational tone — NOT corporate boilerplate. Match
how a real creator emails (contractions, short paragraphs, no "Hope this email
finds you well"). Sign off with the creator's first name if known.

Return STRICT JSON, no prose or markdown fences:
{
  "options": [
    {
      "stance": "interested",
      "label": "Interested — ask for the brief",
      "subject": "Re: {original subject}",
      "body": "Hi {first-name},\\n\\n...",
      "why": "One sentence: why this option fits this thread."
    },
    { "stance": "info_request", ... },
    { "stance": "decline", ... }
  ]
}`;

export async function suggestReply(orgId: string, threadId: string): Promise<SuggestReplyResponse> {
  const thread = await getGmailThread(orgId, threadId);
  if (!thread) throw new Error('Thread not found');

  const user = await prisma.user.findFirst({
    where: { organizations: { some: { organizationId: orgId, disabled: false } } },
    select: { name: true, lastName: true, instagramHandle: true, instagramFollowers: true },
    orderBy: { createdAt: 'asc' },
  });

  const last = thread.messages[thread.messages.length - 1];
  const payload = {
    brand: thread.brand,
    brandEmail: thread.email,
    subject: thread.subject,
    latestMessage: {
      from: last?.from,
      at: last?.at,
      body: (last?.body ?? '').slice(0, 2000),
    },
    threadHistory: thread.messages.slice(-3).map((m) => ({
      from: m.from,
      at: m.at,
      snippet: m.body.slice(0, 400),
    })),
    creator: {
      firstName: user?.name ?? 'Aria',
      handle: user?.instagramHandle,
      followers: user?.instagramFollowers,
    },
  };

  const parsed = await callClaude<{ options: ReplyOption[] }>({
    systemPrompt: SYSTEM_PROMPT,
    userMessage: `Draft three reply options for this brand thread:\n\n${JSON.stringify(payload, null, 2)}`,
    maxTokens: 1500,
    timeoutMs: 25_000,
  });
  return { threadId, options: parsed.options ?? [] };
}
