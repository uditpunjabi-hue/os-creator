import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import {
  listCalendarEvents,
  createCalendarEvent,
  type CalendarEventKind,
} from '@gitroom/frontend/lib/server/google-calendar';
import { withErrorHandling, errorResponse } from '@gitroom/frontend/lib/server/api';

export const runtime = 'nodejs';

const KINDS: CalendarEventKind[] = ['BRAND_CALL', 'POST_SCHEDULED', 'DEAL_DEADLINE', 'CONTRACT_EXPIRES'];

export const GET = withErrorHandling(async (req: NextRequest) => {
  const { org } = await getAuth();
  const from = req.nextUrl.searchParams.get('from');
  const to = req.nextUrl.searchParams.get('to');
  const fromIso = from || new Date(Date.now() - 7 * 86400_000).toISOString();
  const toIso = to || new Date(Date.now() + 60 * 86400_000).toISOString();
  const events = await listCalendarEvents(org.id, fromIso, toIso);
  return NextResponse.json(events);
});

interface CreateEventBody {
  title?: string;
  startsAt?: string;
  endsAt?: string;
  kind?: CalendarEventKind;
  description?: string;
}

export const POST = withErrorHandling(async (req: NextRequest) => {
  const { org } = await getAuth();
  const body = (await req.json().catch(() => ({}))) as CreateEventBody;
  if (!body.title) return errorResponse(400, 'title required');
  if (!body.startsAt) return errorResponse(400, 'startsAt required');
  if (!body.endsAt) return errorResponse(400, 'endsAt required');
  if (body.kind && !KINDS.includes(body.kind)) {
    return errorResponse(400, `kind must be one of ${KINDS.join(', ')}`);
  }
  const event = await createCalendarEvent(org.id, {
    title: body.title,
    startsAt: body.startsAt,
    endsAt: body.endsAt,
    kind: body.kind,
    description: body.description,
  });
  return NextResponse.json(event);
});
