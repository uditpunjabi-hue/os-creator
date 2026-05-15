import { NextResponse } from 'next/server';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { withErrorHandling } from '@gitroom/frontend/lib/server/api';
import { markAllRead } from '@gitroom/frontend/lib/server/notifications';

export const runtime = 'nodejs';

export const POST = withErrorHandling(async () => {
  const { user } = await getAuth();
  const count = await markAllRead(user.id);
  return NextResponse.json({ count });
});
