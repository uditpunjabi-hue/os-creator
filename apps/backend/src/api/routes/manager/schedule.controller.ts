import { Body, Controller, Delete, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsArray, IsDateString, IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { Organization } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import {
  CALENDAR_PROVIDER_TOKEN,
  type CalendarProvider,
} from '@gitroom/backend/services/providers/calendar.provider';
import {
  PUBLISHING_PROVIDER_TOKEN,
  type PublishingProvider,
  type PostKind,
  type Platform,
} from '@gitroom/backend/services/providers/publishing.provider';

class CreateEventDto {
  @IsString() @MinLength(1) @MaxLength(200) title: string;
  @IsDateString() startsAt: string;
  @IsDateString() endsAt: string;
  @IsIn(['BRAND_CALL', 'POST_SCHEDULED', 'DEAL_DEADLINE', 'CONTRACT_EXPIRES'])
  kind?: 'BRAND_CALL' | 'POST_SCHEDULED' | 'DEAL_DEADLINE' | 'CONTRACT_EXPIRES';
  @IsString() @MaxLength(2000) description?: string;
}

class SchedulePostDto {
  @IsString() influencerId: string;
  @IsString() @MaxLength(120) influencerName: string;
  @IsString() @MaxLength(4000) caption: string;
  @IsIn(['IMAGE', 'CAROUSEL', 'REEL', 'STORY']) kind: PostKind;
  @IsArray() @IsIn(['instagram', 'tiktok', 'youtube', 'linkedin', 'x'], { each: true })
  platforms: Platform[];
  @IsDateString() scheduledAt: string;
}

@ApiTags('Manager')
@Controller('/manager/schedule')
export class ScheduleController {
  constructor(
    @Inject(CALENDAR_PROVIDER_TOKEN) private calendar: CalendarProvider,
    @Inject(PUBLISHING_PROVIDER_TOKEN) private publishing: PublishingProvider
  ) {}

  @Get('/events')
  events(
    @GetOrgFromRequest() org: Organization,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    const fromIso = from || new Date(Date.now() - 7 * 86400_000).toISOString();
    const toIso = to || new Date(Date.now() + 60 * 86400_000).toISOString();
    return this.calendar.listEvents(org.id, fromIso, toIso);
  }

  @Post('/events')
  createEvent(@GetOrgFromRequest() org: Organization, @Body() body: CreateEventDto) {
    return this.calendar.createEvent(org.id, body);
  }

  @Delete('/events/:id')
  deleteEvent(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    return this.calendar.deleteEvent(org.id, id);
  }

  @Get('/posts')
  posts(@GetOrgFromRequest() org: Organization) {
    return this.publishing.listPosts(org.id);
  }

  @Post('/posts')
  schedulePost(@GetOrgFromRequest() org: Organization, @Body() body: SchedulePostDto) {
    return this.publishing.schedulePost(org.id, body);
  }

  @Delete('/posts/:id')
  deletePost(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    return this.publishing.deletePost(org.id, id);
  }
}
