import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { Provider, User } from '@prisma/client';
import { OrganizationService } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';
import { UsersService } from '@gitroom/nestjs-libraries/database/prisma/users/users.service';
import { getCookieUrlFromDomain } from '@gitroom/helpers/subdomain/subdomain.management';
import { HttpForbiddenException } from '@gitroom/nestjs-libraries/services/exception.filter';
import { AuthService } from '@gitroom/helpers/auth/auth.service';

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
  private readonly logger = new Logger(AuthMiddleware.name);

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
          password: 'illuminati-dev',
          provider: Provider.LOCAL,
          company: 'Illuminati Dev',
        } as any,
        '127.0.0.1',
        'illuminati-dev'
      );
      // @ts-ignore
      user = created.users[0].user;
      await this._userService.activateUser(user!.id);
      user!.activated = true;
    }

    return user!;
  }

  /**
   * Read the JWT from the `auth` cookie first, then the `auth` header. Verify
   * and look up the user. Returns null when there's no valid token — the
   * caller falls back to the dev user.
   */
  private async resolveJwtUser(req: Request): Promise<User | null> {
    const cookieAuth = (req as any).cookies?.auth as string | undefined;
    const headerAuth =
      (req.headers['auth'] as string | undefined) ??
      (req.headers['Auth'] as unknown as string | undefined);
    const token = cookieAuth || headerAuth;
    if (!token) return null;
    try {
      const decoded = AuthService.verifyJWT(token) as { id?: string; email?: string } | null;
      if (!decoded?.id) return null;
      const user = await this._userService.getUserById(decoded.id);
      return user ?? null;
    } catch (e) {
      this.logger.warn(`JWT verify failed: ${(e as Error).message}`);
      return null;
    }
  }

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      // Prefer a real JWT-authenticated user; fall back to the dev user so
      // local development still works without going through OAuth.
      const jwtUser = await this.resolveJwtUser(req);
      const user = (jwtUser ?? (await this.findOrCreateDevUser())) as User & {
        password?: string | null;
      };
      delete (user as any).password;

      const organizations = await this._organizationService.getOrgsByUserId(
        user.id
      );
      // showorg cookie wins if it matches one of the user's orgs, otherwise
      // first org.
      const showOrgId =
        ((req as any).cookies?.showorg as string | undefined) ??
        ((req.headers['showorg'] as string | undefined) || undefined);
      const setOrg =
        (showOrgId && organizations.find((o) => o.id === showOrgId)) ||
        organizations[0];

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
