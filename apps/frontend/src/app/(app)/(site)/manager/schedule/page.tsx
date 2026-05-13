'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  Loader2,
  Send,
  Trash2,
  Sparkles,
  Phone,
  AlarmClock,
  FileSignature,
} from 'lucide-react';
import { Button } from '@gitroom/frontend/components/shadcn/ui/button';
import { Badge } from '@gitroom/frontend/components/shadcn/ui/badge';
import { Modal } from '@gitroom/frontend/components/shadcn/ui/modal';
import { Input } from '@gitroom/frontend/components/shadcn/ui/input';
import {
  useCalendarEvents,
  useInfluencers,
  useManagerMutations,
  useScheduledPosts,
  type CalendarEventRow,
  type Platform,
  type PostKind,
} from '@gitroom/frontend/hooks/manager';
import { cn } from '@gitroom/frontend/lib/utils';

const kindIcon: Record<CalendarEventRow['kind'], React.ComponentType<{ className?: string }>> = {
  BRAND_CALL: Phone,
  POST_SCHEDULED: Send,
  DEAL_DEADLINE: AlarmClock,
  CONTRACT_EXPIRES: FileSignature,
};
const kindTone: Record<CalendarEventRow['kind'], string> = {
  BRAND_CALL: 'bg-purple-50 text-purple-700',
  POST_SCHEDULED: 'bg-blue-50 text-blue-700',
  DEAL_DEADLINE: 'bg-amber-50 text-amber-700',
  CONTRACT_EXPIRES: 'bg-red-50 text-red-700',
};
const platformLabel: Record<Platform, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  x: 'X',
};

const fmtDate = (s: string) => {
  const d = new Date(s);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export default function SchedulePage() {
  const { data: events, isLoading: loadingEvents } = useCalendarEvents();
  const { data: posts, isLoading: loadingPosts } = useScheduledPosts();
  const { data: influencers } = useInfluencers();
  const { deleteScheduledPost, deleteCalendarEvent } = useManagerMutations();
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [eventModalOpen, setEventModalOpen] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-col gap-3 border-b border-gray-200 bg-white px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-5">
        <div>
          <div className="text-lg font-semibold text-gray-900">Schedule</div>
          <div className="text-xs text-gray-500">
            Brand calls, post drops, and deadlines in one timeline
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="h-11" onClick={() => setEventModalOpen(true)}>
            <CalendarIcon className="h-4 w-4" /> New event
          </Button>
          <Button
            className="h-11"
            onClick={() => setPostModalOpen(true)}
            disabled={(influencers?.length ?? 0) === 0}
          >
            <Plus className="h-4 w-4" /> Schedule post
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 lg:px-8 lg:py-6">
        <div className="rounded-2xl border border-purple-200 bg-purple-50/40 p-3 text-xs text-purple-900">
          <Sparkles className="mr-1 inline h-3 w-3" />
          Posts are routed through a mock publishing adapter. Wire your Ayrshare key under Settings → Integrations to enable multi-platform publishing for real.
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section>
            <h2 className="mb-2 text-sm font-semibold text-gray-900">Upcoming events</h2>
            {loadingEvents && !events ? (
              <div className="flex items-center justify-center rounded-2xl border border-gray-200 bg-white py-8 text-sm text-gray-400">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : (events ?? []).length === 0 ? (
              <EmptyBox text="No upcoming events. Add a brand call or sync your Google Calendar." />
            ) : (
              <ul className="flex flex-col gap-2">
                {(events ?? []).map((ev) => {
                  const Icon = kindIcon[ev.kind];
                  return (
                    <li
                      key={ev.id}
                      className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
                    >
                      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', kindTone[ev.kind])}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-900">{ev.title}</div>
                        <div className="text-xs text-gray-500">{fmtDate(ev.startsAt)}</div>
                        {ev.description && (
                          <div className="mt-1 text-xs text-gray-600">{ev.description}</div>
                        )}
                      </div>
                      <button
                        onClick={async () => {
                          if (!confirm(`Delete event "${ev.title}"?`)) return;
                          try {
                            await deleteCalendarEvent(ev.id);
                          } catch (e) {
                            alert((e as Error).message);
                          }
                        }}
                        className="rounded-lg p-1 text-gray-300 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-gray-900">Scheduled posts</h2>
            {loadingPosts && !posts ? (
              <div className="flex items-center justify-center rounded-2xl border border-gray-200 bg-white py-8 text-sm text-gray-400">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : (posts ?? []).length === 0 ? (
              <EmptyBox text="No scheduled posts yet. Click 'Schedule post' to draft one for any creator." />
            ) : (
              <ul className="flex flex-col gap-2">
                {(posts ?? []).map((p) => (
                  <li
                    key={p.id}
                    className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-900">
                          {p.influencerName} · {p.kind.charAt(0) + p.kind.slice(1).toLowerCase()}
                        </div>
                        <div className="text-xs text-gray-500">{fmtDate(p.scheduledAt)}</div>
                        <p className="mt-2 line-clamp-2 text-xs text-gray-700">{p.caption}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {p.platforms.map((pl) => (
                            <Badge key={pl} variant="outline">
                              {platformLabel[pl]}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant={p.status === 'PUBLISHED' ? 'success' : p.status === 'FAILED' ? 'destructive' : 'default'}>
                          {p.status}
                        </Badge>
                        <button
                          onClick={async () => {
                            if (!confirm('Delete scheduled post?')) return;
                            try {
                              await deleteScheduledPost(p.id);
                            } catch (e) {
                              alert((e as Error).message);
                            }
                          }}
                          className="rounded-lg p-1 text-gray-300 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <SchedulePostModal
        open={postModalOpen}
        onClose={() => setPostModalOpen(false)}
        influencers={influencers ?? []}
      />
      <CreateEventModal open={eventModalOpen} onClose={() => setEventModalOpen(false)} />
    </div>
  );
}

function EmptyBox({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-6 text-center text-xs text-gray-500">
      {text}
    </div>
  );
}

function SchedulePostModal({
  open,
  onClose,
  influencers,
}: {
  open: boolean;
  onClose: () => void;
  influencers: { id: string; name: string }[];
}) {
  const { schedulePost } = useManagerMutations();
  const [form, setForm] = useState({
    influencerId: '',
    caption: '',
    kind: 'REEL' as PostKind,
    platforms: ['instagram'] as Platform[],
    scheduledAt: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && !form.influencerId && influencers.length > 0) {
      setForm((f) => ({ ...f, influencerId: influencers[0].id }));
    }
  }, [open, influencers]);

  const togglePlatform = (p: Platform) => {
    setForm((f) => ({
      ...f,
      platforms: f.platforms.includes(p)
        ? f.platforms.filter((x) => x !== p)
        : [...f.platforms, p],
    }));
  };

  const submit = async () => {
    if (!form.influencerId) return setError('Pick an influencer');
    if (!form.caption.trim()) return setError('Caption is required');
    if (form.platforms.length === 0) return setError('Pick at least one platform');
    if (!form.scheduledAt) return setError('Pick a scheduled time');
    setSubmitting(true);
    setError(null);
    try {
      const inf = influencers.find((i) => i.id === form.influencerId);
      await schedulePost({
        influencerId: form.influencerId,
        influencerName: inf?.name ?? 'Unknown',
        caption: form.caption.trim(),
        kind: form.kind,
        platforms: form.platforms,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
      });
      setForm({ influencerId: '', caption: '', kind: 'REEL', platforms: ['instagram'], scheduledAt: '' });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Schedule post"
      description="Drafts a multi-platform post (mock until Ayrshare key is added)."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} className="h-11">
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting} className="h-11">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Schedule
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
        )}
        <FieldGroup label="Influencer *">
          <select
            value={form.influencerId}
            onChange={(e) => setForm((f) => ({ ...f, influencerId: e.target.value }))}
            className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
          >
            {influencers.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </FieldGroup>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="Type">
            <select
              value={form.kind}
              onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as PostKind }))}
              className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
            >
              <option value="IMAGE">Image</option>
              <option value="CAROUSEL">Carousel</option>
              <option value="REEL">Reel</option>
              <option value="STORY">Story</option>
            </select>
          </FieldGroup>
          <FieldGroup label="Schedule for *">
            <Input
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
            />
          </FieldGroup>
        </div>
        <FieldGroup label="Platforms *">
          <div className="flex flex-wrap gap-2">
            {(['instagram', 'tiktok', 'youtube', 'linkedin', 'x'] as Platform[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => togglePlatform(p)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors min-h-[36px]',
                  form.platforms.includes(p)
                    ? 'border-purple-300 bg-purple-100 text-purple-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-purple-200'
                )}
              >
                {platformLabel[p]}
              </button>
            ))}
          </div>
        </FieldGroup>
        <FieldGroup label="Caption *">
          <textarea
            value={form.caption}
            onChange={(e) => setForm((f) => ({ ...f, caption: e.target.value }))}
            placeholder="What's the post about?"
            className="min-h-[100px] resize-y rounded-lg border border-gray-200 bg-white p-3 text-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
          />
        </FieldGroup>
      </div>
    </Modal>
  );
}

function CreateEventModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { createCalendarEvent } = useManagerMutations();
  const [form, setForm] = useState({
    title: '',
    startsAt: '',
    endsAt: '',
    kind: 'BRAND_CALL' as CalendarEventRow['kind'],
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!form.title.trim()) return setError('Title is required');
    if (!form.startsAt) return setError('Start time is required');
    if (!form.endsAt) return setError('End time is required');
    setSubmitting(true);
    setError(null);
    try {
      await createCalendarEvent({
        title: form.title.trim(),
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
        kind: form.kind,
        description: form.description.trim() || undefined,
      });
      setForm({ title: '', startsAt: '', endsAt: '', kind: 'BRAND_CALL', description: '' });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New event"
      description="Brand call, deadline, or any reminder."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} className="h-11">
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting} className="h-11">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Create
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
        )}
        <FieldGroup label="Title *">
          <Input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Bloom & Co. kickoff call"
          />
        </FieldGroup>
        <FieldGroup label="Type">
          <select
            value={form.kind}
            onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as CalendarEventRow['kind'] }))}
            className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
          >
            <option value="BRAND_CALL">Brand call</option>
            <option value="POST_SCHEDULED">Post scheduled</option>
            <option value="DEAL_DEADLINE">Deal deadline</option>
            <option value="CONTRACT_EXPIRES">Contract expires</option>
          </select>
        </FieldGroup>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="Start *">
            <Input
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
            />
          </FieldGroup>
          <FieldGroup label="End *">
            <Input
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
            />
          </FieldGroup>
        </div>
        <FieldGroup label="Notes">
          <Input
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Discuss campaign scope"
          />
        </FieldGroup>
      </div>
    </Modal>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-700">
      <span>{label}</span>
      {children}
    </label>
  );
}
