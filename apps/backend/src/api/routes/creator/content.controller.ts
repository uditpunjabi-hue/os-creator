import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsArray, IsDateString, IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { Organization } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import {
  CALENDAR_PROVIDER_TOKEN,
  type CalendarProvider,
} from '@gitroom/backend/services/providers/calendar.provider';

class SchedulePostDto {
  @IsString() @MaxLength(120) influencerName: string;
  @IsString() @MaxLength(4000) caption: string;
  @IsIn(['IMAGE', 'CAROUSEL', 'REEL', 'STORY']) kind: 'IMAGE' | 'CAROUSEL' | 'REEL' | 'STORY';
  @IsArray() @IsString({ each: true }) platforms: string[];
  @IsDateString() scheduledAt: string;
}

/**
 * Creator-side endpoints backed by the database. /creator/scripts already
 * lives in its own controller; this one carries the other two listings
 * (content pieces from the filming workflow, scheduled posts) plus a unified
 * "creator schedule" view that merges DB-backed scheduled posts with real
 * Google Calendar events.
 */
@ApiTags('Creator')
@Controller('/creator')
export class CreatorContentController {
  constructor(
    private prisma: PrismaService,
    @Inject(CALENDAR_PROVIDER_TOKEN) private calendar: CalendarProvider
  ) {}

  // ── Filming workflow ──────────────────────────────────────────────────
  @Get('/content-pieces')
  async listContentPieces(@GetOrgFromRequest() org: Organization) {
    return this.prisma.contentPiece.findMany({
      where: { organizationId: org.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        script: { select: { id: true, title: true } },
      },
    });
  }

  // ── Schedule (DB-backed scheduled posts) ──────────────────────────────
  @Get('/schedule/posts')
  async listScheduledPosts(@GetOrgFromRequest() org: Organization) {
    return this.prisma.scheduledPost.findMany({
      where: { organizationId: org.id },
      orderBy: { scheduledAt: 'asc' },
      include: {
        influencer: { select: { id: true, name: true, handle: true } },
      },
    });
  }

  @Post('/schedule/posts')
  async createScheduledPost(
    @GetOrgFromRequest() org: Organization,
    @Body() body: SchedulePostDto
  ) {
    // Use the seeded self-influencer when not provided; this matches the
    // single-creator demo flow where every post is the creator's own.
    const influencer = await this.prisma.influencer.findFirst({
      where: { organizationId: org.id },
      orderBy: { createdAt: 'asc' },
    });
    if (!influencer) throw new Error('No influencer for this org');

    const post = await this.prisma.scheduledPost.create({
      data: {
        organizationId: org.id,
        influencerId: influencer.id,
        caption: body.caption,
        kind: body.kind as any,
        platforms: body.platforms,
        scheduledAt: new Date(body.scheduledAt),
        status: 'SCHEDULED',
      },
      include: { influencer: { select: { id: true, name: true, handle: true } } },
    });

    // Best-effort: mirror to Google Calendar if connected. Not fatal.
    try {
      const start = new Date(body.scheduledAt);
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      await this.calendar.createEvent(org.id, {
        title: `📱 ${body.kind} · ${body.caption.slice(0, 60)}`,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        kind: 'POST_SCHEDULED',
        description: body.caption,
      });
    } catch {
      /* calendar not connected — silently OK */
    }

    return post;
  }

  // ── Unified schedule view (DB posts + real Google Calendar events) ─────
  // Returns merged items, colour-coded by source on the frontend:
  //   posts  → from ScheduledPost rows
  //   events → from Google Calendar /events (only when Google connected)
  @Get('/schedule')
  async unified(
    @GetOrgFromRequest() org: Organization,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    const fromIso = from || new Date(Date.now() - 7 * 86400_000).toISOString();
    const toIso = to || new Date(Date.now() + 60 * 86400_000).toISOString();

    const [posts, events] = await Promise.all([
      this.prisma.scheduledPost.findMany({
        where: {
          organizationId: org.id,
          scheduledAt: { gte: new Date(fromIso), lte: new Date(toIso) },
        },
        orderBy: { scheduledAt: 'asc' },
        include: { influencer: { select: { id: true, name: true, handle: true } } },
      }),
      this.calendar.listEvents(org.id, fromIso, toIso).catch(() => []),
    ]);

    return { posts, events };
  }
}
