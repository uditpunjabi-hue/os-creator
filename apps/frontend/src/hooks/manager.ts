'use client';

import useSWR, { mutate as globalMutate } from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useCallback } from 'react';

export type DealStageKey =
  | 'LEAD'
  | 'PROPOSAL_SENT'
  | 'NEGOTIATING'
  | 'CONTRACT'
  | 'PAYMENT'
  | 'COMPLETED';

export type PaymentStatusKey = 'PENDING' | 'INVOICED' | 'PAID' | 'OVERDUE';

export interface DealRow {
  id: string;
  organizationId: string;
  brand: string;
  influencerId: string;
  influencer?: { id: string; name: string; handle: string | null };
  offer: number;
  floor: number | null;
  ceiling: number | null;
  stage: DealStageKey;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InfluencerRow {
  id: string;
  organizationId: string;
  name: string;
  handle: string | null;
  platform: string;
  followers: number | null;
  engagement: number | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { deals: number; commercials: number };
}

export interface PaymentRow {
  id: string;
  organizationId: string;
  influencerId: string;
  influencer?: { id: string; name: string; handle: string | null };
  dealId: string | null;
  brand: string;
  description: string | null;
  amount: number;
  currency: string;
  dueAt: string | null;
  invoicedAt: string | null;
  paidAt: string | null;
  paymentStatus: PaymentStatusKey;
  computedOverdue?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentSummary {
  pending: number;
  overdue: number;
  paid: number;
  counts: Record<string, { amount: number; count: number }>;
}

export type ThreadStatus =
  | 'NEW_LEAD'
  | 'IN_NEGOTIATION'
  | 'CLOSED_WON'
  | 'CLOSED_LOST'
  | 'REJECTED';

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
  isBrand: boolean;
}

export interface InboxTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

export interface CalendarEventRow {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  kind: 'BRAND_CALL' | 'POST_SCHEDULED' | 'DEAL_DEADLINE' | 'CONTRACT_EXPIRES';
  description?: string;
}

export type Platform = 'instagram' | 'tiktok' | 'youtube' | 'linkedin' | 'x';
export type PostKind = 'IMAGE' | 'CAROUSEL' | 'REEL' | 'STORY';

export interface ScheduledPostRow {
  id: string;
  influencerId: string;
  influencerName: string;
  caption: string;
  kind: PostKind;
  platforms: Platform[];
  scheduledAt: string;
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED';
}

export interface ContractRow {
  id: string;
  organizationId: string;
  brand: string;
  templateName: string;
  influencerId: string | null;
  dealId: string | null;
  status: 'DRAFT' | 'SENT' | 'SIGNED' | 'EXPIRED';
  sentAt: string | null;
  signedAt: string | null;
  expiresAt: string | null;
  documentUrl: string | null;
  expiringSoon?: boolean;
  expired?: boolean;
  createdAt: string;
  updatedAt: string;
}

const useJsonLoader = () => {
  const fetch = useFetch();
  return useCallback(
    async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${url} failed: ${res.status}`);
      return res.json();
    },
    [fetch]
  );
};

export const useDeals = () => {
  const load = useJsonLoader();
  return useSWR<DealRow[]>('/manager/deals', load);
};

export interface DealAdvice {
  score: number;
  verdict: 'STRONG' | 'FAIR' | 'WEAK' | 'WALK_AWAY';
  counterOffer: number | null;
  counterReasoning: string;
  redFlags: string[];
  marketBenchmark: string;
  negotiationPoints: string[];
  partial?: boolean;
}

export interface ReminderDraft {
  subject: string;
  body: string;
  tone: 'friendly' | 'firm' | 'final';
  partial?: boolean;
}

export interface RateCard {
  reelRate: number | null;
  storyRate: number | null;
  carouselRate: number | null;
  ugcRate: number | null;
  brandIntegRate: number | null;
  exclusivityRate: number | null;
  currency: string;
  notes: string | null;
  updatedAt: string | null;
}

export interface ManagerProfile {
  name: string | null;
  lastName: string | null;
  email: string;
  companyName: string;
  connections: {
    google: { connected: boolean; email: string | null; connectedAt: string | null };
    instagram: {
      connected: boolean;
      handle: string | null;
      followers: number | null;
      connectedAt: string | null;
    };
  };
}

export const useRateCard = () => {
  const load = useJsonLoader();
  return useSWR<RateCard>('/manager/settings/rate-card', load);
};

export const useManagerProfile = () => {
  const load = useJsonLoader();
  return useSWR<ManagerProfile>('/manager/settings/profile', load);
};

export const useDealSummary = () => {
  const load = useJsonLoader();
  return useSWR<{
    totalValue: number;
    totalCount: number;
    byStage: { stage: DealStageKey; count: number; value: number }[];
  }>('/manager/deals/summary', load);
};

export const useInfluencers = () => {
  const load = useJsonLoader();
  return useSWR<InfluencerRow[]>('/manager/influencers', load);
};

export const useInfluencer = (id: string | null) => {
  const load = useJsonLoader();
  return useSWR<InfluencerRow & { deals: DealRow[]; commercials: PaymentRow[] }>(
    id ? `/manager/influencers/${id}` : null,
    load
  );
};

export const usePayments = () => {
  const load = useJsonLoader();
  return useSWR<PaymentRow[]>('/manager/payments', load);
};

export const usePaymentSummary = () => {
  const load = useJsonLoader();
  return useSWR<PaymentSummary>('/manager/payments/summary', load);
};

export const useContracts = () => {
  const load = useJsonLoader();
  return useSWR<ContractRow[]>('/manager/contracts', load);
};

export type InboxStatus = 'ok' | 'not_connected' | 'token_invalid';
export interface InboxResponse {
  status: InboxStatus;
  threads: EmailThread[];
}

// The server returns { status, threads } now. We normalise here so every
// consumer sees the same shape regardless of which deploy the response was
// produced by (legacy bare-array responses are wrapped on read).
export const useInboxThreads = (query: string) => {
  const load = useJsonLoader();
  const key = query ? `/manager/inbox/threads?q=${encodeURIComponent(query)}` : '/manager/inbox/threads';
  const res = useSWR<InboxResponse | EmailThread[]>(key, load);
  const normalised: InboxResponse | undefined = res.data
    ? Array.isArray(res.data)
      ? { status: 'ok', threads: res.data }
      : res.data
    : undefined;
  return { ...res, data: normalised };
};

export const useInboxTemplates = () => {
  const load = useJsonLoader();
  return useSWR<InboxTemplate[]>('/manager/inbox/templates', load);
};

export const useInboxThread = (id: string | null) => {
  const load = useJsonLoader();
  return useSWR<EmailThread>(id ? `/manager/inbox/threads/${id}` : null, load);
};

export const useCalendarEvents = () => {
  const load = useJsonLoader();
  return useSWR<CalendarEventRow[]>('/manager/schedule/events', load);
};

export const useScheduledPosts = () => {
  const load = useJsonLoader();
  return useSWR<ScheduledPostRow[]>('/manager/schedule/posts', load);
};

// ===========================================================================
// Mutations
// ===========================================================================

export const useManagerMutations = () => {
  const fetch = useFetch();

  const send = useCallback(
    async (url: string, method: string, body?: any) => {
      const res = await fetch(url, {
        method,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `${method} ${url} failed`);
      }
      return res.status === 204 ? null : await res.json();
    },
    [fetch]
  );

  return {
    createDeal: useCallback(
      async (body: {
        brand: string;
        influencerId: string;
        offer: number;
        floor?: number;
        ceiling?: number;
        stage?: DealStageKey;
        notes?: string;
      }) => {
        const created = await send('/manager/deals', 'POST', body);
        globalMutate('/manager/deals');
        globalMutate('/manager/deals/summary');
        return created;
      },
      [send]
    ),
    moveDealStage: useCallback(
      async (id: string, stage: DealStageKey) => {
        await send(`/manager/deals/${id}/stage`, 'PATCH', { stage });
        globalMutate('/manager/deals');
        globalMutate('/manager/deals/summary');
      },
      [send]
    ),
    deleteDeal: useCallback(
      async (id: string) => {
        await send(`/manager/deals/${id}`, 'DELETE');
        globalMutate('/manager/deals');
        globalMutate('/manager/deals/summary');
      },
      [send]
    ),
    createInfluencer: useCallback(
      async (body: {
        name: string;
        handle?: string;
        platform?: string;
        followers?: number;
        engagement?: number;
        email?: string;
        phone?: string;
        notes?: string;
      }) => {
        const created = await send('/manager/influencers', 'POST', body);
        globalMutate('/manager/influencers');
        return created;
      },
      [send]
    ),
    deleteInfluencer: useCallback(
      async (id: string) => {
        await send(`/manager/influencers/${id}`, 'DELETE');
        globalMutate('/manager/influencers');
      },
      [send]
    ),
    createPayment: useCallback(
      async (body: {
        brand: string;
        influencerId: string;
        amount: number;
        currency?: string;
        dealId?: string;
        description?: string;
        dueAt?: string;
        paymentStatus?: PaymentStatusKey;
      }) => {
        const created = await send('/manager/payments', 'POST', body);
        globalMutate('/manager/payments');
        globalMutate('/manager/payments/summary');
        return created;
      },
      [send]
    ),
    paymentAction: useCallback(
      async (
        id: string,
        action: 'mark_invoiced' | 'mark_paid' | 'send_reminder',
        extra?: { subject?: string; body?: string }
      ) => {
        const result = await send(`/manager/payments/${id}/action`, 'POST', {
          action,
          ...extra,
        });
        globalMutate('/manager/payments');
        globalMutate('/manager/payments/summary');
        return result;
      },
      [send]
    ),
    draftPaymentReminder: useCallback(
      async (id: string): Promise<ReminderDraft> => {
        return (await send(
          `/manager/payments/${id}/draft-reminder`,
          'POST'
        )) as ReminderDraft;
      },
      [send]
    ),
    fetchDealAdvice: useCallback(
      async (id: string): Promise<DealAdvice> => {
        return (await send(`/manager/deals/${id}/advisor`, 'POST')) as DealAdvice;
      },
      [send]
    ),
    saveRateCard: useCallback(
      async (body: Partial<RateCard> & { bundleRate?: number | null; postRate?: number | null }) => {
        const updated = await send('/manager/settings/rate-card', 'PUT', body);
        globalMutate('/manager/settings/rate-card');
        return updated as RateCard;
      },
      [send]
    ),
    saveProfile: useCallback(
      async (body: { name?: string; lastName?: string; companyName?: string }) => {
        await send('/manager/settings/profile', 'PUT', body);
        globalMutate('/manager/settings/profile');
      },
      [send]
    ),
    disconnectProvider: useCallback(
      async (provider: 'google' | 'instagram') => {
        await send(`/manager/settings/disconnect/${provider}`, 'POST');
        globalMutate('/manager/settings/profile');
      },
      [send]
    ),
    deletePayment: useCallback(
      async (id: string) => {
        await send(`/manager/payments/${id}`, 'DELETE');
        globalMutate('/manager/payments');
        globalMutate('/manager/payments/summary');
      },
      [send]
    ),
    createContract: useCallback(
      async (body: {
        brand: string;
        templateName: string;
        influencerId?: string;
        dealId?: string;
        status?: ContractRow['status'];
        expiresAt?: string;
        documentUrl?: string;
      }) => {
        const created = await send('/manager/contracts', 'POST', body);
        globalMutate('/manager/contracts');
        return created;
      },
      [send]
    ),
    updateContract: useCallback(
      async (
        id: string,
        body: Partial<{
          brand: string;
          templateName: string;
          status: ContractRow['status'];
          sentAt: string;
          signedAt: string;
          expiresAt: string;
          documentUrl: string;
        }>
      ) => {
        const updated = await send(`/manager/contracts/${id}`, 'PUT', body);
        globalMutate('/manager/contracts');
        return updated;
      },
      [send]
    ),
    deleteContract: useCallback(
      async (id: string) => {
        await send(`/manager/contracts/${id}`, 'DELETE');
        globalMutate('/manager/contracts');
      },
      [send]
    ),
    uploadContractPdf: useCallback(
      async (file: File): Promise<{ path: string }> => {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('preventSave', 'true');
        const res = await fetch('/media/upload-simple', { method: 'POST', body: fd });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(text || `upload failed: ${res.status}`);
        }
        return res.json();
      },
      [fetch]
    ),
    // Inbox
    replyToThread: useCallback(
      async (id: string, body: string, template?: string) => {
        const result = await send(`/manager/inbox/threads/${id}/reply`, 'POST', { body, template });
        globalMutate('/manager/inbox/threads');
        globalMutate(`/manager/inbox/threads/${id}`);
        return result;
      },
      [send]
    ),
    setThreadStatus: useCallback(
      async (id: string, status: ThreadStatus) => {
        const result = await send(`/manager/inbox/threads/${id}/status`, 'PATCH', { status });
        globalMutate('/manager/inbox/threads');
        globalMutate(`/manager/inbox/threads/${id}`);
        return result;
      },
      [send]
    ),
    setThreadStarred: useCallback(
      async (id: string, starred: boolean) => {
        const result = await send(`/manager/inbox/threads/${id}/starred`, 'PATCH', { starred });
        globalMutate('/manager/inbox/threads');
        globalMutate(`/manager/inbox/threads/${id}`);
        return result;
      },
      [send]
    ),
    // Schedule / Calendar / Publishing
    createCalendarEvent: useCallback(
      async (body: {
        title: string;
        startsAt: string;
        endsAt: string;
        kind?: CalendarEventRow['kind'];
        description?: string;
      }) => {
        const result = await send('/manager/schedule/events', 'POST', body);
        globalMutate('/manager/schedule/events');
        return result;
      },
      [send]
    ),
    deleteCalendarEvent: useCallback(
      async (id: string) => {
        await send(`/manager/schedule/events/${id}`, 'DELETE');
        globalMutate('/manager/schedule/events');
      },
      [send]
    ),
    schedulePost: useCallback(
      async (body: {
        influencerId: string;
        influencerName: string;
        caption: string;
        kind: PostKind;
        platforms: Platform[];
        scheduledAt: string;
      }) => {
        const result = await send('/manager/schedule/posts', 'POST', body);
        globalMutate('/manager/schedule/posts');
        return result;
      },
      [send]
    ),
    deleteScheduledPost: useCallback(
      async (id: string) => {
        await send(`/manager/schedule/posts/${id}`, 'DELETE');
        globalMutate('/manager/schedule/posts');
      },
      [send]
    ),
  };
};
