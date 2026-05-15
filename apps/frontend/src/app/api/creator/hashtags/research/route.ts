import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { withErrorHandling, errorResponse } from '@gitroom/frontend/lib/server/api';
import { researchHashtags } from '@gitroom/frontend/lib/server/hashtag-researcher';

export const runtime = 'nodejs';
export const maxDuration = 60;

export const POST = withErrorHandling(async (req: NextRequest) => {
  const { org } = await getAuth();
  const body = (await req.json().catch(() => ({}))) as { topic?: string };
  const topic = (body.topic ?? '').trim();
  if (!topic) return errorResponse(400, 'topic is required');
  const groups = await researchHashtags(topic, org.id);
  return NextResponse.json(groups);
});
