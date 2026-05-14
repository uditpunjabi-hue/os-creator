import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@gitroom/frontend/lib/server/prisma';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { withErrorHandling } from '@gitroom/frontend/lib/server/api';
import { listCalendarEvents } from '@gitroom/frontend/lib/server/google-calendar';

export const runtime = 'nodejs';

/**
 * Schedule aggregation for the calendar UI.
 *
 *  ?from=YYYY-MM-DD&to=YYYY-MM-DD  → all dotted entries for that window:
 *    - scheduled posts (purple)
 *    - Google Calendar events (blue)
 *    - deal deadlines (gold)
 *
 * Defaults to the current month ±1 week padding (so the calendar can render
 * leading/trailing days of adjacent months without re-fetching).
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  const { org } = await getAuth();
  const url = req.nextUrl;
  const fromParam = url.searchParams.get('from');
  const toParam = url.searchParams.get('to');

  const now = new Date();
  const from = fromParam
    ? new Date(`${fromParam}T00:00:00.000Z`)
    : startOfMonth(now, -7);
  const to = toParam
    ? new Date(`${toParam}T23:59:59.999Z`)
    : endOfMonth(now, 7);

  const [posts, deals] = await Promise.all([
    prisma.scheduledPost.findMany({
      where: {
        organizationId: org.id,
        scheduledAt: { gte: from, lte: to },
      },
      orderBy: { scheduledAt: 'asc' },
    }),
    prisma.deal.findMany({
      where: {
        organizationId: org.id,
        deadline: { not: null, gte: from, lte: to },
        stage: { notIn: ['COMPLETED'] },
      },
      orderBy: { deadline: 'asc' },
    }),
  ]);

  // Calendar may not be connected — listCalendarEvents returns [] in that case.
  const events = await listCalendarEvents(org.id, from.toISOString(), to.toISOString());

  return NextResponse.json({
    posts: posts.map((p) => ({
      id: p.id,
      caption: p.caption,
      kind: p.kind,
      status: p.status,
      platforms: p.platforms ?? [],
      scheduledAt: p.scheduledAt.toISOString(),
      publishedAt: p.publishedAt?.toISOString() ?? null,
      error: p.error,
    })),
    events: events.map((e) => ({
      id: e.id,
      title: e.title,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      kind: e.kind,
    })),
    deadlines: deals.map((d) => ({
      id: d.id,
      brand: d.brand,
      offer: Number(d.offer),
      deadline: d.deadline?.toISOString() ?? null,
      stage: d.stage,
    })),
    range: { from: from.toISOString(), to: to.toISOString() },
  });
});

function startOfMonth(d: Date, padDays = 0): Date {
  const out = new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1));
  out.setUTCDate(out.getUTCDate() - padDays);
  out.setUTCHours(0, 0, 0, 0);
  return out;
}

function endOfMonth(d: Date, padDays = 0): Date {
  const out = new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 0));
  out.setUTCDate(out.getUTCDate() + padDays);
  out.setUTCHours(23, 59, 59, 999);
  return out;
}
