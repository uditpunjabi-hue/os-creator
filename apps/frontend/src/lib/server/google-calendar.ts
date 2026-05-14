import 'server-only';
import { memoryCache } from './memory-cache';
import { getGoogleTokenForOrg } from './google-token';

const CAL_BASE = 'https://www.googleapis.com/calendar/v3';
const CACHE_TTL_SECONDS = 5 * 60;
const LIST_CACHE_KEY = (orgId: string, fromIso: string, toIso: string) =>
  `gcal:list:${orgId}:${fromIso}:${toIso}`;

interface GcalEvent {
  id: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

export type CalendarEventKind =
  | 'BRAND_CALL'
  | 'POST_SCHEDULED'
  | 'DEAL_DEADLINE'
  | 'CONTRACT_EXPIRES';

export interface CalendarEvent {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  kind: CalendarEventKind;
  description?: string;
}

export interface CreateCalendarEventInput {
  title: string;
  startsAt: string;
  endsAt: string;
  kind?: CalendarEventKind;
  description?: string;
}

export async function listCalendarEvents(
  orgId: string,
  fromIso: string,
  toIso: string
): Promise<CalendarEvent[]> {
  const conn = await getGoogleTokenForOrg(orgId);
  if (!conn) return [];

  const cacheKey = LIST_CACHE_KEY(orgId, fromIso, toIso);
  const cached = memoryCache.get<CalendarEvent[]>(cacheKey);
  if (cached) return cached;

  try {
    const url = new URL(`${CAL_BASE}/calendars/primary/events`);
    url.searchParams.set('timeMin', fromIso);
    url.searchParams.set('timeMax', toIso);
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('maxResults', '50');

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${conn.token}` },
    });
    if (!res.ok) {
      console.warn(`Calendar list failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
      return [];
    }
    const payload = (await res.json()) as { items?: GcalEvent[] };
    const events: CalendarEvent[] = (payload.items ?? [])
      .filter((e) => !!(e.start?.dateTime ?? e.start?.date))
      .map((e) => ({
        id: e.id,
        title: e.summary ?? '(untitled)',
        startsAt: e.start!.dateTime ?? `${e.start!.date}T00:00:00Z`,
        endsAt: e.end?.dateTime ?? `${e.end?.date ?? e.start!.date}T23:59:59Z`,
        kind: 'BRAND_CALL',
        description: e.description,
      }));
    memoryCache.set(cacheKey, events, CACHE_TTL_SECONDS);
    return events;
  } catch (e) {
    console.error(`Calendar listEvents crashed: ${(e as Error).message}`);
    return [];
  }
}

export async function createCalendarEvent(
  orgId: string,
  body: CreateCalendarEventInput
): Promise<CalendarEvent> {
  const conn = await getGoogleTokenForOrg(orgId);
  if (!conn) throw new Error('Google Calendar not connected for this org.');

  const res = await fetch(`${CAL_BASE}/calendars/primary/events`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${conn.token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      summary: body.title,
      description: body.description,
      start: { dateTime: body.startsAt },
      end: { dateTime: body.endsAt },
    }),
  });
  if (!res.ok) {
    throw new Error(`Calendar insert failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
  const created = (await res.json()) as GcalEvent;
  memoryCache.delPattern(`gcal:list:${orgId}:*`);
  return {
    id: created.id,
    title: created.summary ?? body.title,
    startsAt: created.start?.dateTime ?? body.startsAt,
    endsAt: created.end?.dateTime ?? body.endsAt,
    kind: body.kind ?? 'BRAND_CALL',
    description: created.description,
  };
}

export async function deleteCalendarEvent(orgId: string, eventId: string) {
  const conn = await getGoogleTokenForOrg(orgId);
  if (!conn) return { ok: false };

  try {
    const res = await fetch(`${CAL_BASE}/calendars/primary/events/${eventId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${conn.token}` },
    });
    const ok = res.ok || res.status === 410;
    memoryCache.delPattern(`gcal:list:${orgId}:*`);
    return { ok };
  } catch (e) {
    console.warn(`Calendar delete crashed: ${(e as Error).message}`);
    return { ok: false };
  }
}
