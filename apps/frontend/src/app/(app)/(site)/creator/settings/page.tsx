'use client';

import { Instagram, Youtube, Music2, Twitter, AtSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@gitroom/frontend/components/shadcn/ui/card';
import { Button } from '@gitroom/frontend/components/shadcn/ui/button';
import { Badge } from '@gitroom/frontend/components/shadcn/ui/badge';
import { Input } from '@gitroom/frontend/components/shadcn/ui/input';
import { PageHeader, PageBody, ComingSoonBanner } from '@gitroom/frontend/components/shadcn/page-header';

const accounts = [
  { name: 'Instagram', icon: Instagram, connected: false },
  { name: 'YouTube', icon: Youtube, connected: false },
  { name: 'TikTok', icon: Music2, connected: false },
  { name: 'X', icon: Twitter, connected: false },
  { name: 'Threads', icon: AtSign, connected: false },
];

export default function CreatorSettings() {
  return (
    <>
      <PageHeader title="Settings" description="Profile, social connections, and preferences." />
      <PageBody className="flex flex-col gap-6">
        <ComingSoonBanner feature="OAuth-based social account connections" />

        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Display name</label>
              <Input placeholder="Your name" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Primary handle</label>
              <Input placeholder="@your.handle" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-500">Bio</label>
              <Input placeholder="Short bio for your profile" />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button>Save profile</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Connected accounts</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {accounts.map((a) => {
              const Icon = a.icon;
              return (
                <div key={a.name} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50 text-gray-700">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{a.name}</div>
                      <div className="text-xs text-gray-500">{a.connected ? 'Connected' : 'Not connected'}</div>
                    </div>
                  </div>
                  {a.connected ? (
                    <Badge variant="success">Connected</Badge>
                  ) : (
                    <Button variant="outline" size="sm">Connect</Button>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
