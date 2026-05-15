import { NextResponse } from 'next/server';
import { prisma } from '@gitroom/frontend/lib/server/prisma';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { withErrorHandling, errorResponse } from '@gitroom/frontend/lib/server/api';
import { adviseOnDeal } from '@gitroom/frontend/lib/server/deal-advisor';

export const runtime = 'nodejs';

/**
 * AI deal advisor — scores the deal, suggests a counter-offer, flags risks,
 * and proposes negotiation points beyond price. Uses the org's rate card and
 * the last 5 closed deals for the same influencer-tier as benchmarks.
 *
 * The call is fire-and-forget from the UI's perspective: a 10s Claude timeout
 * falls back to a deterministic recommendation so the button never hangs.
 */
export const POST = withErrorHandling(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { org } = await getAuth();
    const { id } = await ctx.params;

    const deal = await prisma.deal.findFirst({
      where: { id, organizationId: org.id },
      include: { influencer: true },
    });
    if (!deal) return errorResponse(404, 'Deal not found');

    const rateCard = await prisma.rateCard.findUnique({
      where: { organizationId: org.id },
    });

    // Similar = same-platform deals in COMPLETED stage, sorted by amount —
    // small sample is fine because the advisor is grounding, not statistics.
    const similar = await prisma.deal.findMany({
      where: {
        organizationId: org.id,
        stage: 'COMPLETED',
        id: { not: deal.id },
        influencer: { platform: deal.influencer.platform },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: { brand: true, offer: true, stage: true, updatedAt: true },
    });

    const advice = await adviseOnDeal({
      brand: deal.brand,
      offer: Number(deal.offer),
      floor: deal.floor != null ? Number(deal.floor) : null,
      ceiling: deal.ceiling != null ? Number(deal.ceiling) : null,
      currency: 'INR',
      influencer: {
        name: deal.influencer.name,
        handle: deal.influencer.handle,
        followers: deal.influencer.followers,
        engagement: deal.influencer.engagement,
      },
      notes: deal.notes,
      rateCard: rateCard
        ? {
            reelRate: rateCard.reelRate != null ? Number(rateCard.reelRate) : null,
            storyRate: rateCard.storyRate != null ? Number(rateCard.storyRate) : null,
            carouselRate:
              rateCard.carouselRate != null ? Number(rateCard.carouselRate) : null,
            ugcRate: rateCard.ugcRate != null ? Number(rateCard.ugcRate) : null,
            brandIntegRate:
              rateCard.brandIntegRate != null ? Number(rateCard.brandIntegRate) : null,
            exclusivityRate:
              rateCard.exclusivityRate != null ? Number(rateCard.exclusivityRate) : null,
          }
        : null,
      similarDeals: similar.map((d) => ({
        brand: d.brand,
        offer: Number(d.offer),
        stage: d.stage,
        closedAt: d.updatedAt.toISOString(),
      })),
    });

    return NextResponse.json(advice);
  }
);
