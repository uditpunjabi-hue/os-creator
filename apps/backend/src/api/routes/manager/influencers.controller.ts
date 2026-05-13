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
import { InfluencerService } from '@gitroom/nestjs-libraries/database/prisma/manager/influencer.service';
import {
  CreateInfluencerDto,
  UpdateInfluencerDto,
} from '@gitroom/nestjs-libraries/dtos/manager/manager.dto';

@ApiTags('Manager')
@Controller('/manager/influencers')
export class InfluencersController {
  constructor(private _influencers: InfluencerService) {}

  @Get('/')
  list(@GetOrgFromRequest() org: Organization) {
    return this._influencers.list(org.id);
  }

  @Get('/:id')
  async get(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    const inf = await this._influencers.get(org.id, id);
    if (!inf) throw new HttpException('Influencer not found', 404);
    return inf;
  }

  @Post('/')
  create(@GetOrgFromRequest() org: Organization, @Body() body: CreateInfluencerDto) {
    return this._influencers.create(org.id, body);
  }

  @Put('/:id')
  update(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: UpdateInfluencerDto
  ) {
    return this._influencers.update(org.id, id, body);
  }

  @Delete('/:id')
  remove(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    return this._influencers.remove(org.id, id);
  }
}
