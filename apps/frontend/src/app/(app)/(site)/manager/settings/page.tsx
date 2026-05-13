'use client';

import { useCallback, useEffect, useState } from 'react';
import { User2, Users, Bell, Plug, ChevronRight, Mail, Slack, CreditCard, FileSignature, Instagram, CheckCircle2, Loader2 } from 'lucide-react';
import { Badge } from '@gitroom/frontend/components/shadcn/ui/badge';
import { Button } from '@gitroom/frontend/components/shadcn/ui/button';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useVariables } from '@gitroom/react/helpers/variable.context';

type Section = 'profile' | 'team' | 'notifications' | 'integrations';

const fmtFollowers = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${Math.round(n / 1_000)}k` : `${n}`;

const sections: { key: Section; label: string; description: string; icon: typeof User2 }[] = [
  { key: 'profile', label: 'Profile', description: 'Your name, email and workspace', icon: User2 },
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
            {active === 'profile' && (
              <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="text-base font-semibold text-gray-900">Profile</h2>
                <p className="mt-1 text-xs text-gray-500">Visible to your team and on contracts</p>
                <div className="mt-5 flex flex-col gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">Display name</label>
                    <input
                      className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">Email</label>
                    <input
                      className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
                      placeholder="you@workspace.com"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">Workspace name</label>
                    <input
                      className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
                      placeholder="Illuminati HQ"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button className="h-11">Save changes</Button>
                  </div>
                </div>
              </section>
            )}

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
