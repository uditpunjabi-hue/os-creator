import { Injectable, Logger } from '@nestjs/common';

export type ThreadStatus = 'NEW_LEAD' | 'IN_NEGOTIATION' | 'CLOSED_WON' | 'CLOSED_LOST' | 'REJECTED';

export interface EmailMessage {
  id: string;
  from: string;
  to: string;
  at: string;
  body: string;
}

export interface EmailThread {
  id: string;
  brand: string;
  email: string;
  subject: string;
  preview: string;
  messages: EmailMessage[];
  status: ThreadStatus;
  starred: boolean;
  updatedAt: string;
  unread: boolean;
}

export interface ReplyInput {
  body: string;
  template?: string;
}

export interface EmailProvider {
  listThreads(orgId: string, query?: string): Promise<EmailThread[]>;
  getThread(orgId: string, threadId: string): Promise<EmailThread | null>;
  reply(orgId: string, threadId: string, body: ReplyInput): Promise<EmailThread | null>;
  setStatus(orgId: string, threadId: string, status: ThreadStatus): Promise<EmailThread | null>;
  setStarred(orgId: string, threadId: string, starred: boolean): Promise<EmailThread | null>;
  listTemplates(): Promise<{ id: string; name: string; subject: string; body: string }[]>;
}

const sampleTemplates = [
  {
    id: 'interested',
    name: 'Interested — ask for brief',
    subject: 'Re: {{subject}}',
    body:
      "Hi {{name}},\n\nThanks for reaching out — we'd love to learn more. Can you share the campaign brief, deliverable count, and budget range?\n\nBest,\n{{me}}",
  },
  {
    id: 'counter',
    name: 'Counter offer',
    subject: 'Re: {{subject}}',
    body:
      "Hi {{name}},\n\nThanks for the offer. Based on our creator's current rate card and the scope you described, we'd land at {{counter_amount}} for the package. Happy to walk through the breakdown on a quick call.\n\nBest,\n{{me}}",
  },
  {
    id: 'not_interested',
    name: 'Not interested — friendly close',
    subject: 'Re: {{subject}}',
    body:
      "Hi {{name}},\n\nReally appreciate you thinking of us. This particular fit doesn't align with our current focus, but please keep us in mind for future campaigns.\n\nBest,\n{{me}}",
  },
  {
    id: 'follow_up',
    name: 'Polite follow-up',
    subject: 'Following up on {{subject}}',
    body:
      "Hi {{name}},\n\nJust bumping this thread — wanted to make sure my last note didn't get buried. Happy to schedule a quick sync if that's easier.\n\nBest,\n{{me}}",
  },
];

const BRAND_KEYWORDS = [
  'partner',
  'collab',
  'collaboration',
  'campaign',
  'sponsor',
  'rate',
  'brief',
  'ambassador',
  'integration',
];

const seedThreads = (): EmailThread[] => {
  const now = Date.now();
  const ago = (h: number) => new Date(now - h * 60 * 60 * 1000).toISOString();
  return [
    {
      id: 'th-1',
      brand: 'Bloom & Co.',
      email: 'partnerships@bloom.co',
      subject: 'Partnership inquiry — Q3 reels',
      preview: "Hi, we'd love to discuss a paid integration for our Q3 launch...",
      messages: [
        {
          id: 'm1',
          from: 'partnerships@bloom.co',
          to: 'you@os-creator.app',
          at: ago(0.2),
          body:
            "Hi team,\n\nWe've been following Kira S. for a while and her aesthetic is exactly what we want for our Q3 campaign. We're looking at 3 reels + 5 stories over a 4-week window.\n\nOur usual budget for this scope is in the $4-6k range per creator. Open to discussing usage rights extensions on top of that.\n\nWould love to get on a call next week — let me know what works.\n\nBest,\nMira from Bloom & Co.",
        },
      ],
      status: 'NEW_LEAD',
      starred: true,
      updatedAt: ago(0.2),
      unread: true,
    },
    {
      id: 'th-2',
      brand: 'BrandLab',
      email: 'mira@thebrandlab.com',
      subject: 'Re: Counter on the rate card',
      preview: 'Thanks for the deck. On the rate, we can stretch to 4,200 USD...',
      messages: [
        {
          id: 'm1',
          from: 'mira@thebrandlab.com',
          to: 'you@os-creator.app',
          at: ago(2),
          body:
            "Hey,\n\nThanks for the deck — it's tight and easy to share internally. On the rate, we can stretch to $4,200 per reel and offer a 90-day organic usage window included.\n\nLet me know if Nimo R. is open at that number and I'll send over the contract.\n\n— Mira",
        },
        {
          id: 'm2',
          from: 'you@os-creator.app',
          to: 'mira@thebrandlab.com',
          at: ago(1),
          body:
            "Hi Mira,\n\nAppreciate the move. Nimo is open at $4,400 per reel with the 90-day window. Can we hold there? Happy to lock today.\n\nBest,\nYou",
        },
      ],
      status: 'IN_NEGOTIATION',
      starred: false,
      updatedAt: ago(1),
      unread: true,
    },
    {
      id: 'th-3',
      brand: 'Swift Athletics',
      email: 'alex@swiftroster.io',
      subject: 'Contract countersigned',
      preview: 'Attached is the signed copy. Welcome aboard!',
      messages: [
        {
          id: 'm1',
          from: 'alex@swiftroster.io',
          to: 'you@os-creator.app',
          at: ago(28),
          body: 'Attached is the signed copy. Welcome aboard! Looking forward to seeing the first cut next week.',
        },
      ],
      status: 'CLOSED_WON',
      starred: false,
      updatedAt: ago(28),
      unread: false,
    },
    {
      id: 'th-4',
      brand: 'Nimbus',
      email: 'partners@nimbus.app',
      subject: 'Re: Brief feedback',
      preview: 'Quick one — can we slot in one more carousel for the launch week?',
      messages: [
        {
          id: 'm1',
          from: 'partners@nimbus.app',
          to: 'you@os-creator.app',
          at: ago(72),
          body:
            "Quick one — can we slot in one more carousel for the launch week? Same rate as the others, just one more deliverable. Should fit your influencer's existing capture day.\n\nLet me know!",
        },
      ],
      status: 'IN_NEGOTIATION',
      starred: false,
      updatedAt: ago(72),
      unread: false,
    },
    {
      id: 'th-5',
      brand: 'Aero',
      email: 'collabs@aero.fit',
      subject: 'Holiday gift drop?',
      preview: "We're doing a gift drop in December and would love to include 2 of your creators...",
      messages: [
        {
          id: 'm1',
          from: 'collabs@aero.fit',
          to: 'you@os-creator.app',
          at: ago(120),
          body: "We're doing a gift drop in December and would love to include 2 of your creators. No posting obligation — just a thank-you box. Open to it?",
        },
      ],
      status: 'NEW_LEAD',
      starred: false,
      updatedAt: ago(120),
      unread: true,
    },
    {
      id: 'th-6',
      brand: 'Holt',
      email: 'sam@holt.studio',
      subject: 'Budget cap reached this quarter',
      preview: "Really like the proposal but our budget is locked for Q3...",
      messages: [
        {
          id: 'm1',
          from: 'sam@holt.studio',
          to: 'you@os-creator.app',
          at: ago(168),
          body: "Hi,\n\nReally like the proposal but our budget is locked for Q3. We'll circle back in October when planning reopens.\n\nThanks,\nSam",
        },
      ],
      status: 'REJECTED',
      starred: false,
      updatedAt: ago(168),
      unread: false,
    },
  ];
};

@Injectable()
export class MockEmailProvider implements EmailProvider {
  private readonly logger = new Logger(MockEmailProvider.name);
  private readonly threadsByOrg = new Map<string, EmailThread[]>();

  private getOrSeed(orgId: string): EmailThread[] {
    if (!this.threadsByOrg.has(orgId)) {
      this.threadsByOrg.set(orgId, seedThreads());
    }
    return this.threadsByOrg.get(orgId)!;
  }

  async listThreads(orgId: string, query?: string): Promise<EmailThread[]> {
    let rows = this.getOrSeed(orgId);
    // Auto-tag: anything matching brand keywords and still NEW_LEAD stays NEW_LEAD;
    // anything not matching gets a hint but we don't reclassify in mock.
    if (query) {
      const q = query.toLowerCase();
      rows = rows.filter(
        (t) =>
          t.brand.toLowerCase().includes(q) ||
          t.subject.toLowerCase().includes(q) ||
          t.preview.toLowerCase().includes(q) ||
          t.messages.some((m) => m.body.toLowerCase().includes(q))
      );
    }
    return [...rows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getThread(orgId: string, threadId: string): Promise<EmailThread | null> {
    const t = this.getOrSeed(orgId).find((x) => x.id === threadId);
    if (!t) return null;
    if (t.unread) t.unread = false;
    return t;
  }

  async reply(orgId: string, threadId: string, body: ReplyInput): Promise<EmailThread | null> {
    const rows = this.getOrSeed(orgId);
    const t = rows.find((x) => x.id === threadId);
    if (!t) return null;
    t.messages.push({
      id: `m${t.messages.length + 1}`,
      from: 'you@os-creator.app',
      to: t.email,
      at: new Date().toISOString(),
      body: body.body,
    });
    t.updatedAt = new Date().toISOString();
    if (t.status === 'NEW_LEAD') t.status = 'IN_NEGOTIATION';
    this.logger.log(`[mock email] reply queued for ${threadId} (real Gmail send disabled)`);
    return t;
  }

  async setStatus(orgId: string, threadId: string, status: ThreadStatus): Promise<EmailThread | null> {
    const t = this.getOrSeed(orgId).find((x) => x.id === threadId);
    if (!t) return null;
    t.status = status;
    return t;
  }

  async setStarred(orgId: string, threadId: string, starred: boolean): Promise<EmailThread | null> {
    const t = this.getOrSeed(orgId).find((x) => x.id === threadId);
    if (!t) return null;
    t.starred = starred;
    return t;
  }

  async listTemplates() {
    return sampleTemplates;
  }
}

export const EMAIL_PROVIDER_TOKEN = 'EMAIL_PROVIDER';
export const isBrandKeyword = (text: string) =>
  BRAND_KEYWORDS.some((k) => text.toLowerCase().includes(k));
