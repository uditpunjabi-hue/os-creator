import { Injectable } from '@nestjs/common';
import { Prisma, DealStage } from '@prisma/client';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import {
  ChangeDealStageDto,
  CreateDealDto,
  UpdateDealDto,
} from '@gitroom/nestjs-libraries/dtos/manager/manager.dto';

@Injectable()
export class DealRepository {
  constructor(private _deal: PrismaRepository<'deal'>) {}

  list(orgId: string) {
    return this._deal.model.deal.findMany({
      where: { organizationId: orgId },
      include: { influencer: { select: { id: true, name: true, handle: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  get(orgId: string, id: string) {
    return this._deal.model.deal.findFirst({
      where: { id, organizationId: orgId },
      include: { influencer: true, contracts: true, commercials: true },
    });
  }

  create(orgId: string, body: CreateDealDto) {
    return this._deal.model.deal.create({
      data: {
        organizationId: orgId,
        brand: body.brand,
        influencerId: body.influencerId,
        offer: new Prisma.Decimal(body.offer),
        floor: body.floor != null ? new Prisma.Decimal(body.floor) : null,
        ceiling: body.ceiling != null ? new Prisma.Decimal(body.ceiling) : null,
        stage: body.stage ?? DealStage.LEAD,
        notes: body.notes,
      },
      include: { influencer: { select: { id: true, name: true, handle: true } } },
    });
  }

  update(orgId: string, id: string, body: UpdateDealDto) {
    return this._deal.model.deal.update({
      where: { id, organizationId: orgId },
      data: {
        ...(body.brand !== undefined && { brand: body.brand }),
        ...(body.influencerId !== undefined && { influencerId: body.influencerId }),
        ...(body.offer !== undefined && { offer: new Prisma.Decimal(body.offer) }),
        ...(body.floor !== undefined && {
          floor: body.floor == null ? null : new Prisma.Decimal(body.floor),
        }),
        ...(body.ceiling !== undefined && {
          ceiling: body.ceiling == null ? null : new Prisma.Decimal(body.ceiling),
        }),
        ...(body.stage !== undefined && { stage: body.stage }),
        ...(body.notes !== undefined && { notes: body.notes }),
      },
      include: { influencer: { select: { id: true, name: true, handle: true } } },
    });
  }

  changeStage(orgId: string, id: string, body: ChangeDealStageDto) {
    return this._deal.model.deal.update({
      where: { id, organizationId: orgId },
      data: { stage: body.stage },
      include: { influencer: { select: { id: true, name: true, handle: true } } },
    });
  }

  remove(orgId: string, id: string) {
    return this._deal.model.deal.delete({ where: { id, organizationId: orgId } });
  }

  summary(orgId: string) {
    return this._deal.model.deal.groupBy({
      by: ['stage'],
      where: { organizationId: orgId },
      _count: { _all: true },
      _sum: { offer: true },
    });
  }
}
