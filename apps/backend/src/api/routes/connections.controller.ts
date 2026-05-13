import {
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';

/**
 * Authenticated companion to /oauth — reports the logged-in user's connection
 * state (handles, timestamps) and lets them disconnect.
 *
 * The /oauth/google|instagram/{start,callback} endpoints are public (Google
 * and Meta callbacks don't carry auth cookies); these don't.
 */
@ApiTags('Connections')
@Controller('/connections')
export class ConnectionsController {
  constructor(private prisma: PrismaService) {}

  @Get('/')
  async list(@GetUserFromRequest() user: User) {
    const u = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        googleEmail: true,
        googleConnectedAt: true,
        googleExpiresAt: true,
        instagramHandle: true,
        instagramFollowers: true,
        instagramMediaCount: true,
        instagramBio: true,
        instagramProfilePic: true,
        instagramConnectedAt: true,
      },
    });
    return {
      google: u?.googleConnectedAt
        ? {
            connected: true,
            email: u.googleEmail,
            connectedAt: u.googleConnectedAt,
            expiresAt: u.googleExpiresAt,
          }
        : { connected: false },
      instagram: u?.instagramConnectedAt
        ? {
            connected: true,
            handle: u.instagramHandle,
            followers: u.instagramFollowers,
            mediaCount: u.instagramMediaCount,
            bio: u.instagramBio,
            profilePic: u.instagramProfilePic,
            connectedAt: u.instagramConnectedAt,
          }
        : { connected: false },
    };
  }

  @Post('/:provider/disconnect')
  async disconnect(
    @GetUserFromRequest() user: User,
    @Param('provider') provider: 'google' | 'instagram'
  ) {
    if (provider === 'google') {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          googleAccessToken: null,
          googleRefreshToken: null,
          googleExpiresAt: null,
          googleEmail: null,
          googleConnectedAt: null,
        },
      });
    } else if (provider === 'instagram') {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          instagramAccessToken: null,
          instagramUserId: null,
          instagramHandle: null,
          instagramFollowers: null,
          instagramMediaCount: null,
          instagramBio: null,
          instagramProfilePic: null,
          instagramConnectedAt: null,
        },
      });
    }
    return { ok: true };
  }
}
