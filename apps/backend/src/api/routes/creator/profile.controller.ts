import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { InstagramFetcherService } from '@gitroom/backend/services/instagram/instagram.fetcher.service';

@ApiTags('Creator')
@Controller('/creator/profile')
export class CreatorProfileController {
  constructor(private ig: InstagramFetcherService) {}

  @Get('/')
  get(@GetOrgFromRequest() org: Organization) {
    return this.ig.getProfile(org.id);
  }
}
