import { NextRequest, NextResponse } from 'next/server';
import { PaymentStatus, PaymentReminderChannel } from '@prisma/client';
import { prisma } from '@gitroom/frontend/lib/server/prisma';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { withErrorHandling, errorResponse } from '@gitroom/frontend/lib/server/api';
import { decimalRecord } from '@gitroom/frontend/lib/server/decimal';
import { sendGmailEmail } from '@gitroom/frontend/lib/server/gmail';

export const runtime = 'nodejs';

interface ActionBody {
  action?: 'mark_invoiced' | 'mark_paid' | 'send_reminder';
  // Only used by send_reminder — caller is expected to have already drafted
  // via /draft-reminder, optionally edited, then posted the final text here.
  subject?: string;
  body?: string;
}

export const POST = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const { user, org } = await getAuth();
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as ActionBody;

    const payment = await prisma.brandCommercial.findFirst({
      where: { id, organizationId: org.id },
      include: {
        influencer: { select: { id: true, name: true, email: true } },
      },
    });
    if (!payment) return errorResponse(404, 'Payment not found');

    if (body.action === 'mark_invoiced') {
      const updated = await prisma.brandCommercial.update({
        where: { id },
        data: { paymentStatus: PaymentStatus.INVOICED, invoicedAt: new Date() },
        include: { influencer: { select: { id: true, name: true, handle: true } } },
      });
      return NextResponse.json(decimalRecord(updated));
    }

    if (body.action === 'mark_paid') {
      const updated = await prisma.brandCommercial.update({
        where: { id },
        data: { paymentStatus: PaymentStatus.PAID, paidAt: new Date() },
        include: { influencer: { select: { id: true, name: true, handle: true } } },
      });
      return NextResponse.json(decimalRecord(updated));
    }

    if (body.action === 'send_reminder') {
      const subject = body.subject?.trim();
      const text = body.body?.trim();
      if (!subject || !text) {
        return errorResponse(400, 'subject and body required for send_reminder');
      }
      const recipient = payment.influencer?.email;
      if (!recipient) {
        return errorResponse(400, 'No email on file for this payment recipient');
      }
      const ok = await sendGmailEmail(user.id, {
        to: recipient,
        subject,
        body: text,
      });
      if (!ok) {
        return errorResponse(
          502,
          'Could not send via Gmail — make sure Google is connected in Settings'
        );
      }
      await prisma.paymentReminder.create({
        data: {
          organizationId: org.id,
          brandCommercialId: payment.id,
          channel: PaymentReminderChannel.EMAIL,
          subject,
          body: text,
          sentAt: new Date(),
        },
      });
      return NextResponse.json({ ok: true, sentTo: recipient });
    }

    return errorResponse(400, 'Unknown action');
  }
);
