import { NextResponse } from 'next/server';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { withErrorHandling } from '@gitroom/frontend/lib/server/api';
import { listForUser, unreadCount } from '@gitroom/frontend/lib/server/notifications';

export const runtime = 'nodejs';
export const maxDuration = 30;

export const GET = withErrorHandling(async () => {
  const { user, org } = await getAuth();
  const items = await listForUser(user.id, org.id);
  const unread = await unreadCount(user.id);
  return NextResponse.json({ items, unread });
});
