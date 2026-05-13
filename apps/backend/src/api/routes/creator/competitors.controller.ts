import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Param,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { Organization } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { InstagramCompetitorService } from '@gitroom/backend/services/instagram/instagram.competitor.service';

class AddCompetitorDto {
  @IsString() @MinLength(1) @MaxLength(60) handle: string;
}

@ApiTags('Creator')
@Controller('/creator/competitors')
export class CreatorCompetitorsController {
  constructor(private svc: InstagramCompetitorService) {}

  @Get('/')
  list(@GetOrgFromRequest() org: Organization) {
    return this.svc.list(org.id);
  }

  @Post('/')
  async add(@GetOrgFromRequest() org: Organization, @Body() body: AddCompetitorDto) {
    try {
      return await this.svc.addAndSync(org.id, body.handle);
    } catch (e) {
      throw new HttpException((e as Error).message, 400);
    }
  }

  @Post('/:id/resync')
  resync(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    return this.svc.resync(org.id, id);
  }

  @Delete('/:id')
  remove(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    return this.svc.remove(org.id, id);
  }
}
