import {
  Body,
  Controller,
  Get,
  HttpException,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Organization } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import {
  EMAIL_PROVIDER_TOKEN,
  type EmailProvider,
  type ThreadStatus,
} from '@gitroom/backend/services/providers/email.provider';

class ReplyDto {
  @IsString() @MinLength(1) @MaxLength(10000) body: string;
  @IsOptional() @IsString() @MaxLength(40) template?: string;
}

class SetStatusDto {
  @IsIn(['NEW_LEAD', 'IN_NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST', 'REJECTED'])
  status: ThreadStatus;
}

class SetStarredDto {
  @IsBoolean()
  starred: boolean;
}

import { GmailSuggestService } from '@gitroom/backend/services/email/gmail.suggest.service';

@ApiTags('Manager')
@Controller('/manager/inbox')
export class InboxController {
  constructor(
    @Inject(EMAIL_PROVIDER_TOKEN) private email: EmailProvider,
    private suggest: GmailSuggestService
  ) {}

  /** AI-suggested replies: 3 stance variants powered by Claude. */
  @Post('/threads/:id/suggest-reply')
  async suggestReply(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    try {
      return await this.suggest.suggest(org.id, id);
    } catch (e) {
      throw new HttpException((e as Error).message, 502);
    }
  }

  @Get('/threads')
  list(@GetOrgFromRequest() org: Organization, @Query('q') q?: string) {
    return this.email.listThreads(org.id, q);
  }

  @Get('/templates')
  templates() {
    return this.email.listTemplates();
  }

  @Get('/threads/:id')
  async get(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    const t = await this.email.getThread(org.id, id);
    if (!t) throw new HttpException('Thread not found', 404);
    return t;
  }

  @Post('/threads/:id/reply')
  async reply(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: ReplyDto
  ) {
    const t = await this.email.reply(org.id, id, body);
    if (!t) throw new HttpException('Thread not found', 404);
    return t;
  }

  @Patch('/threads/:id/status')
  async status(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: SetStatusDto
  ) {
    const t = await this.email.setStatus(org.id, id, body.status);
    if (!t) throw new HttpException('Thread not found', 404);
    return t;
  }

  @Patch('/threads/:id/starred')
  async starred(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: SetStarredDto
  ) {
    const t = await this.email.setStarred(org.id, id, body.starred);
    if (!t) throw new HttpException('Thread not found', 404);
    return t;
  }
}
