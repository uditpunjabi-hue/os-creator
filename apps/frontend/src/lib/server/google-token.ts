import 'server-only';
import { prisma } from './prisma';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REFRESH_BUFFER_MS = 60 * 1000;

/**
 * Returns a valid Google access token for `userId`, refreshing via the stored
 * refresh_token if the current one is within 60s of expiry. Returns null on:
 *   - no Google tokens stored,
 *   - no refresh_token + expired access token,
 *   - refresh request failure (also clears stored tokens so the UI re-prompts).
 */
export async function getValidGoogleAccessToken(userId: string): Promise<string | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      googleAccessToken: true,
      googleRefreshToken: true,
      googleExpiresAt: true,
    },
  });
  if (!u?.googleAccessToken) return null;

  const expiresAt = u.googleExpiresAt?.getTime() ?? 0;
  if (expiresAt - Date.now() > REFRESH_BUFFER_MS) {
    return u.googleAccessToken;
  }

  if (!u.googleRefreshToken) {
    console.warn(`User ${userId} Google token expired with no refresh_token — clearing.`);
    await clearGoogleConnection(userId);
    return null;
  }

  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: u.googleRefreshToken,
        grant_type: 'refresh_token',
      }),
    });
    if (!res.ok) {
      console.warn(`Google refresh failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
      await clearGoogleConnection(userId);
      return null;
    }
    const data = (await res.json()) as {
      access_token: string;
      expires_in: number;
      refresh_token?: string;
    };
    const newExpiresAt = new Date(Date.now() + data.expires_in * 1000);
    await prisma.user.update({
      where: { id: userId },
      data: {
        googleAccessToken: data.access_token,
        googleExpiresAt: newExpiresAt,
        ...(data.refresh_token ? { googleRefreshToken: data.refresh_token } : {}),
      },
    });
    return data.access_token;
  } catch (e) {
    console.warn(`Google refresh crashed: ${(e as Error).message}`);
    return null;
  }
}

export async function getGoogleTokenForOrg(
  orgId: string
): Promise<{ userId: string; token: string } | null> {
  const u = await prisma.user.findFirst({
    where: {
      googleConnectedAt: { not: null },
      organizations: { some: { organizationId: orgId, disabled: false } },
    },
    select: { id: true },
  });
  if (!u) return null;
  const token = await getValidGoogleAccessToken(u.id);
  return token ? { userId: u.id, token } : null;
}

async function clearGoogleConnection(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      googleAccessToken: null,
      googleRefreshToken: null,
      googleExpiresAt: null,
      googleEmail: null,
      googleConnectedAt: null,
    },
  });
}
