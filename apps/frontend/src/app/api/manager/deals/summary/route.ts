import { NextResponse } from 'next/server';
import { prisma } from '@gitroom/frontend/lib/server/prisma';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { withErrorHandling } from '@gitroom/frontend/lib/server/api';
import { toNumber } from '@gitroom/frontend/lib/server/decimal';

export const runtime = 'nodejs';

export const GET = withErrorHandling(async () => {
  const { org } = await getAuth();
  const rows = await prisma.deal.groupBy({
    by: ['stage'],
    where: { organizationId: org.id },
    _count: { _all: true },
    _sum: { offer: true },
  });
  return NextResponse.json(
    rows.map((r) => ({
      stage: r.stage,
      count: r._count._all,
      totalOffer: toNumber(r._sum.offer),
    }))
  );
});
