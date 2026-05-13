import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { DealService } from '@gitroom/nestjs-libraries/database/prisma/manager/deal.service';
import {
  ChangeDealStageDto,
  CreateDealDto,
  UpdateDealDto,
} from '@gitroom/nestjs-libraries/dtos/manager/manager.dto';

@ApiTags('Manager')
@Controller('/manager/deals')
export class DealsController {
  constructor(private _deals: DealService) {}

  @Get('/')
  list(@GetOrgFromRequest() org: Organization) {
    return this._deals.list(org.id);
  }

  @Get('/summary')
  summary(@GetOrgFromRequest() org: Organization) {
    return this._deals.summary(org.id);
  }

  @Get('/:id')
  async get(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    const deal = await this._deals.get(org.id, id);
    if (!deal) throw new HttpException('Deal not found', 404);
    return deal;
  }

  @Post('/')
  create(@GetOrgFromRequest() org: Organization, @Body() body: CreateDealDto) {
    return this._deals.create(org.id, body);
  }

  @Put('/:id')
  update(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: UpdateDealDto
  ) {
    return this._deals.update(org.id, id, body);
  }

  @Patch('/:id/stage')
  changeStage(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: ChangeDealStageDto
  ) {
    return this._deals.changeStage(org.id, id, body);
  }

  @Delete('/:id')
  remove(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    return this._deals.remove(org.id, id);
  }
}
