import 'server-only';
import { NextResponse } from 'next/server';
import { AuthError } from './auth';

/**
 * Standard JSON error envelope, matching what the NestJS HttpExceptionFilter
 * was emitting so the frontend's error-handling code keeps working unchanged.
 */
export function errorResponse(status: number, message: string, extra?: object) {
  return NextResponse.json({ statusCode: status, message, ...extra }, { status });
}

/**
 * Wrap a route handler so it converts thrown AuthErrors to 401/403 and other
 * errors to 500 with a readable message — keeps every handler from needing
 * a try/catch.
 */
export function withErrorHandling<TArgs extends unknown[]>(
  fn: (...args: TArgs) => Promise<Response>
): (...args: TArgs) => Promise<Response> {
  return async (...args: TArgs) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof AuthError) {
        return errorResponse(err.status, err.message);
      }
      if (err instanceof Response) {
        return err;
      }
      const message = err instanceof Error ? err.message : String(err);
      console.error('[api error]', message, err);
      return errorResponse(500, message);
    }
  };
}

// Note: Next.js route segment config (export const runtime = 'nodejs') must be
// a literal in the route file itself — it's parsed statically. Each route
// declares its own. We force Node runtime because Prisma + bcrypt + jsonwebtoken
// don't work on Edge.
