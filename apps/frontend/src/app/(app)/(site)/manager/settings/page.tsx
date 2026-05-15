'use client';

import { useCallback, useEffect, useState } from 'react';
import { User2, Users, Bell, Plug, ChevronRight, Mail, Slack, CreditCard, FileSignature, Instagram, CheckCircle2, Loader2, IndianRupee } from 'lucide-react';
import { Badge } from '@gitroom/frontend/components/shadcn/ui/badge';
import { Button } from '@gitroom/frontend/components/shadcn/ui/button';
import { Input } from '@gitroom/frontend/components/shadcn/ui/input';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import {
  useManagerProfile,
  useRateCard,
  useManagerMutations,
} from '@gitroom/frontend/hooks/manager';

type Section = 'profile' | 'rates' | 'team' | 'notifications' | 'integrations';

const fmtFollowers = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${Math.round(n / 1_000)}k` : `${n}`;

const sections: { key: Section; label: string; description: string; icon: typeof User2 }[] = [
  { key: 'profile', label: 'Profile', description: 'Your name, email and workspace', icon: User2 },
  { key: 'rates', label: 'Rate card', description: 'Per-deliverable pricing the deal advisor uses', icon: IndianRupee },
  { key: 'team', label: 'Team', description: 'Invite teammates and assign roles', icon: Users },
  { key: 'notifications', label: 'Notifications', description: 'How and when we tell you things', icon: Bell },
  { key: 'integrations', label: 'API connections', description: 'Connect Gmail, Stripe and more', icon: Plug },
];

const team = [
  { name: 'You', email: 'opnclaw123@gmail.com', role: 'Owner' },
  { name: 'Mira K.', email: 'mira@Illuminati.app', role: 'Admin' },
  { name: 'Devansh R.', email: 'dev@Illuminati.app', role: 'Member' },
];

const notifyOptions = [
  { key: 'leads', label: 'New leads in the inbox', defaultOn: true },
  { key: 'stage', label: 'Stage changes on deals', defaultOn: true },
  { key: 'overdue', label: 'Overdue invoices', defaultOn: true },
  { key: 'contracts', label: 'Contracts awaiting signature', defaultOn: false },
];

export default function SettingsPage() {
  const [active, setActive] = useState<Section>('profile');

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-gray-200 bg-white px-4 py-3 lg:px-8 lg:py-5">
        <div className="text-lg font-semibold text-gray-900">Settings</div>
        <div className="text-xs text-gray-500">Workspace configuration</div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 lg:px-8 lg:py-6">
        <nav className="-mx-1 mb-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
          {sections.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setActive(s.key)}
              className={
                active === s.key
                  ? 'shrink-0 rounded-full bg-purple-600 px-4 py-2 text-xs font-medium text-white shadow-sm min-h-[44px]'
                  : 'shrink-0 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-medium text-gray-700 min-h-[44px]'
              }
            >
              {s.label}
            </button>
          ))}
        </nav>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
          <aside className="hidden lg:block">
            <ul className="flex flex-col gap-1 rounded-2xl border border-gray-200 bg-white p-2 shadow-sm">
              {sections.map((s) => {
                const Icon = s.icon;
                const isActive = active === s.key;
                return (
                  <li key={s.key}>
                    <button
                      type="button"
                      onClick={() => setActive(s.key)}
                      className={
                        isActive
                          ? 'flex w-full items-center gap-3 rounded-xl bg-purple-50 px-3 py-3 text-left text-sm font-medium text-purple-700'
                          : 'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-gray-700 hover:bg-gray-50'
                      }
                    >
                      <Icon className="h-4 w-4" />
                      <div className="flex-1">
                        <div>{s.label}</div>
                        <div className="text-xs text-gray-400">{s.description}</div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-300" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          <div className="flex flex-col gap-4">
            {active === 'profile' && <ProfilePanel />}
            {active === 'rates' && <RateCardPanel />}

            {active === 'team' && (
              <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="text-base font-semibold text-gray-900">Team</h2>
                <p className="mt-1 text-xs text-gray-500">Who can see and act on this workspace</p>
                <ul className="mt-5 flex flex-col gap-2">
                  {team.map((t) => (
                    <li key={t.email} className="flex items-center justify-between rounded-xl border border-gray-200 p-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-gray-900">{t.name}</div>
                        <div className="truncate text-xs text-gray-500">{t.email}</div>
                      </div>
                      <Badge variant={t.role === 'Owner' ? 'default' : 'secondary'}>{t.role}</Badge>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <input
                    placeholder="teammate@email.com"
                    className="h-11 flex-1 rounded-xl border border-gray-200 px-3 text-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
                  />
                  <Button className="h-11">Send invite</Button>
                </div>
              </section>
            )}

            {active === 'notifications' && (
              <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="text-base font-semibold text-gray-900">Notifications</h2>
                <p className="mt-1 text-xs text-gray-500">Pick what we surface to you</p>
                <ul className="mt-5 flex flex-col gap-2">
                  {notifyOptions.map((n) => (
                    <li
                      key={n.key}
                      className="flex items-center justify-between rounded-xl border border-gray-200 p-3 min-h-[60px]"
                    >
                      <span className="text-sm text-gray-800">{n.label}</span>
                      <input type="checkbox" defaultChecked={n.defaultOn} className="h-5 w-5 accent-purple-600" />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {active === 'integrations' && <IntegrationsPanel />}
          </div>
        </div>
      </div>
    </div>
  );
}

interface ConnectionStatus {
  google: { connected: boolean; email?: string | null; connectedAt?: string | null };
  instagram: { connected: boolean; handle?: string | null; followers?: number | null; connectedAt?: string | null };
}

function IntegrationsPanel() {
  const fetch = useFetch();
  const { backendUrl } = useVariables();
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [busy, setBusy] = useState<'instagram' | 'google' | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await fetch('/connections');
      if (!res.ok) {
        setStatus({ google: { connected: false }, instagram: { connected: false } });
        return;
      }
      const data = (await res.json()) as ConnectionStatus;
      setStatus(data);
    } catch {
      setStatus({ google: { connected: false }, instagram: { connected: false } });
    }
  }, [fetch]);

  useEffect(() => {
    reload();
  }, [reload]);

  const disconnect = async (provider: 'instagram' | 'google') => {
    setBusy(provider);
    try {
      await fetch(`/connections/${provider}/disconnect`, { method: 'POST' });
      await reload();
    } finally {
      setBusy(null);
    }
  };

  const connect = (provider: 'instagram' | 'google') => {
    window.location.href = `${backendUrl}/oauth/${provider}/start`;
  };

  const accounts: Array<{
    key: 'instagram' | 'google';
    name: string;
    description: string;
    icon: typeof Instagram;
    accent: string;
    connected: boolean;
    label: string | null;
  }> = [
    {
      key: 'instagram',
      name: 'Instagram',
      description: 'Profile, followers, post performance',
      icon: Instagram,
      accent: '#E1306C',
      connected: !!status?.instagram.connected,
      label: status?.instagram.handle
        ? `${status.instagram.handle}${status.instagram.followers ? ` · ${fmtFollowers(status.instagram.followers)} followers` : ''}`
        : null,
    },
    {
      key: 'google',
      name: 'Google · Gmail + Calendar + Drive',
      description: 'Inbox, schedule, contract uploads',
      icon: Mail,
      accent: '#F59E0B',
      connected: !!status?.google.connected,
      label: status?.google.email ?? null,
    },
  ];

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-gray-900">Connected accounts</h2>
      <p className="mt-1 text-xs text-gray-500">
        Authorize the apps your AI manager works on your behalf with
      </p>
      <ul className="mt-5 flex flex-col gap-2">
        {accounts.map((a) => {
          const Icon = a.icon;
          return (
            <li
              key={a.key}
              className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 min-h-[64px]"
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{
                  backgroundColor: a.connected
                    ? 'rgba(16,185,129,0.16)'
                    : `${a.accent}22`,
                  color: a.connected ? '#34D399' : a.accent,
                }}
              >
                {a.connected ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900">{a.name}</div>
                <div className="truncate text-xs text-gray-500">
                  {a.connected ? a.label ?? 'Connected' : a.description}
                </div>
              </div>
              {a.connected ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9"
                  disabled={busy === a.key}
                  onClick={() => disconnect(a.key)}
                >
                  {busy === a.key ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Disconnect'}
                </Button>
              ) : (
                <Button size="sm" className="h-9" onClick={() => connect(a.key)}>
                  Connect
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-5">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Other integrations
        </div>
        <ul className="flex flex-col gap-2">
          {[
            { name: 'Stripe', description: 'Receive brand payouts', icon: CreditCard },
            { name: 'DocuSign', description: 'Send contracts for e-signature', icon: FileSignature },
            { name: 'Slack', description: 'Pipeline alerts in your channel', icon: Slack },
          ].map((i) => {
            const Icon = i.icon;
            return (
              <li
                key={i.name}
                className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 min-h-[60px]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50 text-gray-700">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900">{i.name}</div>
                  <div className="text-xs text-gray-500">{i.description}</div>
                </div>
                <Button variant="outline" size="sm" className="h-9" disabled>
                  Soon
                </Button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Profile panel — wired to /manager/settings/profile. Disconnect buttons hit
// /manager/settings/disconnect/[provider] which clears the OAuth handles and
// purges related caches.
// ---------------------------------------------------------------------------

function ProfilePanel() {
  const { data, isLoading } = useManagerProfile();
  const { saveProfile, disconnectProvider } = useManagerMutations();
  const [draft, setDraft] = useState({ name: '', lastName: '', companyName: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setDraft({
      name: data.name ?? '',
      lastName: data.lastName ?? '',
      companyName: data.companyName ?? '',
    });
  }, [data]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await saveProfile(draft);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading && !data) {
    return (
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading profile…
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-gray-900">Profile</h2>
      <p className="mt-1 text-xs text-gray-500">Visible to your team and on contracts</p>
      <div className="mt-5 flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormRow label="First name">
            <Input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Your name"
            />
          </FormRow>
          <FormRow label="Last name">
            <Input
              value={draft.lastName}
              onChange={(e) => setDraft({ ...draft, lastName: e.target.value })}
              placeholder="Optional"
            />
          </FormRow>
        </div>
        <FormRow label="Email (read-only)">
          <Input value={data?.email ?? ''} readOnly className="bg-gray-50" />
        </FormRow>
        <FormRow label="Company / workspace name">
          <Input
            value={draft.companyName}
            onChange={(e) => setDraft({ ...draft, companyName: e.target.value })}
            placeholder="Your company"
          />
        </FormRow>
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
            {error}
          </div>
        )}
        <div className="flex items-center justify-end gap-2">
          {saved && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> Saved
            </span>
          )}
          <Button className="h-11" onClick={save} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              'Save changes'
            )}
          </Button>
        </div>
      </div>

      <h3 className="mt-8 text-sm font-semibold text-gray-900">Connected accounts</h3>
      <p className="mt-1 text-xs text-gray-500">
        Quick disconnect — re-link from API connections to reconnect.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        <ConnectedRow
          label="Instagram"
          accent="#E1306C"
          icon={Instagram}
          connected={data?.connections.instagram.connected ?? false}
          detail={
            data?.connections.instagram.handle
              ? `${data.connections.instagram.handle}${
                  data.connections.instagram.followers
                    ? ` · ${fmtFollowers(data.connections.instagram.followers)} followers`
                    : ''
                }`
              : null
          }
          onDisconnect={() => disconnectProvider('instagram')}
        />
        <ConnectedRow
          label="Google · Gmail + Calendar + Drive"
          accent="#F59E0B"
          icon={Mail}
          connected={data?.connections.google.connected ?? false}
          detail={data?.connections.google.email ?? null}
          onDisconnect={() => disconnectProvider('google')}
        />
      </div>
    </section>
  );
}

function ConnectedRow({
  label,
  accent,
  icon: Icon,
  connected,
  detail,
  onDisconnect,
}: {
  label: string;
  accent: string;
  icon: typeof Instagram;
  connected: boolean;
  detail: string | null;
  onDisconnect: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 p-3">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white"
        style={{ backgroundColor: connected ? accent : '#E5E7EB' }}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-gray-900">{label}</div>
        <div className="truncate text-xs text-gray-500">
          {connected ? detail ?? 'Connected' : 'Not connected'}
        </div>
      </div>
      {connected && (
        <button
          type="button"
          onClick={async () => {
            if (busy) return;
            if (!confirm(`Disconnect ${label.split(' ')[0]}?`)) return;
            setBusy(true);
            try {
              await onDisconnect();
            } finally {
              setBusy(false);
            }
          }}
          className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-rose-300 hover:text-rose-700 disabled:opacity-50"
          disabled={busy}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Disconnect'}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rate Card editor — per-deliverable pricing the AI Deal Advisor uses as the
// creator's floor. Bundle / Post fields map to brandIntegRate / ugcRate in
// the DB.
// ---------------------------------------------------------------------------

function RateCardPanel() {
  const { data, isLoading } = useRateCard();
  const { saveRateCard } = useManagerMutations();
  const [draft, setDraft] = useState({
    reelRate: '',
    postRate: '',
    storyRate: '',
    carouselRate: '',
    bundleRate: '',
    exclusivityRate: '',
    currency: 'INR',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setDraft({
      reelRate: data.reelRate != null ? String(data.reelRate) : '',
      postRate: data.ugcRate != null ? String(data.ugcRate) : '',
      storyRate: data.storyRate != null ? String(data.storyRate) : '',
      carouselRate: data.carouselRate != null ? String(data.carouselRate) : '',
      bundleRate: data.brandIntegRate != null ? String(data.brandIntegRate) : '',
      exclusivityRate: data.exclusivityRate != null ? String(data.exclusivityRate) : '',
      currency: data.currency ?? 'INR',
      notes: data.notes ?? '',
    });
  }, [data]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      // Empty string → null clears the row's field; numeric strings go as-is
      // and the server parses them into Decimal.
      const num = (v: string) => (v.trim() === '' ? null : Number(v));
      await saveRateCard({
        reelRate: num(draft.reelRate),
        postRate: num(draft.postRate),
        storyRate: num(draft.storyRate),
        carouselRate: num(draft.carouselRate),
        bundleRate: num(draft.bundleRate),
        exclusivityRate: num(draft.exclusivityRate),
        currency: draft.currency,
        notes: draft.notes,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading && !data) {
    return (
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading rate card…
        </div>
      </section>
    );
  }

  const fields: Array<{ key: keyof typeof draft; label: string; hint: string }> = [
    { key: 'reelRate', label: 'Reel', hint: 'Standard 15-30s reel' },
    { key: 'postRate', label: 'Post (image)', hint: 'Single in-feed image' },
    { key: 'storyRate', label: 'Story', hint: 'Per-frame, 24h' },
    { key: 'carouselRate', label: 'Carousel', hint: 'Multi-slide post' },
    { key: 'bundleRate', label: 'Bundle deal', hint: 'Reel + post + story' },
    { key: 'exclusivityRate', label: 'Category exclusivity', hint: 'Extra for category lock' },
  ];

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-gray-900">Rate card</h2>
      <p className="mt-1 text-xs text-gray-500">
        Per-deliverable pricing. The AI deal advisor uses these as your floor when scoring offers.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <FormRow key={f.key} label={f.label} hint={f.hint}>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">
                {draft.currency === 'USD' ? '$' : draft.currency === 'INR' ? '₹' : draft.currency}
              </span>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                value={draft[f.key]}
                onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                placeholder="0"
                className="pl-7"
              />
            </div>
          </FormRow>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[120px_1fr]">
        <FormRow label="Currency">
          <select
            value={draft.currency}
            onChange={(e) => setDraft({ ...draft, currency: e.target.value })}
            className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
          >
            <option value="INR">INR (₹)</option>
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
          </select>
        </FormRow>
        <FormRow label="Notes" hint="Anything brand reps should know">
          <Input
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            placeholder="e.g. usage rights capped at 90 days unless re-negotiated"
          />
        </FormRow>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {error}
        </div>
      )}

      <div className="mt-5 flex items-center justify-end gap-2">
        {saved && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Saved
          </span>
        )}
        <Button className="h-11" onClick={save} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Saving…
            </>
          ) : (
            'Save rate card'
          )}
        </Button>
      </div>
    </section>
  );
}

function FormRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-gray-700">{label}</span>
      {children}
      {hint && <span className="text-[10px] text-gray-400">{hint}</span>}
    </label>
  );
}
