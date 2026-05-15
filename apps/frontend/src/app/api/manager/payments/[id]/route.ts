import { NextRequest, NextResponse } from 'next/server';
import { Prisma, PaymentStatus } from '@prisma/client';
import { prisma } from '@gitroom/frontend/lib/server/prisma';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { withErrorHandling, errorResponse } from '@gitroom/frontend/lib/server/api';
import { decimalRecord } from '@gitroom/frontend/lib/server/decimal';

export const runtime = 'nodejs';

interface UpdateBody {
  brand?: string;
  description?: string;
  amount?: number | string;
  currency?: string;
  dueAt?: string | null;
  paymentStatus?: PaymentStatus;
}

export const GET = withErrorHandling(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { org } = await getAuth();
    const { id } = await ctx.params;
    const row = await prisma.brandCommercial.findFirst({
      where: { id, organizationId: org.id },
      include: {
        influencer: { select: { id: true, name: true, handle: true, email: true } },
        deal: { select: { id: true, brand: true, stage: true } },
        reminders: { orderBy: { sentAt: 'desc' }, take: 10 },
      },
    });
    if (!row) return errorResponse(404, 'Payment not found');
    return NextResponse.json(decimalRecord(row));
  }
);

export const PUT = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const { org } = await getAuth();
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as UpdateBody;
    const row = await prisma.brandCommercial.update({
      where: { id, organizationId: org.id },
      data: {
        ...(body.brand !== undefined && { brand: body.brand }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.amount !== undefined && { amount: new Prisma.Decimal(body.amount) }),
        ...(body.currency !== undefined && { currency: body.currency }),
        ...(body.dueAt !== undefined && {
          dueAt: body.dueAt ? new Date(body.dueAt) : null,
        }),
        ...(body.paymentStatus !== undefined && { paymentStatus: body.paymentStatus }),
      },
      include: { influencer: { select: { id: true, name: true, handle: true } } },
    });
    return NextResponse.json(decimalRecord(row));
  }
);

export const DELETE = withErrorHandling(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { org } = await getAuth();
    const { id } = await ctx.params;
    await prisma.brandCommercial.delete({
      where: { id, organizationId: org.id },
    });
    return NextResponse.json({ ok: true });
  }
);
