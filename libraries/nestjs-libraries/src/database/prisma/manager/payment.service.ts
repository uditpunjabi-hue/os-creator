import { Injectable, Logger } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { PaymentRepository } from '@gitroom/nestjs-libraries/database/prisma/manager/payment.repository';
import {
  CreatePaymentDto,
  UpdatePaymentDto,
} from '@gitroom/nestjs-libraries/dtos/manager/manager.dto';
import { decimalRecord, toNumber } from '@gitroom/nestjs-libraries/database/prisma/manager/decimal';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  constructor(private _repo: PaymentRepository) {}

  async list(orgId: string) {
    const rows = await this._repo.list(orgId);
    const now = new Date();
    return rows.map((row) => {
      const overdue =
        row.paymentStatus !== 'PAID' &&
        row.paymentStatus !== 'OVERDUE' &&
        row.dueAt &&
        row.dueAt < now;
      return decimalRecord({ ...row, computedOverdue: !!overdue });
    });
  }

  async get(orgId: string, id: string) {
    const row = await this._repo.get(orgId, id);
    if (!row) return null;
    return {
      ...decimalRecord(row),
      payments: row.payments.map(decimalRecord),
    };
  }

  async create(orgId: string, body: CreatePaymentDto) {
    return decimalRecord(await this._repo.create(orgId, body));
  }

  async update(orgId: string, id: string, body: UpdatePaymentDto) {
    return decimalRecord(await this._repo.update(orgId, id, body));
  }

  remove(orgId: string, id: string) {
    return this._repo.remove(orgId, id);
  }

  async markInvoiced(orgId: string, id: string) {
    return decimalRecord(
      await this._repo.update(orgId, id, {
        paymentStatus: PaymentStatus.INVOICED,
        invoicedAt: new Date().toISOString(),
      })
    );
  }

  async markPaid(orgId: string, id: string) {
    return decimalRecord(
      await this._repo.update(orgId, id, {
        paymentStatus: PaymentStatus.PAID,
        paidAt: new Date().toISOString(),
      })
    );
  }

  async sendReminder(orgId: string, id: string) {
    // Stub: real implementation will route through EmailProvider once OAuth wired.
    this.logger.log(`Reminder requested for payment ${id} in org ${orgId}`);
    return { ok: true, drafted: true };
  }

  async summary(orgId: string) {
    const groups = await this._repo.monthlyTotals(orgId);
    const by: Record<string, { amount: number; count: number }> = {};
    for (const g of groups) {
      by[g.paymentStatus] = {
        amount: toNumber(g._sum.amount),
        count: g._count._all,
      };
    }
    return {
      pending: (by.PENDING?.amount ?? 0) + (by.INVOICED?.amount ?? 0),
      overdue: by.OVERDUE?.amount ?? 0,
      paid: by.PAID?.amount ?? 0,
      counts: by,
    };
  }
}
