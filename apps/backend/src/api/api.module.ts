import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthController } from '@gitroom/backend/api/routes/auth.controller';
import { AuthService } from '@gitroom/backend/services/auth/auth.service';
import { UsersController } from '@gitroom/backend/api/routes/users.controller';
import { AuthMiddleware } from '@gitroom/backend/services/auth/auth.middleware';
import { StripeController } from '@gitroom/backend/api/routes/stripe.controller';
import { StripeService } from '@gitroom/nestjs-libraries/services/stripe.service';
import { AnalyticsController } from '@gitroom/backend/api/routes/analytics.controller';
import { PoliciesGuard } from '@gitroom/backend/services/auth/permissions/permissions.guard';
import { PermissionsService } from '@gitroom/backend/services/auth/permissions/permissions.service';
import { IntegrationsController } from '@gitroom/backend/api/routes/integrations.controller';
import { IntegrationManager } from '@gitroom/nestjs-libraries/integrations/integration.manager';
import { SettingsController } from '@gitroom/backend/api/routes/settings.controller';
import { PostsController } from '@gitroom/backend/api/routes/posts.controller';
import { MediaController } from '@gitroom/backend/api/routes/media.controller';
import { UploadModule } from '@gitroom/nestjs-libraries/upload/upload.module';
import { BillingController } from '@gitroom/backend/api/routes/billing.controller';
import { NotificationsController } from '@gitroom/backend/api/routes/notifications.controller';
import { OpenaiService } from '@gitroom/nestjs-libraries/openai/openai.service';
import { ExtractContentService } from '@gitroom/nestjs-libraries/openai/extract.content.service';
import { CodesService } from '@gitroom/nestjs-libraries/services/codes.service';
import { CopilotController } from '@gitroom/backend/api/routes/copilot.controller';
import { PublicController } from '@gitroom/backend/api/routes/public.controller';
import { RootController } from '@gitroom/backend/api/routes/root.controller';
import { TrackService } from '@gitroom/nestjs-libraries/track/track.service';
import { ShortLinkService } from '@gitroom/nestjs-libraries/short-linking/short.link.service';
import { Nowpayments } from '@gitroom/nestjs-libraries/crypto/nowpayments';
import { WebhookController } from '@gitroom/backend/api/routes/webhooks.controller';
import { SignatureController } from '@gitroom/backend/api/routes/signature.controller';
import { AutopostController } from '@gitroom/backend/api/routes/autopost.controller';
import { SetsController } from '@gitroom/backend/api/routes/sets.controller';
import { ThirdPartyController } from '@gitroom/backend/api/routes/third-party.controller';
import { MonitorController } from '@gitroom/backend/api/routes/monitor.controller';
import { NoAuthIntegrationsController } from '@gitroom/backend/api/routes/no.auth.integrations.controller';
import { EnterpriseController } from '@gitroom/backend/api/routes/enterprise.controller';
import { OAuthAppController } from '@gitroom/backend/api/routes/oauth-app.controller';
import { ApprovedAppsController } from '@gitroom/backend/api/routes/approved-apps.controller';
import { OAuthController, OAuthAuthorizedController } from '@gitroom/backend/api/routes/oauth.controller';
import { AnnouncementsController } from '@gitroom/backend/api/routes/announcements.controller';
import { AdminController } from '@gitroom/backend/api/routes/admin.controller';
import { DealsController } from '@gitroom/backend/api/routes/manager/deals.controller';
import { InfluencersController } from '@gitroom/backend/api/routes/manager/influencers.controller';
import { PaymentsController } from '@gitroom/backend/api/routes/manager/payments.controller';
import { ContractsController } from '@gitroom/backend/api/routes/manager/contracts.controller';
import { InboxController } from '@gitroom/backend/api/routes/manager/inbox.controller';
import { ScheduleController } from '@gitroom/backend/api/routes/manager/schedule.controller';
import { CreatorScriptsController } from '@gitroom/backend/api/routes/creator/scripts.controller';
import { PipelineOrchestrator } from '@gitroom/backend/agents/pipeline.orchestrator';
import { IlluminatiOAuthController } from '@gitroom/backend/api/routes/illuminati-oauth.controller';
import { ConnectionsController } from '@gitroom/backend/api/routes/connections.controller';
import { EMAIL_PROVIDER_TOKEN } from '@gitroom/backend/services/providers/email.provider';
import { CALENDAR_PROVIDER_TOKEN } from '@gitroom/backend/services/providers/calendar.provider';
import {
  PUBLISHING_PROVIDER_TOKEN,
  MockPublishingProvider,
} from '@gitroom/backend/services/providers/publishing.provider';
import { GmailEmailProvider } from '@gitroom/backend/services/providers/gmail.email.provider';
import { GoogleCalendarProvider } from '@gitroom/backend/services/providers/google-calendar.provider';
import { GoogleTokenService } from '@gitroom/backend/services/google/google-token.service';
import { InstagramFetcherService } from '@gitroom/backend/services/instagram/instagram.fetcher.service';
import { CreatorProfileController } from '@gitroom/backend/api/routes/creator/profile.controller';
import { AuthProviderManager } from '@gitroom/backend/services/auth/providers/providers.manager';
import { GithubProvider } from '@gitroom/backend/services/auth/providers/github.provider';
import { GoogleProvider } from '@gitroom/backend/services/auth/providers/google.provider';
import { FarcasterProvider } from '@gitroom/backend/services/auth/providers/farcaster.provider';
import { WalletProvider } from '@gitroom/backend/services/auth/providers/wallet.provider';
import { OauthProvider } from '@gitroom/backend/services/auth/providers/oauth.provider';

const authenticatedController = [
  UsersController,
  AnalyticsController,
  IntegrationsController,
  SettingsController,
  PostsController,
  MediaController,
  BillingController,
  NotificationsController,
  CopilotController,
  WebhookController,
  SignatureController,
  AutopostController,
  SetsController,
  ThirdPartyController,
  OAuthAppController,
  ApprovedAppsController,
  OAuthAuthorizedController,
  AnnouncementsController,
  AdminController,
  DealsController,
  InfluencersController,
  PaymentsController,
  ContractsController,
  InboxController,
  ScheduleController,
  CreatorScriptsController,
  CreatorProfileController,
  ConnectionsController,
];
@Module({
  imports: [UploadModule],
  controllers: [
    RootController,
    StripeController,
    AuthController,
    PublicController,
    MonitorController,
    EnterpriseController,
    NoAuthIntegrationsController,
    OAuthController,
    IlluminatiOAuthController,
    ...authenticatedController,
  ],
  providers: [
    AuthService,
    StripeService,
    OpenaiService,
    ExtractContentService,
    AuthMiddleware,
    PoliciesGuard,
    PermissionsService,
    CodesService,
    IntegrationManager,
    TrackService,
    ShortLinkService,
    Nowpayments,
    AuthProviderManager,
    GithubProvider,
    GoogleProvider,
    FarcasterProvider,
    WalletProvider,
    OauthProvider,
    { provide: EMAIL_PROVIDER_TOKEN, useClass: GmailEmailProvider },
    { provide: CALENDAR_PROVIDER_TOKEN, useClass: GoogleCalendarProvider },
    { provide: PUBLISHING_PROVIDER_TOKEN, useClass: MockPublishingProvider },
    PipelineOrchestrator,
    GoogleTokenService,
    GmailEmailProvider,
    GoogleCalendarProvider,
    InstagramFetcherService,
  ],
  get exports() {
    return [...this.imports, ...this.providers];
  },
})
export class ApiModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes(...authenticatedController);
  }
}
