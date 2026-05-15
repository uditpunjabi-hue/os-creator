import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@gitroom/frontend/lib/server/prisma';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { withErrorHandling } from '@gitroom/frontend/lib/server/api';
import { decimalRecord } from '@gitroom/frontend/lib/server/decimal';

export const runtime = 'nodejs';

interface RateBody {
  reelRate?: number | string | null;
  storyRate?: number | string | null;
  carouselRate?: number | string | null;
  // Public field names from the brief — Bundle ↔ brandIntegRate, Post ↔ ugcRate.
  bundleRate?: number | string | null;
  postRate?: number | string | null;
  brandIntegRate?: number | string | null;
  ugcRate?: number | string | null;
  exclusivityRate?: number | string | null;
  currency?: string;
  notes?: string;
}

function toDecimal(v: number | string | null | undefined) {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  return new Prisma.Decimal(v);
}

export const GET = withErrorHandling(async () => {
  const { org } = await getAuth();
  const row = await prisma.rateCard.findUnique({
    where: { organizationId: org.id },
  });
  if (!row) {
    return NextResponse.json({
      reelRate: null,
      storyRate: null,
      carouselRate: null,
      ugcRate: null,
      brandIntegRate: null,
      exclusivityRate: null,
      currency: 'INR',
      notes: null,
      updatedAt: null,
    });
  }
  return NextResponse.json(decimalRecord(row));
});

// PUT upserts — there's always exactly one rate card per org. Fields not
// present in the body are left as-is; explicit `null` clears a field.
export const PUT = withErrorHandling(async (req: NextRequest) => {
  const { org } = await getAuth();
  const body = (await req.json().catch(() => ({}))) as RateBody;

  // Map the public "bundle/post" labels to the underlying columns.
  const reel = toDecimal(body.reelRate);
  const story = toDecimal(body.storyRate);
  const carousel = toDecimal(body.carouselRate);
  const post = toDecimal(body.postRate ?? body.ugcRate);
  const bundle = toDecimal(body.bundleRate ?? body.brandIntegRate);
  const exclusivity = toDecimal(body.exclusivityRate);

  const upserted = await prisma.rateCard.upsert({
    where: { organizationId: org.id },
    update: {
      ...(reel !== undefined && { reelRate: reel }),
      ...(story !== undefined && { storyRate: story }),
      ...(carousel !== undefined && { carouselRate: carousel }),
      ...(post !== undefined && { ugcRate: post }),
      ...(bundle !== undefined && { brandIntegRate: bundle }),
      ...(exclusivity !== undefined && { exclusivityRate: exclusivity }),
      ...(body.currency && { currency: body.currency }),
      ...(body.notes !== undefined && { notes: body.notes }),
    },
    create: {
      organizationId: org.id,
      reelRate: reel ?? null,
      storyRate: story ?? null,
      carouselRate: carousel ?? null,
      ugcRate: post ?? null,
      brandIntegRate: bundle ?? null,
      exclusivityRate: exclusivity ?? null,
      currency: body.currency ?? 'INR',
      notes: body.notes,
    },
  });
  return NextResponse.json(decimalRecord(upserted));
});
