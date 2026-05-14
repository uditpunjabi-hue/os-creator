import { NextResponse } from 'next/server';
import { listGmailTemplates } from '@gitroom/frontend/lib/server/gmail';
import { withErrorHandling } from '@gitroom/frontend/lib/server/api';

export const runtime = 'nodejs';

export const GET = withErrorHandling(async () => {
  return NextResponse.json(listGmailTemplates());
});
