import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { InstagramInsightsService } from '@gitroom/backend/services/instagram/instagram.insights.service';

@ApiTags('Creator')
@Controller('/creator/insights')
export class CreatorInsightsController {
  constructor(private insights: InstagramInsightsService) {}

  @Get('/')
  get(
    @GetOrgFromRequest() org: Organization,
    @Query('tz') tz?: string
  ) {
    const offset = tz ? parseInt(tz, 10) : 330; // default IST since seed user is in Mumbai
    return this.insights.getInsights(org.id, Number.isFinite(offset) ? offset : 330);
  }
}
