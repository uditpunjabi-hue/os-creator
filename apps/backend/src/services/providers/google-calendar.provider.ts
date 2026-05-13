import { Injectable, Logger } from '@nestjs/common';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';
import { GoogleTokenService } from '@gitroom/backend/services/google/google-token.service';
import type {
  CalendarEvent,
  CalendarProvider,
  CreateCalendarEventInput,
} from '@gitroom/backend/services/providers/calendar.provider';

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

@Injectable()
export class GoogleCalendarProvider implements CalendarProvider {
  private readonly logger = new Logger(GoogleCalendarProvider.name);

  constructor(private googleToken: GoogleTokenService) {}

  async listEvents(orgId: string, fromIso: string, toIso: string): Promise<CalendarEvent[]> {
    const conn = await this.googleToken.getValidAccessTokenForOrg(orgId);
    if (!conn) return [];

    const cacheKey = LIST_CACHE_KEY(orgId, fromIso, toIso);
    try {
      const cached = await ioRedis.get(cacheKey);
      if (cached) return JSON.parse(cached) as CalendarEvent[];
    } catch {}

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
        this.logger.warn(
          `Calendar list failed (${res.status}): ${(await res.text()).slice(0, 200)}`
        );
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
          kind: 'BRAND_CALL', // Google doesn't carry our kind enum — default and let UI infer
          description: e.description,
        }));

      try {
        await ioRedis.set(cacheKey, JSON.stringify(events), 'EX', CACHE_TTL_SECONDS);
      } catch {}
      return events;
    } catch (e) {
      this.logger.error(`Calendar listEvents crashed: ${(e as Error).message}`);
      return [];
    }
  }

  async createEvent(orgId: string, body: CreateCalendarEventInput): Promise<CalendarEvent> {
    const conn = await this.googleToken.getValidAccessTokenForOrg(orgId);
    if (!conn) {
      throw new Error('Google Calendar not connected for this org.');
    }

    try {
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

      // Bust the list cache for this org.
      try {
        const keys = await ioRedis.keys(`gcal:list:${orgId}:*`);
        if (keys.length) await ioRedis.del(...keys);
      } catch {}

      return {
        id: created.id,
        title: created.summary ?? body.title,
        startsAt: created.start?.dateTime ?? body.startsAt,
        endsAt: created.end?.dateTime ?? body.endsAt,
        kind: body.kind ?? 'BRAND_CALL',
        description: created.description,
      };
    } catch (e) {
      this.logger.error(`Calendar createEvent crashed: ${(e as Error).message}`);
      throw e;
    }
  }

  async deleteEvent(orgId: string, eventId: string) {
    const conn = await this.googleToken.getValidAccessTokenForOrg(orgId);
    if (!conn) return { ok: false };

    try {
      const res = await fetch(`${CAL_BASE}/calendars/primary/events/${eventId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${conn.token}` },
      });
      const ok = res.ok || res.status === 410; // 410 = already gone, treat as success
      try {
        const keys = await ioRedis.keys(`gcal:list:${orgId}:*`);
        if (keys.length) await ioRedis.del(...keys);
      } catch {}
      return { ok };
    } catch (e) {
      this.logger.warn(`Calendar delete crashed: ${(e as Error).message}`);
      return { ok: false };
    }
  }
}
