import { Injectable } from '@nestjs/common';
import { DealRepository } from '@gitroom/nestjs-libraries/database/prisma/manager/deal.repository';
import {
  ChangeDealStageDto,
  CreateDealDto,
  UpdateDealDto,
} from '@gitroom/nestjs-libraries/dtos/manager/manager.dto';
import { toNumber, decimalRecord } from '@gitroom/nestjs-libraries/database/prisma/manager/decimal';

@Injectable()
export class DealService {
  constructor(private _repo: DealRepository) {}

  async list(orgId: string) {
    const rows = await this._repo.list(orgId);
    return rows.map(decimalRecord);
  }

  async get(orgId: string, id: string) {
    const row = await this._repo.get(orgId, id);
    return row ? decimalRecord(row) : null;
  }

  async create(orgId: string, body: CreateDealDto) {
    return decimalRecord(await this._repo.create(orgId, body));
  }

  async update(orgId: string, id: string, body: UpdateDealDto) {
    return decimalRecord(await this._repo.update(orgId, id, body));
  }

  async changeStage(orgId: string, id: string, body: ChangeDealStageDto) {
    return decimalRecord(await this._repo.changeStage(orgId, id, body));
  }

  remove(orgId: string, id: string) {
    return this._repo.remove(orgId, id);
  }

  async summary(orgId: string) {
    const groups = await this._repo.summary(orgId);
    const totalValue = groups.reduce(
      (acc, g) => acc + toNumber(g._sum.offer),
      0
    );
    const totalCount = groups.reduce((acc, g) => acc + g._count._all, 0);
    return {
      totalValue,
      totalCount,
      byStage: groups.map((g) => ({
        stage: g.stage,
        count: g._count._all,
        value: toNumber(g._sum.offer),
      })),
    };
  }
}
