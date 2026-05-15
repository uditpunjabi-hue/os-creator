import { NextRequest, NextResponse } from 'next/server';
import type { BrandContactStatus } from '@prisma/client';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { withErrorHandling, errorResponse } from '@gitroom/frontend/lib/server/api';
import { getBrandDetail, updateBrand, deleteBrand } from '@gitroom/frontend/lib/server/brand-crm';

export const runtime = 'nodejs';
export const maxDuration = 60;

const ALLOWED_STATUS: BrandContactStatus[] = ['NEW', 'ACTIVE', 'DORMANT', 'CHURNED'];

export const GET = withErrorHandling(
  async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const { user, org } = await getAuth();
    const { id } = await ctx.params;
    const detail = await getBrandDetail(user.id, org.id, id);
    if (!detail) return errorResponse(404, 'brand not found');
    return NextResponse.json(detail);
  }
);

export const PATCH = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const { org } = await getAuth();
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const patch: Parameters<typeof updateBrand>[2] = {};
    if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim();
    if (body.industry !== undefined) patch.industry = (body.industry as string)?.trim() || null;
    if (body.contactName !== undefined) patch.contactName = (body.contactName as string)?.trim() || null;
    if (body.contactEmail !== undefined) patch.contactEmail = (body.contactEmail as string)?.trim().toLowerCase() || null;
    if (body.notes !== undefined) patch.notes = (body.notes as string)?.trim() || null;
    if (typeof body.status === 'string' && ALLOWED_STATUS.includes(body.status as BrandContactStatus)) {
      patch.status = body.status as BrandContactStatus;
    }
    const updated = await updateBrand(org.id, id, patch);
    if (!updated) return errorResponse(404, 'brand not found');
    return NextResponse.json(updated);
  }
);

export const DELETE = withErrorHandling(
  async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const { org } = await getAuth();
    const { id } = await ctx.params;
    const ok = await deleteBrand(org.id, id);
    if (!ok) return errorResponse(404, 'brand not found');
    return NextResponse.json({ ok: true });
  }
);
