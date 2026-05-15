import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { withErrorHandling, errorResponse } from '@gitroom/frontend/lib/server/api';
import { sendInvoiceEmail } from '@gitroom/frontend/lib/server/invoice';

export const runtime = 'nodejs';

export const POST = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const { user, org } = await getAuth();
    const { id } = await ctx.params;
    // Use the configured public URL (FRONTEND_URL) or the request origin —
    // production should always have FRONTEND_URL set, so this fallback is
    // for local dev only.
    const base = process.env.FRONTEND_URL || req.nextUrl.origin;
    const result = await sendInvoiceEmail(user.id, org.id, id, base);
    if (!result.ok) {
      if (result.reason === 'no_email') return errorResponse(400, 'Invoice has no brand email — add one first.');
      if (result.reason === 'send_failed') return errorResponse(502, 'Gmail send failed. Reconnect Google or try again.');
      return errorResponse(500, 'Send failed');
    }
    return NextResponse.json({ ok: true });
  }
);
