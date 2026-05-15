import { NextResponse } from 'next/server';
import { prisma } from '@gitroom/frontend/lib/server/prisma';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { withErrorHandling, errorResponse } from '@gitroom/frontend/lib/server/api';
import { draftPaymentReminder } from '@gitroom/frontend/lib/server/payment-reminder';

export const runtime = 'nodejs';

/**
 * AI-drafted payment reminder. Returns subject + body for the UI to show in a
 * review modal — the actual send happens via /action with `action=send_reminder`
 * and the (possibly edited) draft in the body. Split keeps the LLM call out of
 * the send path so a Claude timeout never blocks the user from emailing.
 */
export const POST = withErrorHandling(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { user, org } = await getAuth();
    const { id } = await ctx.params;
    const payment = await prisma.brandCommercial.findFirst({
      where: { id, organizationId: org.id },
      include: {
        influencer: { select: { name: true, handle: true, email: true } },
        reminders: { select: { id: true }, take: 1 },
      },
    });
    if (!payment) return errorResponse(404, 'Payment not found');

    const dueDate = payment.dueAt;
    const daysOverdue = dueDate
      ? Math.max(0, Math.floor((Date.now() - dueDate.getTime()) / 86_400_000))
      : 0;

    const draft = await draftPaymentReminder({
      brand: payment.brand,
      amount: Number(payment.amount),
      currency: payment.currency,
      dueDate: dueDate?.toISOString() ?? null,
      daysOverdue,
      description: payment.description,
      recipientName: payment.influencer?.name ?? null,
      senderName:
        [user.name, user.lastName].filter(Boolean).join(' ').trim() || null,
      isFirstReminder: payment.reminders.length === 0,
    });

    return NextResponse.json(draft);
  }
);
