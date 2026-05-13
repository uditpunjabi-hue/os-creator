import { Injectable } from '@nestjs/common';

export interface CalendarEvent {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  kind: 'BRAND_CALL' | 'POST_SCHEDULED' | 'DEAL_DEADLINE' | 'CONTRACT_EXPIRES';
  description?: string;
}

export interface CreateCalendarEventInput {
  title: string;
  startsAt: string;
  endsAt: string;
  kind?: CalendarEvent['kind'];
  description?: string;
}

export interface CalendarProvider {
  listEvents(orgId: string, fromIso: string, toIso: string): Promise<CalendarEvent[]>;
  createEvent(orgId: string, body: CreateCalendarEventInput): Promise<CalendarEvent>;
  deleteEvent(orgId: string, eventId: string): Promise<{ ok: boolean }>;
}

@Injectable()
export class MockCalendarProvider implements CalendarProvider {
  private readonly eventsByOrg = new Map<string, CalendarEvent[]>();

  private getOrSeed(orgId: string): CalendarEvent[] {
    if (!this.eventsByOrg.has(orgId)) {
      const now = Date.now();
      const inDays = (d: number, h = 10) =>
        new Date(now + d * 86400_000 + h * 3600_000).toISOString();
      this.eventsByOrg.set(orgId, [
        {
          id: 'ev-1',
          title: 'Bloom & Co. discovery call',
          kind: 'BRAND_CALL',
          startsAt: inDays(1, 16),
          endsAt: inDays(1, 17),
          description: 'Walk through campaign scope + rate.',
        },
        {
          id: 'ev-2',
          title: 'Reel goes live — Swift Athletics x Kira',
          kind: 'POST_SCHEDULED',
          startsAt: inDays(2, 18),
          endsAt: inDays(2, 18, ),
        },
        {
          id: 'ev-3',
          title: 'Nimbus contract response due',
          kind: 'DEAL_DEADLINE',
          startsAt: inDays(4, 17),
          endsAt: inDays(4, 17),
        },
        {
          id: 'ev-4',
          title: 'BrandLab agreement expires',
          kind: 'CONTRACT_EXPIRES',
          startsAt: inDays(28, 9),
          endsAt: inDays(28, 9),
        },
      ]);
    }
    return this.eventsByOrg.get(orgId)!;
  }

  async listEvents(orgId: string, fromIso: string, toIso: string): Promise<CalendarEvent[]> {
    const from = new Date(fromIso).getTime();
    const to = new Date(toIso).getTime();
    return this.getOrSeed(orgId).filter((e) => {
      const start = new Date(e.startsAt).getTime();
      return start >= from && start <= to;
    });
  }

  async createEvent(orgId: string, body: CreateCalendarEventInput): Promise<CalendarEvent> {
    const event: CalendarEvent = {
      id: `ev-${Date.now()}`,
      title: body.title,
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      kind: body.kind ?? 'BRAND_CALL',
      description: body.description,
    };
    this.getOrSeed(orgId).push(event);
    return event;
  }

  async deleteEvent(orgId: string, eventId: string) {
    const list = this.getOrSeed(orgId);
    const idx = list.findIndex((e) => e.id === eventId);
    if (idx >= 0) list.splice(idx, 1);
    return { ok: idx >= 0 };
  }
}

export const CALENDAR_PROVIDER_TOKEN = 'CALENDAR_PROVIDER';
