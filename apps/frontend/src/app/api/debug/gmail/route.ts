import { NextResponse } from 'next/server';
import { prisma } from '@gitroom/frontend/lib/server/prisma';
import { getAuth } from '@gitroom/frontend/lib/server/auth';
import { getValidGoogleAccessToken } from '@gitroom/frontend/lib/server/google-token';
import { withErrorHandling } from '@gitroom/frontend/lib/server/api';

export const runtime = 'nodejs';
export const maxDuration = 30;

const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';
const TOKENINFO = 'https://oauth2.googleapis.com/tokeninfo';
const INBOX_QUERY = 'in:inbox newer_than:30d';

// ---------------------------------------------------------------------------
// /api/debug/gmail — read-only diagnostics for the Inbox feature.
//
// Returns:
//   1. who the auth cookie resolved to (user.id + email)
//   2. whether googleAccessToken / refreshToken exist on that user record
//   3. whether the access token is still valid (after refresh attempt)
//   4. Google's tokeninfo for the live token: the actual granted scopes
//   5. Gmail /profile (the connected email address Google sees)
//   6. Gmail /threads — raw thread count + first 5 thread ids/snippets
//
// Everything is per-user (not per-org), so this catches the case where
// /api/manager/inbox/threads is picking up a different user's token.
// ---------------------------------------------------------------------------

export const GET = withErrorHandling(async () => {
  const { user, org } = await getAuth();

  // 1. Raw fields straight off the user row.
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      providerName: true,
      googleEmail: true,
      googleAccessToken: true,
      googleRefreshToken: true,
      googleExpiresAt: true,
      googleConnectedAt: true,
    },
  });

  if (!row) {
    return NextResponse.json({ ok: false, stage: 'lookup', error: 'User row not found' });
  }

  const tokenStored = !!row.googleAccessToken;
  const refreshStored = !!row.googleRefreshToken;
  const expiresAt = row.googleExpiresAt?.toISOString() ?? null;
  const expiresInSec = row.googleExpiresAt
    ? Math.round((row.googleExpiresAt.getTime() - Date.now()) / 1000)
    : null;

  if (!tokenStored) {
    return NextResponse.json({
      ok: false,
      stage: 'no_token',
      user: { id: row.id, email: row.email, providerName: row.providerName, org: org.id },
      google: {
        connected: !!row.googleConnectedAt,
        connectedAt: row.googleConnectedAt?.toISOString() ?? null,
        email: row.googleEmail,
        hasAccessToken: false,
        hasRefreshToken: refreshStored,
        accessTokenExpiresAt: expiresAt,
      },
      hint:
        'No googleAccessToken stored. The user has not finished Google OAuth, or a disconnect cleared it. Visit /auth/login → Continue with Google.',
    });
  }

  // 2. Resolve a usable token (auto-refreshes if expired).
  const liveToken = await getValidGoogleAccessToken(row.id);
  if (!liveToken) {
    return NextResponse.json({
      ok: false,
      stage: 'refresh_failed',
      user: { id: row.id, email: row.email, providerName: row.providerName, org: org.id },
      google: {
        connected: !!row.googleConnectedAt,
        email: row.googleEmail,
        hasAccessToken: tokenStored,
        hasRefreshToken: refreshStored,
        accessTokenExpiresAt: expiresAt,
        expiresInSec,
      },
      hint:
        refreshStored
          ? 'Refresh token exists but Google rejected it. The user needs to reconnect Google (the connection was revoked or the refresh token expired).'
          : 'Access token expired and no refresh token on file. The user needs to reconnect Google.',
    });
  }

  // 3. tokeninfo — Google echoes back the scopes the token actually has.
  let tokenInfo: { scope?: string; expires_in?: string; email?: string } | { error: string } | null = null;
  try {
    const r = await fetch(`${TOKENINFO}?access_token=${encodeURIComponent(liveToken)}`);
    tokenInfo = r.ok ? await r.json() : { error: `tokeninfo ${r.status}: ${(await r.text()).slice(0, 200)}` };
  } catch (e) {
    tokenInfo = { error: (e as Error).message };
  }
  const scopes =
    tokenInfo && 'scope' in tokenInfo && tokenInfo.scope ? tokenInfo.scope.split(/\s+/) : [];
  const hasGmailReadonly = scopes.some((s) => s.includes('gmail.readonly') || s.includes('gmail.modify') || s.includes('mail.google.com'));

  // 4. Gmail /profile — the email Google associates with this token.
  let profile: { emailAddress?: string; messagesTotal?: number; threadsTotal?: number } | { error: string } = { error: 'not_attempted' };
  try {
    const r = await fetch(`${GMAIL_BASE}/profile`, {
      headers: { Authorization: `Bearer ${liveToken}` },
    });
    profile = r.ok ? await r.json() : { error: `profile ${r.status}: ${(await r.text()).slice(0, 200)}` };
  } catch (e) {
    profile = { error: (e as Error).message };
  }

  // 5. Gmail /threads — the actual call the inbox makes.
  let threads:
    | {
        ok: true;
        count: number;
        sample: Array<{ id: string; snippet?: string; historyId?: string }>;
      }
    | { ok: false; status: number; body: string } = { ok: false, status: 0, body: 'not_attempted' };
  try {
    const r = await fetch(
      `${GMAIL_BASE}/threads?maxResults=10&q=${encodeURIComponent(INBOX_QUERY)}`,
      { headers: { Authorization: `Bearer ${liveToken}` } }
    );
    if (!r.ok) {
      threads = { ok: false, status: r.status, body: (await r.text()).slice(0, 400) };
    } else {
      const data = (await r.json()) as {
        threads?: Array<{ id: string; snippet?: string; historyId?: string }>;
      };
      const list = data.threads ?? [];
      threads = { ok: true, count: list.length, sample: list.slice(0, 5) };
    }
  } catch (e) {
    threads = { ok: false, status: 0, body: (e as Error).message };
  }

  return NextResponse.json({
    ok: true,
    user: {
      id: row.id,
      email: row.email,
      providerName: row.providerName,
      org: org.id,
    },
    google: {
      connected: !!row.googleConnectedAt,
      connectedAt: row.googleConnectedAt?.toISOString() ?? null,
      email: row.googleEmail,
      hasAccessToken: tokenStored,
      hasRefreshToken: refreshStored,
      accessTokenExpiresAt: expiresAt,
      expiresInSec,
      // First + last 4 chars only — proves which token we're using without
      // leaking it in plain text.
      tokenFingerprint: `${liveToken.slice(0, 6)}…${liveToken.slice(-4)}`,
    },
    tokenInfo: {
      scopes,
      hasGmailReadonly,
      raw: tokenInfo,
    },
    gmailProfile: profile,
    gmailThreads: threads,
    hint:
      !hasGmailReadonly
        ? 'Token does NOT include gmail.readonly. The user connected Google before that scope was added — they need to reconnect (Settings → Disconnect Google, then Continue with Google again).'
        : 'ok' in threads && threads.ok && threads.count === 0
        ? 'Gmail returned zero threads for "in:inbox newer_than:30d". Either the connected Gmail account genuinely has no recent inbox mail, or a Gmail filter is auto-archiving everything before it lands in inbox.'
        : null,
  });
});
