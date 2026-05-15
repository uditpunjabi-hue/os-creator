import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { withErrorHandling, errorResponse } from '@gitroom/frontend/lib/server/api';
import { getInvoice, updateInvoice, deleteInvoice } from '@gitroom/frontend/lib/server/invoice';

export const runtime = 'nodejs';

export const GET = withErrorHandling(
  async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const { org } = await getAuth();
    const { id } = await ctx.params;
    const inv = await getInvoice(org.id, id);
    if (!inv) return errorResponse(404, 'invoice not found');
    return NextResponse.json(inv);
  }
);

export const PATCH = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const { org } = await getAuth();
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as Parameters<typeof updateInvoice>[2];
    const updated = await updateInvoice(org.id, id, body);
    if (!updated) return errorResponse(404, 'invoice not found');
    return NextResponse.json(updated);
  }
);

export const DELETE = withErrorHandling(
  async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const { org } = await getAuth();
    const { id } = await ctx.params;
    const ok = await deleteInvoice(org.id, id);
    if (!ok) return errorResponse(404, 'invoice not found');
    return NextResponse.json({ ok: true });
  }
);
