import { NextRequest } from 'next/server';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { errorResponse } from '@gitroom/frontend/lib/server/api';
import { runPipeline } from '@gitroom/frontend/lib/server/agents/orchestrator';
import type { PipelineRequest } from '@gitroom/frontend/lib/server/agents/types';

export const runtime = 'nodejs';
// The 6-agent pipeline runs 30–90s; the auto-revise branch can push it past
// Vercel Hobby's 60s default. 300s = Vercel Pro plan max. Required.
export const maxDuration = 300;

/**
 * NDJSON stream of pipeline events. Each event is a single JSON object on its
 * own line. The client consumes via res.body.getReader() + split on \n.
 *
 * We use a ReadableStream constructed from the async generator so the response
 * flushes events as they're produced — Vercel buffers more aggressively than
 * Express, but writing through a stream controller (vs. res.write) is the only
 * pattern Next.js route handlers support.
 */
export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return errorResponse(503, 'ANTHROPIC_API_KEY not configured');
  }

  const body = (await req.json().catch(() => ({}))) as Partial<PipelineRequest>;
  const prompt = (body.prompt ?? '').trim();
  if (!prompt) return errorResponse(400, 'prompt is required');

  const { user, org } = await getAuth();
  const request: PipelineRequest = {
    prompt,
    contentType: body.contentType ?? 'reel',
    tone: body.tone ?? 'educational',
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of runPipeline(org.id, user.id, request)) {
          controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        controller.enqueue(
          encoder.encode(JSON.stringify({ kind: 'pipeline_error', error: message }) + '\n')
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'application/x-ndjson',
      'cache-control': 'no-cache, no-transform',
      // Hint Vercel/CDN not to buffer.
      'x-accel-buffering': 'no',
    },
  });
}
