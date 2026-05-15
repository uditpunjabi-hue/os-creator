import 'server-only';
import type { Invoice, InvoiceStatus, Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { sendGmailEmail } from './gmail';

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceSummary {
  id: string;
  number: string;
  brandName: string;
  brandEmail: string | null;
  total: number;
  currency: string;
  status: InvoiceStatus;
  dueAt: string | null;
  sentAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface InvoiceFull extends InvoiceSummary {
  brandAddress: string | null;
  fromName: string | null;
  fromEmail: string | null;
  fromAddress: string | null;
  items: InvoiceLineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  notes: string | null;
  terms: string | null;
}

export interface CreateInvoiceInput {
  brandName: string;
  brandEmail?: string;
  brandAddress?: string;
  fromName?: string;
  fromEmail?: string;
  fromAddress?: string;
  items: InvoiceLineItem[];
  taxRate?: number;
  currency?: string;
  notes?: string;
  terms?: string;
  dueAt?: string | Date | null;
}

function toSummary(inv: Invoice): InvoiceSummary {
  return {
    id: inv.id,
    number: inv.number,
    brandName: inv.brandName,
    brandEmail: inv.brandEmail,
    total: Number(inv.total),
    currency: inv.currency,
    status: inv.status,
    dueAt: inv.dueAt?.toISOString() ?? null,
    sentAt: inv.sentAt?.toISOString() ?? null,
    paidAt: inv.paidAt?.toISOString() ?? null,
    createdAt: inv.createdAt.toISOString(),
  };
}

function toFull(inv: Invoice): InvoiceFull {
  const items = (inv.items as unknown as InvoiceLineItem[]) ?? [];
  return {
    ...toSummary(inv),
    brandAddress: inv.brandAddress,
    fromName: inv.fromName,
    fromEmail: inv.fromEmail,
    fromAddress: inv.fromAddress,
    items,
    subtotal: Number(inv.subtotal),
    taxRate: inv.taxRate,
    taxAmount: Number(inv.taxAmount),
    notes: inv.notes,
    terms: inv.terms,
  };
}

function computeTotals(items: InvoiceLineItem[], taxRate: number) {
  const subtotal = items.reduce(
    (s, i) => s + Math.max(0, (i.quantity || 0) * (i.unitPrice || 0)),
    0
  );
  const taxAmount = subtotal * (taxRate || 0);
  const total = subtotal + taxAmount;
  return { subtotal, taxAmount, total };
}

async function nextInvoiceNumber(orgId: string): Promise<string> {
  // INV-2026-0001 style, scoped by org and year. We grab the latest row
  // and increment. Race-condition tolerant for low volume — for high
  // volume you'd want a sequence table.
  const year = new Date().getUTCFullYear();
  const prefix = `INV-${year}-`;
  const last = await prisma.invoice.findFirst({
    where: { organizationId: orgId, number: { startsWith: prefix } },
    orderBy: { createdAt: 'desc' },
    select: { number: true },
  });
  let n = 1;
  if (last) {
    const match = last.number.match(/-(\d+)$/);
    if (match) n = parseInt(match[1], 10) + 1;
  }
  return `${prefix}${String(n).padStart(4, '0')}`;
}

export async function listInvoices(orgId: string): Promise<InvoiceSummary[]> {
  const rows = await prisma.invoice.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toSummary);
}

export async function getInvoice(orgId: string, id: string): Promise<InvoiceFull | null> {
  const inv = await prisma.invoice.findUnique({ where: { id } });
  if (!inv || inv.organizationId !== orgId) return null;
  return toFull(inv);
}

export async function getPublicInvoice(id: string): Promise<InvoiceFull | null> {
  // The public viewer route — no org scoping. The id (uuid) is the only
  // gate. We don't expose draft invoices on the public URL.
  const inv = await prisma.invoice.findUnique({ where: { id } });
  if (!inv || inv.status === 'DRAFT' || inv.status === 'VOID') return null;
  // Auto-track that someone viewed it (skip if already PAID).
  if (inv.status === 'SENT') {
    await prisma.invoice
      .update({ where: { id }, data: { status: 'VIEWED' } })
      .catch(() => undefined);
  }
  return toFull(inv);
}

export async function createInvoice(
  orgId: string,
  input: CreateInvoiceInput
): Promise<InvoiceFull> {
  const items = input.items
    .filter((i) => i.description?.trim() && (i.quantity ?? 0) > 0 && (i.unitPrice ?? 0) >= 0)
    .map((i) => ({
      description: i.description.trim().slice(0, 200),
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
    }));
  if (items.length === 0) {
    throw new Error('At least one line item is required');
  }
  const taxRate = Math.max(0, Math.min(input.taxRate ?? 0, 1));
  const { subtotal, taxAmount, total } = computeTotals(items, taxRate);
  const number = await nextInvoiceNumber(orgId);
  const dueAt =
    input.dueAt instanceof Date
      ? input.dueAt
      : typeof input.dueAt === 'string' && input.dueAt
        ? new Date(input.dueAt)
        : null;

  const inv = await prisma.invoice.create({
    data: {
      organizationId: orgId,
      number,
      brandName: input.brandName.trim().slice(0, 120),
      brandEmail: input.brandEmail?.trim().toLowerCase().slice(0, 200) ?? null,
      brandAddress: input.brandAddress?.trim().slice(0, 400) ?? null,
      fromName: input.fromName?.trim().slice(0, 120) ?? null,
      fromEmail: input.fromEmail?.trim().toLowerCase().slice(0, 200) ?? null,
      fromAddress: input.fromAddress?.trim().slice(0, 400) ?? null,
      items: items as unknown as Prisma.InputJsonValue,
      subtotal,
      taxRate,
      taxAmount,
      total,
      currency: input.currency?.toUpperCase().slice(0, 3) ?? 'USD',
      notes: input.notes?.trim().slice(0, 1000) ?? null,
      terms: input.terms?.trim().slice(0, 600) ?? null,
      status: 'DRAFT',
      dueAt,
    },
  });
  return toFull(inv);
}

export async function updateInvoice(
  orgId: string,
  id: string,
  patch: Partial<CreateInvoiceInput> & { status?: InvoiceStatus }
): Promise<InvoiceFull | null> {
  const existing = await prisma.invoice.findUnique({ where: { id } });
  if (!existing || existing.organizationId !== orgId) return null;
  const data: Prisma.InvoiceUpdateInput = {};
  if (patch.brandName !== undefined) data.brandName = patch.brandName.trim().slice(0, 120);
  if (patch.brandEmail !== undefined) data.brandEmail = patch.brandEmail?.trim().toLowerCase().slice(0, 200) ?? null;
  if (patch.brandAddress !== undefined) data.brandAddress = patch.brandAddress?.trim().slice(0, 400) ?? null;
  if (patch.fromName !== undefined) data.fromName = patch.fromName?.trim().slice(0, 120) ?? null;
  if (patch.fromEmail !== undefined) data.fromEmail = patch.fromEmail?.trim().toLowerCase().slice(0, 200) ?? null;
  if (patch.fromAddress !== undefined) data.fromAddress = patch.fromAddress?.trim().slice(0, 400) ?? null;
  if (patch.notes !== undefined) data.notes = patch.notes?.trim().slice(0, 1000) ?? null;
  if (patch.terms !== undefined) data.terms = patch.terms?.trim().slice(0, 600) ?? null;
  if (patch.currency !== undefined) data.currency = patch.currency.toUpperCase().slice(0, 3);
  if (patch.dueAt !== undefined) {
    data.dueAt = patch.dueAt
      ? (typeof patch.dueAt === 'string' ? new Date(patch.dueAt) : patch.dueAt)
      : null;
  }
  if (patch.items) {
    const items = patch.items
      .filter((i) => i.description?.trim() && (i.quantity ?? 0) > 0)
      .map((i) => ({
        description: i.description.trim().slice(0, 200),
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
      }));
    const taxRate =
      patch.taxRate !== undefined ? Math.max(0, Math.min(patch.taxRate, 1)) : existing.taxRate;
    const { subtotal, taxAmount, total } = computeTotals(items, taxRate);
    data.items = items as unknown as Prisma.InputJsonValue;
    data.subtotal = subtotal;
    data.taxRate = taxRate;
    data.taxAmount = taxAmount;
    data.total = total;
  } else if (patch.taxRate !== undefined) {
    const taxRate = Math.max(0, Math.min(patch.taxRate, 1));
    const currentItems = (existing.items as unknown as InvoiceLineItem[]) ?? [];
    const { subtotal, taxAmount, total } = computeTotals(currentItems, taxRate);
    data.taxRate = taxRate;
    data.subtotal = subtotal;
    data.taxAmount = taxAmount;
    data.total = total;
  }
  if (patch.status) {
    data.status = patch.status;
    if (patch.status === 'PAID' && !existing.paidAt) data.paidAt = new Date();
    if (patch.status === 'SENT' && !existing.sentAt) data.sentAt = new Date();
  }
  const updated = await prisma.invoice.update({ where: { id }, data });
  return toFull(updated);
}

export async function deleteInvoice(orgId: string, id: string): Promise<boolean> {
  const existing = await prisma.invoice.findUnique({ where: { id } });
  if (!existing || existing.organizationId !== orgId) return false;
  await prisma.invoice.delete({ where: { id } });
  return true;
}

export interface SendResult {
  ok: boolean;
  reason?: 'no_email' | 'no_token' | 'send_failed';
}

export async function sendInvoiceEmail(
  userId: string,
  orgId: string,
  id: string,
  publicBaseUrl: string
): Promise<SendResult> {
  const inv = await prisma.invoice.findUnique({ where: { id } });
  if (!inv || inv.organizationId !== orgId) return { ok: false, reason: 'no_email' };
  if (!inv.brandEmail) return { ok: false, reason: 'no_email' };

  const viewUrl = `${publicBaseUrl.replace(/\/$/, '')}/p/inv/${inv.id}`;
  const total = Number(inv.total).toFixed(2);
  const dueLine = inv.dueAt ? `Due ${new Date(inv.dueAt).toLocaleDateString()}.` : '';
  const body = `Hi,

Invoice ${inv.number} for ${inv.currency} ${total} is ready.
${dueLine}

View and pay: ${viewUrl}

Thanks,
${inv.fromName ?? ''}`.trim();

  // Mark SENT before the network call — if Gmail fails the user will see
  // an error and can retry; we don't want the status flapping back to
  // DRAFT on a transient 5xx.
  await prisma.invoice.update({
    where: { id: inv.id },
    data: { status: 'SENT', sentAt: new Date() },
  });

  const ok = await sendGmailEmail(userId, {
    to: inv.brandEmail,
    subject: `Invoice ${inv.number} from ${inv.fromName ?? 'Illuminati Creator'}`,
    body,
  });
  if (!ok) return { ok: false, reason: 'send_failed' };
  return { ok: true };
}
