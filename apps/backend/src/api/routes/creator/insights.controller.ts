import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { InstagramInsightsService } from '@gitroom/backend/services/instagram/instagram.insights.service';
import { InstagramAiInsightsService } from '@gitroom/backend/services/instagram/instagram.ai.insights.service';

@ApiTags('Creator')
@Controller('/creator')
export class CreatorInsightsController {
  constructor(
    private insights: InstagramInsightsService,
    private aiInsights: InstagramAiInsightsService
  ) {}

  /** Computed (non-AI) insights — content type perf, best times, follower trend. */
  @Get('/insights')
  get(
    @GetOrgFromRequest() org: Organization,
    @Query('tz') tz?: string
  ) {
    const offset = tz ? parseInt(tz, 10) : 330; // default IST since seed user is in Mumbai
    return this.insights.getInsights(org.id, Number.isFinite(offset) ? offset : 330);
  }

  /**
   * AI-powered Content DNA + Growth Opportunities + Audience Pulse + Content
   * Gaps. Cached in Redis for 30 minutes per org. Pass ?refresh=1 to force.
   */
  @Get('/ai-insights')
  ai(
    @GetOrgFromRequest() org: Organization,
    @Query('refresh') refresh?: string
  ) {
    return this.aiInsights.getAiInsights(org.id, refresh === '1');
  }
}
