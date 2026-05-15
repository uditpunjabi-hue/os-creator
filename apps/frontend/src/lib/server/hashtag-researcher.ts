import 'server-only';
import { callClaude, ClaudeError } from './anthropic';
import { prisma } from './prisma';
import { getInstagramProfile } from './instagram';

// Hashtag groups by competition bucket. Counts are rough — Claude does the
// classification based on its training corpus; we don't hit IG's hashtag
// search (it's gated). These are starting points, not ground truth.

export type HashtagBucket = 'high' | 'medium' | 'low' | 'niche';

export interface HashtagSuggestion {
  tag: string;
  bucket: HashtagBucket;
  estimatedPosts: string;
  rationale?: string;
}

export interface HashtagGroups {
  topic: string;
  generatedAt: string;
  high: HashtagSuggestion[];
  medium: HashtagSuggestion[];
  low: HashtagSuggestion[];
  niche: HashtagSuggestion[];
  frequentlyUsed: string[];
}

const SYSTEM = `You suggest Instagram hashtags for a creator. Return ONLY JSON, no markdown.

Output exactly 30 hashtags total, grouped into 4 buckets by competition:
- "high": Big general tags (>1M posts on IG). 6 hashtags. Used for reach but very competitive.
- "medium": Mid-size tags (100K-1M posts). 10 hashtags. Sweet spot for most creators.
- "low": Specific tags (10K-100K posts). 10 hashtags. Best for growth — less competition.
- "niche": Hyper-specific community tags (<10K posts). 4 hashtags.

Each hashtag must include "#". Each item: { "tag": "#example", "bucket": "high|medium|low|niche", "estimatedPosts": "2.4M" | "450K" | "32K" | "4.2K", "rationale": "1 sentence why (max 100 chars)" }

Return shape:
{ "hashtags": [ ...30 items... ] }`;

export async function researchHashtags(
  topic: string,
  orgId: string
): Promise<HashtagGroups> {
  const trimmed = topic.trim();
  if (!trimmed) throw new Error('Topic is required');

  const profile = await getInstagramProfile(orgId).catch(() => null);
  const recentHashtags = collectFrequentHashtags(profile);

  let parsed: { hashtags?: HashtagSuggestion[] };
  try {
    parsed = await callClaude<{ hashtags?: HashtagSuggestion[] }>({
      systemPrompt: SYSTEM,
      userMessage: JSON.stringify({
        topic: trimmed,
        creatorBio: profile?.bio ?? null,
        creatorHandle: profile?.handle ?? null,
      }),
      maxTokens: 2400,
      timeoutMs: 20_000,
    });
  } catch (e) {
    if (e instanceof ClaudeError) {
      return fallbackGroups(trimmed, recentHashtags);
    }
    throw e;
  }

  const raw = parsed.hashtags ?? [];
  const groups: HashtagGroups = {
    topic: trimmed,
    generatedAt: new Date().toISOString(),
    high: [],
    medium: [],
    low: [],
    niche: [],
    frequentlyUsed: recentHashtags,
  };
  for (const h of raw) {
    if (!h?.tag) continue;
    const tag = h.tag.startsWith('#') ? h.tag : `#${h.tag}`;
    const item: HashtagSuggestion = {
      tag: tag.toLowerCase(),
      bucket: h.bucket,
      estimatedPosts: h.estimatedPosts ?? '',
      rationale: h.rationale ?? '',
    };
    const bucket = (['high', 'medium', 'low', 'niche'] as HashtagBucket[]).includes(h.bucket)
      ? h.bucket
      : 'medium';
    groups[bucket].push(item);
  }
  if (groups.high.length + groups.medium.length + groups.low.length + groups.niche.length === 0) {
    return fallbackGroups(trimmed, recentHashtags);
  }
  return groups;
}

function collectFrequentHashtags(profile: Awaited<ReturnType<typeof getInstagramProfile>> | null): string[] {
  if (!profile?.recentMedia) return [];
  const counts = new Map<string, number>();
  for (const m of profile.recentMedia) {
    if (!m.caption) continue;
    const matches = m.caption.match(/#[\w -￿]+/gu) ?? [];
    for (const tag of matches) {
      const k = tag.toLowerCase();
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([t]) => t);
}

function fallbackGroups(topic: string, frequentlyUsed: string[]): HashtagGroups {
  // Reasonable starter set when Claude is unavailable.
  const norm = topic.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return {
    topic,
    generatedAt: new Date().toISOString(),
    frequentlyUsed,
    high: [
      { tag: '#instagram', bucket: 'high', estimatedPosts: '500M+' },
      { tag: '#viral', bucket: 'high', estimatedPosts: '300M+' },
      { tag: '#reels', bucket: 'high', estimatedPosts: '200M+' },
      { tag: '#content', bucket: 'high', estimatedPosts: '80M+' },
      { tag: '#trending', bucket: 'high', estimatedPosts: '60M+' },
      { tag: '#creator', bucket: 'high', estimatedPosts: '20M+' },
    ],
    medium: [
      { tag: `#${norm}`, bucket: 'medium', estimatedPosts: '~500K' },
      { tag: `#${norm}life`, bucket: 'medium', estimatedPosts: '~250K' },
      { tag: `#${norm}tips`, bucket: 'medium', estimatedPosts: '~200K' },
      { tag: `#${norm}community`, bucket: 'medium', estimatedPosts: '~150K' },
      { tag: '#creatoreconomy', bucket: 'medium', estimatedPosts: '~300K' },
      { tag: '#contentcreator', bucket: 'medium', estimatedPosts: '~800K' },
      { tag: '#smallcreator', bucket: 'medium', estimatedPosts: '~200K' },
      { tag: '#instagood', bucket: 'medium', estimatedPosts: '~900K' },
      { tag: '#dailycontent', bucket: 'medium', estimatedPosts: '~150K' },
      { tag: '#creatortips', bucket: 'medium', estimatedPosts: '~120K' },
    ],
    low: [
      { tag: `#${norm}daily`, bucket: 'low', estimatedPosts: '~50K' },
      { tag: `#${norm}journey`, bucket: 'low', estimatedPosts: '~30K' },
      { tag: `#${norm}vibes`, bucket: 'low', estimatedPosts: '~40K' },
      { tag: `#${norm}stories`, bucket: 'low', estimatedPosts: '~25K' },
      { tag: `#${norm}reels`, bucket: 'low', estimatedPosts: '~80K' },
      { tag: '#creatorthoughts', bucket: 'low', estimatedPosts: '~20K' },
      { tag: '#creatorgrind', bucket: 'low', estimatedPosts: '~40K' },
      { tag: '#creatorhour', bucket: 'low', estimatedPosts: '~15K' },
      { tag: '#growingoninstagram', bucket: 'low', estimatedPosts: '~30K' },
      { tag: '#creatorslife', bucket: 'low', estimatedPosts: '~60K' },
    ],
    niche: [
      { tag: `#small${norm}creator`, bucket: 'niche', estimatedPosts: '~3K' },
      { tag: `#${norm}club`, bucket: 'niche', estimatedPosts: '~5K' },
      { tag: `#${norm}corner`, bucket: 'niche', estimatedPosts: '~2K' },
      { tag: `#${norm}lab`, bucket: 'niche', estimatedPosts: '~1K' },
    ],
  };
}
