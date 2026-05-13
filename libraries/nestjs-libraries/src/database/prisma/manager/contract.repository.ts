import { Injectable } from '@nestjs/common';
import { ContractStatus } from '@prisma/client';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import {
  CreateContractDto,
  UpdateContractDto,
} from '@gitroom/nestjs-libraries/dtos/manager/manager.dto';

@Injectable()
export class ContractRepository {
  constructor(private _contract: PrismaRepository<'contract'>) {}

  list(orgId: string) {
    return this._contract.model.contract.findMany({
      where: { organizationId: orgId },
      include: { influencer: { select: { id: true, name: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  get(orgId: string, id: string) {
    return this._contract.model.contract.findFirst({
      where: { id, organizationId: orgId },
      include: { influencer: true, deal: true },
    });
  }

  create(orgId: string, body: CreateContractDto) {
    return this._contract.model.contract.create({
      data: {
        organizationId: orgId,
        brand: body.brand,
        templateName: body.templateName,
        influencerId: body.influencerId,
        dealId: body.dealId,
        status: body.status ?? ContractStatus.DRAFT,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        documentUrl: body.documentUrl,
      },
    });
  }

  update(orgId: string, id: string, body: UpdateContractDto) {
    return this._contract.model.contract.update({
      where: { id, organizationId: orgId },
      data: {
        ...(body.brand !== undefined && { brand: body.brand }),
        ...(body.templateName !== undefined && { templateName: body.templateName }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.sentAt !== undefined && {
          sentAt: body.sentAt ? new Date(body.sentAt) : null,
        }),
        ...(body.signedAt !== undefined && {
          signedAt: body.signedAt ? new Date(body.signedAt) : null,
        }),
        ...(body.expiresAt !== undefined && {
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        }),
        ...(body.documentUrl !== undefined && { documentUrl: body.documentUrl }),
      },
    });
  }

  remove(orgId: string, id: string) {
    return this._contract.model.contract.delete({
      where: { id, organizationId: orgId },
    });
  }
}
