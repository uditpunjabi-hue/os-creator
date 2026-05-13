import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { ContractService } from '@gitroom/nestjs-libraries/database/prisma/manager/contract.service';
import {
  CreateContractDto,
  UpdateContractDto,
} from '@gitroom/nestjs-libraries/dtos/manager/manager.dto';

@ApiTags('Manager')
@Controller('/manager/contracts')
export class ContractsController {
  constructor(private _contracts: ContractService) {}

  @Get('/')
  list(@GetOrgFromRequest() org: Organization) {
    return this._contracts.list(org.id);
  }

  @Get('/:id')
  async get(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    const row = await this._contracts.get(org.id, id);
    if (!row) throw new HttpException('Contract not found', 404);
    return row;
  }

  @Post('/')
  create(@GetOrgFromRequest() org: Organization, @Body() body: CreateContractDto) {
    return this._contracts.create(org.id, body);
  }

  @Put('/:id')
  update(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: UpdateContractDto
  ) {
    return this._contracts.update(org.id, id, body);
  }

  @Delete('/:id')
  remove(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    return this._contracts.remove(org.id, id);
  }
}
