import { Prisma } from '@prisma/client';

const DECIMAL_FIELDS = ['offer', 'floor', 'ceiling', 'amount'] as const;

export function toNumber(v: Prisma.Decimal | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  return v.toNumber();
}

export function decimalRecord<T extends Record<string, unknown>>(row: T): T {
  if (!row || typeof row !== 'object') return row;
  const out: Record<string, unknown> = { ...row };
  for (const key of DECIMAL_FIELDS) {
    const v = out[key];
    if (v !== null && v !== undefined) {
      out[key] = toNumber(v as Prisma.Decimal | number);
    }
  }
  return out as T;
}
