import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { withErrorHandling, errorResponse } from '@gitroom/frontend/lib/server/api';
import { listBrands, createBrand, syncBrandsFromInbox } from '@gitroom/frontend/lib/server/brand-crm';

export const runtime = 'nodejs';
export const maxDuration = 60;

export const GET = withErrorHandling(async (req: NextRequest) => {
  const { user, org } = await getAuth();
  if (req.nextUrl.searchParams.get('sync') === '1') {
    await syncBrandsFromInbox(user.id, org.id);
  }
  const brands = await listBrands(user.id, org.id);
  return NextResponse.json({ brands });
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const { org } = await getAuth();
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    industry?: string;
    contactName?: string;
    contactEmail?: string;
    notes?: string;
  };
  if (!body.name?.trim()) return errorResponse(400, 'name is required');
  const brand = await createBrand(org.id, {
    name: body.name.trim(),
    industry: body.industry?.trim() || undefined,
    contactName: body.contactName?.trim() || undefined,
    contactEmail: body.contactEmail?.trim().toLowerCase() || undefined,
    notes: body.notes?.trim() || undefined,
  });
  return NextResponse.json(brand);
});
