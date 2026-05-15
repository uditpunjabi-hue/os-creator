import 'server-only';
import type { ContentIdea, ContentIdeaSource, ContentIdeaStatus } from '@prisma/client';
import { prisma } from './prisma';
import { callClaude, ClaudeError } from './anthropic';
import { getInstagramProfile, type IgMedia } from './instagram';
import { getProfileIntelligence } from './agents/profile-intelligence.agent';

// Weekly content ideas. The unit-of-refresh is a Monday-anchored week:
// every Monday the user gets a fresh batch, and within the week they can
// regenerate manually but it's not automatic. We persist ideas so users can
// swipe-to-save and come back later — dismissed ideas stay in the table so
// the generator doesn't re-suggest the exact same titles next Monday.

export interface GeneratedIdea {
  title: string;
  hook: string;
  format: 'Reel' | 'Carousel' | 'Image' | 'Story';
  estimatedEngagement: number;
  source: ContentIdeaSource;
  rationale: string;
}

export interface IdeasSnapshot {
  weekOf: string;
  generatedAt: string;
  ideas: Array<ContentIdea>;
}

function startOfWeekUTC(d: Date = new Date()): Date {
  // ISO weeks (Mon-Sun). UTC so the cache key is stable across timezones.
  const day = d.getUTCDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff));
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

function seasonHint(d: Date = new Date()): string {
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  if (m === 0) return 'New year / resolution season';
  if (m === 1) return 'Valentine\'s Day mid-month';
  if (m === 2) return 'Spring start, March goals reset';
  if (m === 3) return 'Tax season, spring cleaning';
  if (m === 4) return 'Mother\'s Day, summer prep';
  if (m === 5) return 'Pride month, Father\'s Day, summer kickoff';
  if (m === 6) return 'Mid-summer, vacation vibes';
  if (m === 7) return 'Late summer, back-to-school prep';
  if (m === 8) return 'Back to school, autumn approach';
  if (m === 9) return 'Halloween prep, autumn aesthetic';
  if (m === 10) return 'Black Friday, Thanksgiving, holiday gifting starts';
  if (m === 11) return 'Holiday season, year-end reflection, gift guides';
  return '';
}

export async function getIdeasForUser(userId: string, orgId: string): Promise<IdeasSnapshot> {
  const weekOf = startOfWeekUTC();
  let existing = await prisma.contentIdea.findMany({
    where: { userId, weekOf },
    orderBy: [{ createdAt: 'asc' }],
  });
  if (existing.length === 0) {
    existing = await regenerateIdeas(userId, orgId, false);
  }
  return {
    weekOf: weekOf.toISOString(),
    generatedAt: existing[0]?.createdAt.toISOString() ?? new Date().toISOString(),
    ideas: existing,
  };
}

export async function regenerateIdeas(
  userId: string,
  orgId: string,
  replace = true
): Promise<ContentIdea[]> {
  const weekOf = startOfWeekUTC();
  if (replace) {
    await prisma.contentIdea.deleteMany({ where: { userId, weekOf, status: 'NEW' } });
  }
  const generated = await callIdeasModel(userId, orgId);
  const created: ContentIdea[] = [];
  for (const g of generated) {
    const row = await prisma.contentIdea.create({
      data: {
        organizationId: orgId,
        userId,
        title: g.title.slice(0, 200),
        hook: g.hook?.slice(0, 400) ?? null,
        format: g.format,
        estimatedEngagement: Number.isFinite(g.estimatedEngagement)
          ? Math.max(0, Math.min(g.estimatedEngagement, 25))
          : null,
        source: g.source,
        rationale: g.rationale?.slice(0, 600) ?? null,
        status: 'NEW',
        weekOf,
      },
    });
    created.push(row);
  }
  return created;
}

async function callIdeasModel(userId: string, orgId: string): Promise<GeneratedIdea[]> {
  // Pull lightweight context: the creator's recent best posts and the
  // inspiration accounts. We don't need the full intelligence narrative —
  // just enough signal for Claude to anchor the ideas to this creator's
  // niche and what's already working for them.
  const intel = await getProfileIntelligence(orgId).catch(() => null);
  const profile = await getInstagramProfile(orgId).catch(() => null);
  const competitors = await prisma.competitor.findMany({
    where: { organizationId: orgId },
    select: { handle: true, notes: true },
    take: 8,
  });

  const niche = profile?.bio?.slice(0, 80) ?? 'general lifestyle creator';
  const handle = profile?.handle ?? null;
  const followers = profile?.followers ?? null;
  const topFormats = intel?.contentBreakdown
    ? Object.entries(intel.contentBreakdown)
        .filter(([, v]) => (v as { count: number }).count > 0)
        .map(([k, v]) => {
          const s = v as { count: number; avgEngagement: number };
          return `${k} (${s.count} posts, avg ${s.avgEngagement}%)`;
        })
        .join(', ')
    : 'Reels';
  const topPosts = (profile?.recentMedia ?? [])
    .slice(0, 5)
    .map((p: IgMedia) => ({
      caption: (p.caption ?? '').slice(0, 120),
      likes: p.likeCount,
      comments: p.commentsCount,
    }));

  const systemPrompt = `You are a content strategist helping a creator plan their week.
Generate exactly 10 content ideas. Each idea should be specific, on-brand, and use a proven viral hook structure.

Return JSON only, in this exact shape:
{
  "ideas": [
    {
      "title": "Short punchy title (max 80 chars)",
      "hook": "The opening line of the post (max 200 chars). Must grab attention in 2 seconds.",
      "format": "Reel" | "Carousel" | "Image" | "Story",
      "estimatedEngagement": number between 1 and 12 (percent),
      "source": "TRENDING" | "INSPIRATION" | "SEASONAL" | "TOP_PERFORMING" | "EVERGREEN",
      "rationale": "1-2 sentences on why this should work for THIS creator (max 300 chars)"
    }
  ]
}

Mix the sources: at least 2 TRENDING (current platform-wide trends), 2 INSPIRATION (inspired by competitors' winning angles), 1 SEASONAL (timely), 2 TOP_PERFORMING (riff on what already worked for them), and 3 EVERGREEN (always-good topics for their niche).`;

  const userMessage = JSON.stringify({
    creator: { handle, niche, followers, topFormats },
    topPosts,
    inspirationAccounts: competitors.map((c) => ({ handle: c.handle, notes: c.notes })),
    seasonalContext: seasonHint(),
    currentWeek: startOfWeekUTC().toISOString().slice(0, 10),
  });

  let parsed: { ideas?: Array<Partial<GeneratedIdea>> };
  try {
    parsed = await callClaude<{ ideas?: Array<Partial<GeneratedIdea>> }>({
      systemPrompt,
      userMessage,
      maxTokens: 2400,
      timeoutMs: 20_000,
    });
  } catch (e) {
    if (e instanceof ClaudeError) {
      // Fall back to a deterministic seed list so the UI is never empty.
      // Five evergreen prompts beats a blank screen.
      return seedIdeas(niche);
    }
    throw e;
  }

  const out: GeneratedIdea[] = [];
  for (const raw of parsed.ideas ?? []) {
    if (!raw.title) continue;
    out.push({
      title: String(raw.title),
      hook: String(raw.hook ?? ''),
      format: (raw.format ?? 'Reel') as GeneratedIdea['format'],
      estimatedEngagement: Number(raw.estimatedEngagement ?? 4),
      source: (raw.source ?? 'EVERGREEN') as ContentIdeaSource,
      rationale: String(raw.rationale ?? ''),
    });
  }
  if (out.length === 0) return seedIdeas(niche);
  return out.slice(0, 10);
}

function seedIdeas(niche: string): GeneratedIdea[] {
  // Used when Claude is unavailable. Generic but on-niche enough to be a
  // starting point — users can dismiss and the next regenerate will hit
  // Claude again.
  const base: Array<Omit<GeneratedIdea, 'rationale'>> = [
    { title: `5 mistakes I made in my first year of ${niche}`, hook: 'Wish someone told me this on day 1...', format: 'Reel', estimatedEngagement: 6, source: 'EVERGREEN' },
    { title: 'A day in my life as a creator', hook: 'POV: you wake up to this notification...', format: 'Reel', estimatedEngagement: 5, source: 'EVERGREEN' },
    { title: 'My biggest L this week', hook: 'I almost didn\'t post this...', format: 'Story', estimatedEngagement: 4, source: 'EVERGREEN' },
    { title: '3 tools that 10x\'d my workflow', hook: 'These are not sponsored, I promise.', format: 'Carousel', estimatedEngagement: 7, source: 'EVERGREEN' },
    { title: 'Reply to a comment that broke my brain', hook: 'Someone asked me this and now I can\'t stop thinking about it', format: 'Reel', estimatedEngagement: 5, source: 'TRENDING' },
    { title: 'My honest opinion on [hot take]', hook: 'I know I\'ll get hate for this but...', format: 'Reel', estimatedEngagement: 8, source: 'TRENDING' },
    { title: 'Things I wish I knew before starting', hook: 'Year-1 me needs to hear this', format: 'Carousel', estimatedEngagement: 6, source: 'EVERGREEN' },
    { title: 'Behind the scenes of my last viral post', hook: 'You won\'t believe how I shot this', format: 'Reel', estimatedEngagement: 7, source: 'TOP_PERFORMING' },
    { title: 'Reacting to a creator I love', hook: 'I had to react to this...', format: 'Reel', estimatedEngagement: 6, source: 'INSPIRATION' },
    { title: 'What I\'m planning this season', hook: 'Stuff that\'s coming this month', format: 'Story', estimatedEngagement: 4, source: 'SEASONAL' },
  ];
  return base.map((b) => ({
    ...b,
    rationale: 'Generated from seed set — connect IG + competitors for personalized ideas.',
  }));
}

export async function setIdeaStatus(
  userId: string,
  ideaId: string,
  status: ContentIdeaStatus
): Promise<ContentIdea | null> {
  const idea = await prisma.contentIdea.findUnique({ where: { id: ideaId } });
  if (!idea || idea.userId !== userId) return null;
  return prisma.contentIdea.update({ where: { id: ideaId }, data: { status } });
}
