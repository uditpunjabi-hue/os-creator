import { Prisma } from '@prisma/client';

export const toNumber = (value: Prisma.Decimal | number | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  return value.toNumber();
};

const DECIMAL_FIELDS = ['offer', 'floor', 'ceiling', 'amount'];

export const decimalRecord = <T extends Record<string, any>>(row: T): T => {
  if (!row || typeof row !== 'object') return row;
  const out: Record<string, any> = { ...row };
  for (const key of DECIMAL_FIELDS) {
    if (key in out && out[key] !== null && out[key] !== undefined) {
      out[key] = toNumber(out[key]);
    }
  }
  return out as T;
};
