import { NextRequest, NextResponse } from 'next/server';
import { Prisma, PaymentStatus } from '@prisma/client';
import { prisma } from '@gitroom/frontend/lib/server/prisma';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { withErrorHandling, errorResponse } from '@gitroom/frontend/lib/server/api';
import { decimalRecord } from '@gitroom/frontend/lib/server/decimal';

export const runtime = 'nodejs';

interface CreateBody {
  influencerId?: string;
  dealId?: string | null;
  brand?: string;
  description?: string;
  amount?: number | string;
  currency?: string;
  dueAt?: string | null;
  paymentStatus?: PaymentStatus;
}

export const GET = withErrorHandling(async () => {
  const { org } = await getAuth();
  const rows = await prisma.brandCommercial.findMany({
    where: { organizationId: org.id },
    include: { influencer: { select: { id: true, name: true, handle: true } } },
    orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
  });
  return NextResponse.json(rows.map(decimalRecord));
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const { org } = await getAuth();
  const body = (await req.json().catch(() => ({}))) as CreateBody;
  if (!body.influencerId) return errorResponse(400, 'influencerId required');
  if (!body.brand) return errorResponse(400, 'brand required');
  if (body.amount === undefined || body.amount === null) return errorResponse(400, 'amount required');

  const row = await prisma.brandCommercial.create({
    data: {
      organizationId: org.id,
      influencerId: body.influencerId,
      dealId: body.dealId ?? undefined,
      brand: body.brand,
      description: body.description,
      amount: new Prisma.Decimal(body.amount),
      currency: body.currency ?? 'USD',
      dueAt: body.dueAt ? new Date(body.dueAt) : null,
      paymentStatus: body.paymentStatus ?? PaymentStatus.PENDING,
    },
    include: { influencer: { select: { id: true, name: true, handle: true } } },
  });
  return NextResponse.json(decimalRecord(row));
});
