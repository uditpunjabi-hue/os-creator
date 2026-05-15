import 'server-only';
import type { UserNotification, UserNotificationKind } from '@prisma/client';
import { prisma } from './prisma';

// User-scoped notification feed. Two kinds of items live here:
//   1. Persisted notifications (from triggers we haven't built yet — TODO).
//   2. On-demand "live alerts" derived from current DB state (deals due soon,
//      overdue payments). We sync those on every read using `link` as a
//      dedup key so we never double-create.

export interface NotificationItem {
  id: string;
  kind: UserNotificationKind;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export async function listForUser(userId: string, orgId: string): Promise<NotificationItem[]> {
  await syncLiveAlerts(userId, orgId);
  const rows = await prisma.userNotification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 40,
  });
  return rows.map(toItem);
}

function toItem(n: UserNotification): NotificationItem {
  return {
    id: n.id,
    kind: n.kind,
    title: n.title,
    body: n.body,
    link: n.link,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  };
}

export async function unreadCount(userId: string): Promise<number> {
  return prisma.userNotification.count({
    where: { userId, readAt: null },
  });
}

export async function markRead(userId: string, id: string): Promise<boolean> {
  const existing = await prisma.userNotification.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) return false;
  if (!existing.readAt) {
    await prisma.userNotification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }
  return true;
}

export async function markAllRead(userId: string): Promise<number> {
  const res = await prisma.userNotification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return res.count;
}

// ---------------------------------------------------------------------------
// Live alert sync. Called on every list read. The `link` is the natural
// dedup key — one alert per entity.
// ---------------------------------------------------------------------------

async function syncLiveAlerts(userId: string, orgId: string) {
  await Promise.allSettled([
    syncDealDeadlines(userId, orgId),
    syncOverduePayments(userId, orgId),
    syncOverdueInvoices(userId, orgId),
  ]);
}

async function syncDealDeadlines(userId: string, orgId: string) {
  const now = new Date();
  const threeDays = new Date(now.getTime() + 3 * 86_400_000);
  const deals = await prisma.deal.findMany({
    where: {
      organizationId: orgId,
      stage: { notIn: ['COMPLETED'] },
      deadline: { gte: now, lte: threeDays },
    },
    select: { id: true, brand: true, deadline: true },
  });
  for (const d of deals) {
    const link = `/manager/deals/${d.id}`;
    const exists = await prisma.userNotification.findFirst({
      where: { userId, kind: 'DEAL_DEADLINE', link },
    });
    if (exists) continue;
    const days = Math.max(0, Math.round(((d.deadline?.getTime() ?? Date.now()) - now.getTime()) / 86_400_000));
    await prisma.userNotification.create({
      data: {
        userId,
        kind: 'DEAL_DEADLINE',
        title: `${d.brand} deadline in ${days === 0 ? 'less than a day' : `${days}d`}`,
        body: `Don't forget — the ${d.brand} deal closes ${d.deadline?.toLocaleDateString() ?? 'soon'}.`,
        link,
      },
    });
  }
}

async function syncOverduePayments(userId: string, orgId: string) {
  const now = new Date();
  const overdue = await prisma.brandCommercial.findMany({
    where: {
      organizationId: orgId,
      paymentStatus: { notIn: ['PAID'] },
      dueAt: { not: null, lt: now },
    },
    select: { id: true, deal: { select: { brand: true } }, amount: true, currency: true, dueAt: true },
    take: 20,
  });
  for (const p of overdue) {
    const link = `/manager/payments?paymentId=${p.id}`;
    const exists = await prisma.userNotification.findFirst({
      where: { userId, kind: 'PAYMENT_OVERDUE', link },
    });
    if (exists) continue;
    await prisma.userNotification.create({
      data: {
        userId,
        kind: 'PAYMENT_OVERDUE',
        title: `Payment overdue from ${p.deal?.brand ?? 'a brand'}`,
        body: `${p.currency} ${Number(p.amount).toFixed(2)} was due ${p.dueAt?.toLocaleDateString() ?? 'recently'}.`,
        link,
      },
    });
  }
}

async function syncOverdueInvoices(userId: string, orgId: string) {
  const now = new Date();
  const invs = await prisma.invoice.findMany({
    where: {
      organizationId: orgId,
      status: { in: ['SENT', 'VIEWED'] },
      dueAt: { not: null, lt: now },
    },
    select: { id: true, number: true, brandName: true, total: true, currency: true, dueAt: true },
    take: 20,
  });
  for (const inv of invs) {
    const link = `/manager/invoices/${inv.id}`;
    const exists = await prisma.userNotification.findFirst({
      where: { userId, kind: 'PAYMENT_OVERDUE', link },
    });
    if (exists) continue;
    await prisma.userNotification.create({
      data: {
        userId,
        kind: 'PAYMENT_OVERDUE',
        title: `${inv.number} overdue — ${inv.brandName}`,
        body: `${inv.currency} ${Number(inv.total).toFixed(2)} due ${inv.dueAt?.toLocaleDateString() ?? ''}.`,
        link,
      },
    });
  }
  // Flip status to OVERDUE on read — keeps the list page consistent.
  await prisma.invoice.updateMany({
    where: {
      organizationId: orgId,
      status: { in: ['SENT', 'VIEWED'] },
      dueAt: { not: null, lt: now },
    },
    data: { status: 'OVERDUE' },
  });
}

// Generic helper for downstream features that want to enqueue a notification.
export async function notify(userId: string, args: {
  kind: UserNotificationKind;
  title: string;
  body?: string;
  link?: string;
}): Promise<UserNotification> {
  return prisma.userNotification.create({
    data: {
      userId,
      kind: args.kind,
      title: args.title.slice(0, 200),
      body: args.body?.slice(0, 500) ?? null,
      link: args.link?.slice(0, 400) ?? null,
    },
  });
}
