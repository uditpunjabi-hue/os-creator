import { Injectable } from '@nestjs/common';
import { PaymentStatus, Prisma } from '@prisma/client';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import {
  CreatePaymentDto,
  UpdatePaymentDto,
} from '@gitroom/nestjs-libraries/dtos/manager/manager.dto';

@Injectable()
export class PaymentRepository {
  constructor(private _bc: PrismaRepository<'brandCommercial'>) {}

  list(orgId: string) {
    return this._bc.model.brandCommercial.findMany({
      where: { organizationId: orgId },
      include: { influencer: { select: { id: true, name: true, handle: true } } },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
    });
  }

  get(orgId: string, id: string) {
    return this._bc.model.brandCommercial.findFirst({
      where: { id, organizationId: orgId },
      include: { influencer: true, payments: true, deal: true },
    });
  }

  create(orgId: string, body: CreatePaymentDto) {
    return this._bc.model.brandCommercial.create({
      data: {
        organizationId: orgId,
        influencerId: body.influencerId,
        dealId: body.dealId,
        brand: body.brand,
        description: body.description,
        amount: new Prisma.Decimal(body.amount),
        currency: body.currency ?? 'USD',
        dueAt: body.dueAt ? new Date(body.dueAt) : null,
        paymentStatus: body.paymentStatus ?? PaymentStatus.PENDING,
      },
      include: { influencer: { select: { id: true, name: true, handle: true } } },
    });
  }

  update(orgId: string, id: string, body: UpdatePaymentDto) {
    return this._bc.model.brandCommercial.update({
      where: { id, organizationId: orgId },
      data: {
        ...(body.brand !== undefined && { brand: body.brand }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.amount !== undefined && { amount: new Prisma.Decimal(body.amount) }),
        ...(body.currency !== undefined && { currency: body.currency }),
        ...(body.dueAt !== undefined && {
          dueAt: body.dueAt ? new Date(body.dueAt) : null,
        }),
        ...(body.invoicedAt !== undefined && {
          invoicedAt: body.invoicedAt ? new Date(body.invoicedAt) : null,
        }),
        ...(body.paidAt !== undefined && {
          paidAt: body.paidAt ? new Date(body.paidAt) : null,
        }),
        ...(body.paymentStatus !== undefined && { paymentStatus: body.paymentStatus }),
      },
      include: { influencer: { select: { id: true, name: true, handle: true } } },
    });
  }

  remove(orgId: string, id: string) {
    return this._bc.model.brandCommercial.delete({
      where: { id, organizationId: orgId },
    });
  }

  monthlyTotals(orgId: string) {
    return this._bc.model.brandCommercial.groupBy({
      by: ['paymentStatus'],
      where: { organizationId: orgId },
      _sum: { amount: true },
      _count: { _all: true },
    });
  }
}
