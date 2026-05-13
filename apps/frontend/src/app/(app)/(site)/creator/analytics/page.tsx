'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Eye,
  Heart,
  MessageSquare,
  Bookmark,
  Share2,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Instagram,
  Loader2,
} from 'lucide-react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { cn } from '@gitroom/frontend/lib/utils';

interface IgMedia {
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

interface IgProfile {
  connected: boolean;
  handle: string | null;
  followers: number | null;
  mediaCount: number | null;
  engagementRate: number | null;
  recentMedia: IgMedia[];
}

interface ContentTypePerf {
  format: 'Reel' | 'Carousel' | 'Image' | 'Story';
  count: number;
  avgInteractions: number;
  avgEngagementPct: number;
}

interface Insights {
  connected: boolean;
  engagementRate: number | null;
  contentTypePerformance: ContentTypePerf[];
}

const fmt = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
    ? `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`
    : `${n}`;

const fmtAgo = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime();
  const d = Math.floor(ms / 86400_000);
  if (d < 1) return 'today';
  if (d === 1) return '1 day ago';
  if (d < 30) return `${d} days ago`;
  if (d < 60) return '1 month ago';
  return `${Math.floor(d / 30)} months ago`;
};

export default function CreatorAnalyticsPage() {
  const fetch = useFetch();
  const { backendUrl } = useVariables();
  const [profile, setProfile] = useState<IgProfile | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [pRes, iRes] = await Promise.all([
          fetch('/creator/profile'),
          fetch('/creator/insights'),
        ]);
        if (!cancelled) {
          if (pRes.ok) setProfile(await pRes.json());
          if (iRes.ok) setInsights(await iRes.json());
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetch]);

  const live = profile?.connected ?? false;
  const media = useMemo(
    () =>
      live
        ? [...(profile?.recentMedia ?? [])].sort(
            (a, b) => +new Date(b.timestamp) - +new Date(a.timestamp)
          )
        : [],
    [live, profile]
  );

  const totals = useMemo(() => {
    const likes = media.reduce((s, m) => s + m.likeCount, 0);
    const comments = media.reduce((s, m) => s + m.commentsCount, 0);
    return {
      likes,
      comments,
      interactions: likes + comments,
      posts: media.length,
      avg: media.length ? Math.round((likes + comments) / media.length) : 0,
    };
  }, [media]);

  const stats = useMemo(
    () => [
      { label: 'Interactions', value: fmt(totals.interactions), icon: Eye },
      { label: 'Likes', value: fmt(totals.likes), icon: Heart },
      { label: 'Comments', value: fmt(totals.comments), icon: MessageSquare },
      { label: 'Avg / post', value: fmt(totals.avg), icon: TrendingUp },
      { label: 'Posts pulled', value: String(totals.posts), icon: Sparkles },
    ],
    [totals]
  );

  // "Predicted" baseline = creator's average — flag posts that beat their own average.
  const baseline = totals.avg || 1;

  return (
    <div className="flex h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="flex items-start justify-between gap-2 px-4 py-3 lg:px-8 lg:py-5">
          <div className="min-w-0">
            <div className="text-lg font-semibold text-gray-900">Analytics</div>
            <div className="truncate text-xs text-gray-500">
              {live && profile?.handle
                ? `${profile.handle} · ${totals.posts} recent posts`
                : 'Connect Instagram to see post analytics'}
            </div>
          </div>
          <span
            className={cn(
              'inline-flex h-7 items-center rounded-full border px-2.5 text-[11px] font-medium',
              live ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-600'
            )}
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : live ? '● LIVE' : 'Not connected'}
          </span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 lg:px-8 lg:py-6">
        {!loading && !live && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <Instagram className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-gray-900">
                Connect Instagram to see real post analytics
              </div>
              <div className="mt-0.5 text-xs text-gray-600">
                Once connected, this page shows actual likes, comments, and interactions for every recent post.
              </div>
            </div>
            <a
              href={`${backendUrl}/oauth/instagram/start`}
              className="shrink-0 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-700"
            >
              Connect
            </a>
          </div>
        )}

        {/* Summary tiles */}
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-5 lg:gap-3">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.label}
                className="flex flex-col gap-1.5 rounded-2xl border border-gray-200 bg-white p-4"
              >
                <div className="flex items-center justify-between text-gray-500">
                  <span className="text-[10px] uppercase tracking-wide">{s.label}</span>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="text-xl font-semibold text-gray-900 lg:text-2xl">{s.value}</div>
              </div>
            );
          })}
        </div>

        {/* Content type breakdown from real insights */}
        {live && (insights?.contentTypePerformance?.length ?? 0) > 0 && (
          <div className="mt-4 rounded-2xl border border-purple-100 bg-purple-50/40 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-purple-700">
              Performance by content type
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
              {(insights?.contentTypePerformance ?? []).map((c) => (
                <div key={c.format} className="rounded-xl bg-white px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-gray-500">
                    {c.format} · n={c.count}
                  </div>
                  <div className="mt-0.5 text-base font-semibold text-gray-900">
                    {c.avgInteractions.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {c.avgEngagementPct}% engagement
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Posts list */}
        <div className="mt-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Recent posts
          </div>
          <ul className="flex flex-col gap-2">
            {media.map((p) => {
              const interactions = p.likeCount + p.commentsCount;
              const diff = interactions - baseline;
              const diffPct = baseline > 0 ? Math.round((diff / baseline) * 100) : 0;
              const beat = diff >= 0;
              return (
                <li
                  key={p.id}
                  className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-3">
                      {p.thumbnailUrl || p.mediaUrl ? (
                        <img
                          src={p.thumbnailUrl ?? p.mediaUrl ?? ''}
                          alt=""
                          className="h-14 w-14 shrink-0 rounded-lg object-cover"
                        />
                      ) : null}
                      <div className="min-w-0">
                        <div className="line-clamp-2 text-sm font-semibold text-gray-900">
                          {p.caption ?? '(no caption)'}
                        </div>
                        <div className="mt-0.5 text-[11px] text-gray-500">
                          {p.mediaType === 'VIDEO' ? 'Reel' : p.mediaType === 'CAROUSEL_ALBUM' ? 'Carousel' : 'Image'} · {fmtAgo(p.timestamp)}
                        </div>
                      </div>
                    </div>
                    <span
                      className={cn(
                        'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                        beat ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      )}
                    >
                      {beat ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {beat ? '+' : ''}
                      {diffPct}% vs avg
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 text-center">
                    <Metric icon={Heart} label="Likes" value={fmt(p.likeCount)} />
                    <Metric icon={MessageSquare} label="Comments" value={fmt(p.commentsCount)} />
                    <Metric icon={Eye} label="Total" value={fmt(interactions)} />
                  </div>
                </li>
              );
            })}
            {live && media.length === 0 && (
              <li className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-xs text-gray-500">
                Instagram returned no recent media.
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Eye; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 px-1.5 py-2">
      <Icon className="mx-auto h-3 w-3 text-gray-400" />
      <div className="mt-0.5 text-[13px] font-semibold text-gray-900">{value}</div>
      <div className="text-[9px] uppercase tracking-wide text-gray-400">{label}</div>
    </div>
  );
}
