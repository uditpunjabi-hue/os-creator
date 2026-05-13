import { Injectable } from '@nestjs/common';
import { InfluencerRepository } from '@gitroom/nestjs-libraries/database/prisma/manager/influencer.repository';
import {
  CreateInfluencerDto,
  UpdateInfluencerDto,
} from '@gitroom/nestjs-libraries/dtos/manager/manager.dto';
import { decimalRecord } from '@gitroom/nestjs-libraries/database/prisma/manager/decimal';

@Injectable()
export class InfluencerService {
  constructor(private _repo: InfluencerRepository) {}

  list(orgId: string) {
    return this._repo.list(orgId);
  }

  async get(orgId: string, id: string) {
    const inf = await this._repo.get(orgId, id);
    if (!inf) return null;
    return {
      ...inf,
      deals: inf.deals.map(decimalRecord),
      commercials: inf.commercials.map(decimalRecord),
    };
  }

  create(orgId: string, body: CreateInfluencerDto) {
    return this._repo.create(orgId, body);
  }

  update(orgId: string, id: string, body: UpdateInfluencerDto) {
    return this._repo.update(orgId, id, body);
  }

  remove(orgId: string, id: string) {
    return this._repo.remove(orgId, id);
  }
}
