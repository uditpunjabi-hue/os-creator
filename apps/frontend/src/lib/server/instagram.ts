import 'server-only';
import { prisma } from './prisma';
import { memoryCache } from './memory-cache';

const FB_GRAPH = 'https://graph.facebook.com/v18.0';
const MEDIA_CACHE_KEY = (userId: string) => `ig:media:${userId}`;
const CACHE_TTL_SECONDS = 10 * 60;

export interface IgMedia {
  id: string;
  caption: string | null;
  mediaType: string;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  permalink: string | null;
  likeCount: number;
  commentsCount: number;
  timestamp: string;
}

export interface IgProfile {
  connected: boolean;
  handle: string | null;
  followers: number | null;
  mediaCount: number | null;
  bio: string | null;
  profilePic: string | null;
  engagementRate: number | null;
  recentMedia: IgMedia[];
}

export async function getInstagramProfile(orgId: string): Promise<IgProfile> {
  const user = await prisma.user.findFirst({
    where: {
      instagramConnectedAt: { not: null },
      organizations: { some: { organizationId: orgId, disabled: false } },
    },
    select: {
      id: true,
      instagramAccessToken: true,
      instagramUserId: true,
      instagramHandle: true,
      instagramFollowers: true,
      instagramMediaCount: true,
      instagramBio: true,
      instagramProfilePic: true,
    },
  });

  if (!user || !user.instagramAccessToken || !user.instagramUserId) {
    return {
      connected: false,
      handle: null,
      followers: null,
      mediaCount: null,
      bio: null,
      profilePic: null,
      engagementRate: null,
      recentMedia: [],
    };
  }

  const recentMedia = await fetchRecentMedia(
    user.id,
    user.instagramAccessToken,
    user.instagramUserId
  );

  let engagementRate: number | null = null;
  if (recentMedia.length > 0 && user.instagramFollowers && user.instagramFollowers > 0) {
    const total = recentMedia.reduce((s, m) => s + m.likeCount + m.commentsCount, 0);
    const avg = total / recentMedia.length;
    engagementRate = Math.round((avg / user.instagramFollowers) * 100 * 100) / 100;
  }

  return {
    connected: true,
    handle: user.instagramHandle,
    followers: user.instagramFollowers,
    mediaCount: user.instagramMediaCount,
    bio: user.instagramBio,
    profilePic: user.instagramProfilePic,
    engagementRate,
    recentMedia,
  };
}

async function fetchRecentMedia(
  userId: string,
  pageToken: string,
  igUserId: string
): Promise<IgMedia[]> {
  const cacheKey = MEDIA_CACHE_KEY(userId);
  const cached = memoryCache.get<IgMedia[]>(cacheKey);
  if (cached) return cached;

  try {
    const fields =
      'id,caption,media_type,media_url,thumbnail_url,permalink,like_count,comments_count,timestamp';
    const url = `${FB_GRAPH}/${igUserId}/media?fields=${fields}&limit=12&access_token=${encodeURIComponent(pageToken)}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`IG media fetch failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
      return [];
    }
    const payload = (await res.json()) as {
      data?: Array<{
        id: string;
        caption?: string;
        media_type?: string;
        media_url?: string;
        thumbnail_url?: string;
        permalink?: string;
        like_count?: number;
        comments_count?: number;
        timestamp?: string;
      }>;
    };
    const items: IgMedia[] = (payload.data ?? []).map((m) => ({
      id: m.id,
      caption: m.caption ?? null,
      mediaType: m.media_type ?? 'IMAGE',
      mediaUrl: m.media_url ?? null,
      thumbnailUrl: m.thumbnail_url ?? null,
      permalink: m.permalink ?? null,
      likeCount: m.like_count ?? 0,
      commentsCount: m.comments_count ?? 0,
      timestamp: m.timestamp ?? new Date().toISOString(),
    }));
    memoryCache.set(cacheKey, items, CACHE_TTL_SECONDS);
    return items;
  } catch (e) {
    console.error(`IG fetchRecentMedia crashed: ${(e as Error).message}`);
    return [];
  }
}
