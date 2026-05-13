import { Injectable } from '@nestjs/common';
import { ContractStatus } from '@prisma/client';
import { ContractRepository } from '@gitroom/nestjs-libraries/database/prisma/manager/contract.repository';
import {
  CreateContractDto,
  UpdateContractDto,
} from '@gitroom/nestjs-libraries/dtos/manager/manager.dto';

@Injectable()
export class ContractService {
  constructor(private _repo: ContractRepository) {}

  async list(orgId: string) {
    const rows = await this._repo.list(orgId);
    const now = new Date();
    const soon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    return rows.map((row) => ({
      ...row,
      expiringSoon:
        row.status === ContractStatus.SIGNED &&
        !!row.expiresAt &&
        row.expiresAt > now &&
        row.expiresAt < soon,
      expired:
        !!row.expiresAt && row.expiresAt < now && row.status !== ContractStatus.EXPIRED,
    }));
  }

  get(orgId: string, id: string) {
    return this._repo.get(orgId, id);
  }

  create(orgId: string, body: CreateContractDto) {
    return this._repo.create(orgId, body);
  }

  update(orgId: string, id: string, body: UpdateContractDto) {
    return this._repo.update(orgId, id, body);
  }

  remove(orgId: string, id: string) {
    return this._repo.remove(orgId, id);
  }
}
