import 'server-only';
import type { BrandContact, BrandContactStatus, Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { listGmailThreads, type EmailThread } from './gmail';

// Brand CRM. Backed by the BrandContact table but enriches every read with
// computed totals from Deal/BrandCommercial/Payment so the displayed
// "Total earned" and "Last interaction" are always live. We don't store
// those denormalized — too easy to drift when a payment lands or a deal
// gets renegotiated.

export interface BrandSummary {
  id: string;
  name: string;
  industry: string | null;
  contactName: string | null;
  contactEmail: string | null;
  status: BrandContactStatus;
  notes: string | null;
  totalEarned: number;
  currency: string;
  dealsCount: number;
  paymentsCount: number;
  lastInteraction: string | null;
  createdAt: string;
}

export interface BrandDetail extends BrandSummary {
  deals: Array<{
    id: string;
    offer: number;
    stage: string;
    deadline: string | null;
    createdAt: string;
  }>;
  payments: Array<{
    id: string;
    amount: number;
    currency: string;
    paidAt: string | null;
    method: string | null;
    reference: string | null;
  }>;
  threads: Array<{
    id: string;
    subject: string;
    preview: string;
    updatedAt: string;
    status: string;
  }>;
}

function emailDomain(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.lastIndexOf('@');
  if (at < 0) return null;
  return email.slice(at + 1).toLowerCase();
}

function brandNameFromEmail(displayFrom: string, email: string): string {
  // "Acme Co <alice@acme.com>" → "Acme Co"; bare emails fall back to
  // capitalized domain.
  const angled = displayFrom.match(/^(.+?)\s*<[^>]+>/);
  if (angled) return angled[1].trim().replace(/['"]/g, '');
  const dom = emailDomain(email);
  if (!dom) return displayFrom;
  const root = dom.split('.')[0] ?? dom;
  return root.charAt(0).toUpperCase() + root.slice(1);
}

const PERSONAL_DOMAINS = new Set([
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'aol.com',
  'protonmail.com',
  'me.com',
  'live.com',
  'ymail.com',
]);

export async function syncBrandsFromInbox(userId: string, orgId: string): Promise<number> {
  // Pulls the recent inbox and upserts a BrandContact row for every unique
  // sender whose domain isn't a known consumer email provider. We use
  // contactEmail as the natural dedup key.
  const threads = await listGmailThreads(userId).catch(() => [] as EmailThread[]);
  let touched = 0;
  for (const t of threads) {
    const email = (t.email || '').trim().toLowerCase();
    if (!email) continue;
    const dom = emailDomain(email);
    if (!dom || PERSONAL_DOMAINS.has(dom)) continue;
    // Inbox shows the "from" header; we keep brand name from that.
    const name = (t.brand || brandNameFromEmail(t.brand || '', email)).slice(0, 80);
    try {
      await prisma.brandContact.upsert({
        where: {
          organizationId_contactEmail: {
            organizationId: orgId,
            contactEmail: email,
          },
        },
        update: {
          name,
          lastInteraction: new Date(t.updatedAt),
        },
        create: {
          organizationId: orgId,
          name,
          contactEmail: email,
          contactName: name,
          status: 'NEW',
          lastInteraction: new Date(t.updatedAt),
        },
      });
      touched += 1;
    } catch {
      // Race / unique conflict — fine, just skip.
    }
  }
  return touched;
}

export async function listBrands(userId: string, orgId: string): Promise<BrandSummary[]> {
  const brands = await prisma.brandContact.findMany({
    where: { organizationId: orgId },
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
  });
  // Aggregate deal + payment totals in one batch instead of N+1 queries.
  const enriched: BrandSummary[] = await Promise.all(
    brands.map((b) => enrich(b, orgId))
  );
  return enriched;
}

async function enrich(b: BrandContact, orgId: string): Promise<BrandSummary> {
  // Match deals + commercials by brand name (case-insensitive). We don't
  // have a hard FK from BrandContact to Deal — that was deliberate to keep
  // brand discovery free-form (a name typed into a deal == a deal for
  // that brand even if no email exists yet).
  const where = {
    organizationId: orgId,
    brand: { equals: b.name, mode: 'insensitive' as Prisma.QueryMode },
  };
  const [deals, commercials] = await Promise.all([
    prisma.deal.findMany({ where, select: { id: true, offer: true, stage: true, deadline: true, createdAt: true } }),
    prisma.brandCommercial.findMany({
      where: {
        organizationId: orgId,
        deal: { brand: { equals: b.name, mode: 'insensitive' as Prisma.QueryMode } },
      },
      include: { payments: true },
    }),
  ]);
  let totalEarned = 0;
  let lastPayment: Date | null = null;
  let currency = b.currency;
  for (const c of commercials) {
    for (const p of c.payments) {
      totalEarned += Number(p.amount);
      currency = p.currency || currency;
      if (p.paidAt && (!lastPayment || p.paidAt > lastPayment)) lastPayment = p.paidAt;
    }
  }
  const last = [b.lastInteraction, lastPayment].filter(Boolean) as Date[];
  const lastInteraction = last.length > 0 ? new Date(Math.max(...last.map((d) => d.getTime()))) : null;
  return {
    id: b.id,
    name: b.name,
    industry: b.industry,
    contactName: b.contactName,
    contactEmail: b.contactEmail,
    status: b.status,
    notes: b.notes,
    totalEarned,
    currency,
    dealsCount: deals.length,
    paymentsCount: commercials.reduce((s, c) => s + c.payments.length, 0),
    lastInteraction: lastInteraction?.toISOString() ?? null,
    createdAt: b.createdAt.toISOString(),
  };
}

export async function getBrandDetail(
  userId: string,
  orgId: string,
  id: string
): Promise<BrandDetail | null> {
  const b = await prisma.brandContact.findUnique({ where: { id } });
  if (!b || b.organizationId !== orgId) return null;
  const summary = await enrich(b, orgId);

  const [deals, commercials] = await Promise.all([
    prisma.deal.findMany({
      where: {
        organizationId: orgId,
        brand: { equals: b.name, mode: 'insensitive' as Prisma.QueryMode },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, offer: true, stage: true, deadline: true, createdAt: true },
    }),
    prisma.brandCommercial.findMany({
      where: {
        organizationId: orgId,
        deal: { brand: { equals: b.name, mode: 'insensitive' as Prisma.QueryMode } },
      },
      include: { payments: { orderBy: { paidAt: 'desc' } } },
    }),
  ]);

  const payments: BrandDetail['payments'] = [];
  for (const c of commercials) {
    for (const p of c.payments) {
      payments.push({
        id: p.id,
        amount: Number(p.amount),
        currency: p.currency,
        paidAt: p.paidAt?.toISOString() ?? null,
        method: p.method,
        reference: p.reference,
      });
    }
  }

  // Lightweight pull of inbox threads matching this brand's email.
  const allThreads = b.contactEmail
    ? await listGmailThreads(userId).catch(() => [] as EmailThread[])
    : [];
  const threads = allThreads
    .filter((t) => t.email.toLowerCase() === (b.contactEmail ?? '').toLowerCase())
    .slice(0, 20)
    .map((t) => ({
      id: t.id,
      subject: t.subject,
      preview: t.preview,
      updatedAt: t.updatedAt,
      status: t.status,
    }));

  return {
    ...summary,
    deals: deals.map((d) => ({
      id: d.id,
      offer: Number(d.offer),
      stage: d.stage,
      deadline: d.deadline?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
    })),
    payments,
    threads,
  };
}

export async function updateBrand(
  orgId: string,
  id: string,
  patch: Partial<{
    name: string;
    industry: string | null;
    contactName: string | null;
    contactEmail: string | null;
    status: BrandContactStatus;
    notes: string | null;
  }>
): Promise<BrandContact | null> {
  const existing = await prisma.brandContact.findUnique({ where: { id } });
  if (!existing || existing.organizationId !== orgId) return null;
  return prisma.brandContact.update({ where: { id }, data: patch });
}

export async function createBrand(
  orgId: string,
  data: { name: string; industry?: string; contactName?: string; contactEmail?: string; notes?: string }
): Promise<BrandContact> {
  return prisma.brandContact.create({
    data: {
      organizationId: orgId,
      name: data.name.slice(0, 80),
      industry: data.industry?.slice(0, 80) ?? null,
      contactName: data.contactName?.slice(0, 80) ?? null,
      contactEmail: data.contactEmail?.slice(0, 200) ?? null,
      notes: data.notes?.slice(0, 1000) ?? null,
      status: 'NEW',
    },
  });
}

export async function deleteBrand(orgId: string, id: string): Promise<boolean> {
  const existing = await prisma.brandContact.findUnique({ where: { id } });
  if (!existing || existing.organizationId !== orgId) return false;
  await prisma.brandContact.delete({ where: { id } });
  return true;
}
