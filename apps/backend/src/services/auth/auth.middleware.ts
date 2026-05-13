import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { Provider, User } from '@prisma/client';
import { OrganizationService } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';
import { UsersService } from '@gitroom/nestjs-libraries/database/prisma/users/users.service';
import { getCookieUrlFromDomain } from '@gitroom/helpers/subdomain/subdomain.management';
import { HttpForbiddenException } from '@gitroom/nestjs-libraries/services/exception.filter';

export const removeAuth = (res: Response) => {
  res.cookie('auth', '', {
    domain: getCookieUrlFromDomain(process.env.FRONTEND_URL!),
    ...(!process.env.NOT_SECURED
      ? {
          secure: true,
          httpOnly: true,
          sameSite: 'none',
        }
      : {}),
    expires: new Date(0),
    maxAge: -1,
  });
  res.header('logout', 'true');
};

const DEV_USER_EMAIL = 'dev@os-creator.local';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(
    private _organizationService: OrganizationService,
    private _userService: UsersService
  ) {}

  private async findOrCreateDevUser() {
    let user = (await this._userService.getUserByEmail(DEV_USER_EMAIL)) as
      | (User & { password?: string | null })
      | null;

    if (!user) {
      const created = await this._organizationService.createOrgAndUser(
        {
          email: DEV_USER_EMAIL,
          password: 'os-creator-dev',
          provider: Provider.LOCAL,
          company: 'OS Creator Dev',
        } as any,
        '127.0.0.1',
        'os-creator-dev'
      );
      // @ts-ignore
      user = created.users[0].user;
      await this._userService.activateUser(user!.id);
      user!.activated = true;
    }

    return user!;
  }

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await this.findOrCreateDevUser();
      delete (user as any).password;

      const organizations = await this._organizationService.getOrgsByUserId(
        user.id
      );
      const setOrg = organizations[0];

      if (!setOrg) {
        throw new HttpForbiddenException();
      }

      if (!setOrg.apiKey) {
        await this._organizationService.updateApiKey(setOrg.id);
      }

      // @ts-expect-error req.user augmentation
      req.user = user;
      // @ts-expect-error req.org augmentation
      req.org = setOrg;
    } catch (err) {
      throw new HttpForbiddenException();
    }
    next();
  }
}
