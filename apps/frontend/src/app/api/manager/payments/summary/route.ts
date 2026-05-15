import { NextResponse } from 'next/server';
import { PaymentStatus } from '@prisma/client';
import { prisma } from '@gitroom/frontend/lib/server/prisma';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { withErrorHandling } from '@gitroom/frontend/lib/server/api';

export const runtime = 'nodejs';

// Returns the rolled-up totals the Payments header cards need: pending,
// overdue, paid, plus per-status breakdown with counts. Overdue is computed
// from dueAt < now AND status != PAID — handles rows that were never flipped
// from PENDING to OVERDUE.
export const GET = withErrorHandling(async () => {
  const { org } = await getAuth();
  const rows = await prisma.brandCommercial.findMany({
    where: { organizationId: org.id },
    select: { amount: true, paymentStatus: true, dueAt: true, paidAt: true },
  });

  const counts: Record<string, { amount: number; count: number }> = {
    PENDING: { amount: 0, count: 0 },
    INVOICED: { amount: 0, count: 0 },
    PAID: { amount: 0, count: 0 },
    OVERDUE: { amount: 0, count: 0 },
  };
  const now = Date.now();
  let pending = 0;
  let overdue = 0;
  let paid = 0;

  for (const r of rows) {
    const amt = Number(r.amount);
    const isOverdue =
      r.paymentStatus !== PaymentStatus.PAID &&
      !!r.dueAt &&
      r.dueAt.getTime() < now;
    const bucket = isOverdue ? 'OVERDUE' : r.paymentStatus;
    counts[bucket].amount += amt;
    counts[bucket].count += 1;
    if (r.paymentStatus === PaymentStatus.PAID) paid += amt;
    else if (isOverdue) overdue += amt;
    else pending += amt;
  }
  return NextResponse.json({ pending, overdue, paid, counts });
});
