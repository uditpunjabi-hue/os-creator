import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { withErrorHandling, errorResponse } from '@gitroom/frontend/lib/server/api';
import { listInvoices, createInvoice } from '@gitroom/frontend/lib/server/invoice';

export const runtime = 'nodejs';

export const GET = withErrorHandling(async () => {
  const { org } = await getAuth();
  const invoices = await listInvoices(org.id);
  return NextResponse.json({ invoices });
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const { org } = await getAuth();
  const body = (await req.json().catch(() => null)) as Parameters<typeof createInvoice>[1] | null;
  if (!body?.brandName?.trim()) return errorResponse(400, 'brandName is required');
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return errorResponse(400, 'at least one line item is required');
  }
  try {
    const created = await createInvoice(org.id, body);
    return NextResponse.json(created);
  } catch (e) {
    return errorResponse(400, (e as Error).message);
  }
});
