import { Injectable } from '@nestjs/common';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import {
  CreateInfluencerDto,
  UpdateInfluencerDto,
} from '@gitroom/nestjs-libraries/dtos/manager/manager.dto';

@Injectable()
export class InfluencerRepository {
  constructor(private _influencer: PrismaRepository<'influencer'>) {}

  list(orgId: string) {
    return this._influencer.model.influencer.findMany({
      where: { organizationId: orgId },
      include: { _count: { select: { deals: true, commercials: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  get(orgId: string, id: string) {
    return this._influencer.model.influencer.findFirst({
      where: { id, organizationId: orgId },
      include: {
        deals: { orderBy: { updatedAt: 'desc' } },
        commercials: { orderBy: { dueAt: 'asc' } },
        _count: { select: { deals: true, commercials: true } },
      },
    });
  }

  create(orgId: string, body: CreateInfluencerDto) {
    return this._influencer.model.influencer.create({
      data: {
        organizationId: orgId,
        name: body.name,
        handle: body.handle,
        platform: body.platform ?? 'instagram',
        followers: body.followers,
        engagement: body.engagement,
        email: body.email,
        phone: body.phone,
        notes: body.notes,
      },
    });
  }

  update(orgId: string, id: string, body: UpdateInfluencerDto) {
    return this._influencer.model.influencer.update({
      where: { id, organizationId: orgId },
      data: { ...body },
    });
  }

  remove(orgId: string, id: string) {
    return this._influencer.model.influencer.delete({
      where: { id, organizationId: orgId },
    });
  }
}
