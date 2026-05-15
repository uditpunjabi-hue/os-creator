import 'server-only';
import { callClaude, ClaudeError } from './anthropic';

export interface PaymentReminderDraft {
  subject: string;
  body: string;
  tone: 'friendly' | 'firm' | 'final';
  partial?: boolean;
}

interface DraftArgs {
  brand: string;
  amount: number;
  currency: string;
  dueDate: string | null;
  daysOverdue: number;
  description?: string | null;
  recipientName?: string | null;
  senderName?: string | null;
  isFirstReminder: boolean;
}

const SYSTEM = `You are a manager drafting a polite, professional payment reminder for an outstanding invoice on behalf of a creator. The recipient is a brand contact who owes money.

Tone scale by how overdue:
  - <= 0 days (early nudge): "friendly" — light, value-first, easy out
  - 1-14 days: "firm" but warm
  - 14+ days: "final" — direct, mentions next step, still professional

Always:
  - Use the recipient name when given
  - Cite the actual amount, currency, and due date / days overdue
  - End with one clear ask (when can we expect payment?)
  - Keep it under 120 words

Return STRICT JSON, no prose or fences:
{
  "subject": "short, specific (no 'URGENT' caps)",
  "body": "the email body — plain text, no markdown, single blank line between paragraphs",
  "tone": "friendly | firm | final"
}`;

const FALLBACK = (a: DraftArgs): PaymentReminderDraft => {
  const tone: PaymentReminderDraft['tone'] =
    a.daysOverdue > 14 ? 'final' : a.daysOverdue > 0 ? 'firm' : 'friendly';
  const due = a.dueDate
    ? new Date(a.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : 'the agreed date';
  const overdueClause =
    a.daysOverdue > 0
      ? ` It's ${a.daysOverdue} day${a.daysOverdue === 1 ? '' : 's'} past the due date.`
      : '';
  const subject = `Payment for ${a.brand} — invoice follow-up`;
  const greeting = a.recipientName ? `Hi ${a.recipientName.split(' ')[0]},` : 'Hi,';
  const desc = a.description ? `\n\nThis is for: ${a.description}` : '';
  const signoff = a.senderName ? `\n\nThanks,\n${a.senderName}` : '\n\nThanks';
  const body = `${greeting}\n\nJust a quick follow-up on the ${a.currency} ${a.amount.toLocaleString()} payment from ${a.brand}, originally due ${due}.${overdueClause}${desc}\n\nCould you confirm when we can expect it?${signoff}`;
  return { subject, body, tone, partial: true };
};

export async function draftPaymentReminder(args: DraftArgs): Promise<PaymentReminderDraft> {
  try {
    const result = await callClaude<Omit<PaymentReminderDraft, 'partial'>>({
      systemPrompt: SYSTEM,
      userMessage: `Draft the reminder. Context:\n\n${JSON.stringify(args, null, 2)}`,
      maxTokens: 600,
    });
    return { ...result, partial: false };
  } catch (e) {
    if (e instanceof ClaudeError && e.status === 504) {
      console.warn('Payment reminder draft timed out — using deterministic fallback');
    } else {
      console.warn(`Payment reminder draft failed: ${(e as Error).message}`);
    }
    return FALLBACK(args);
  }
}
