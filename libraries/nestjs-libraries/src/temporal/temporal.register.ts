import { Global, Injectable, Logger, Module, OnModuleInit } from '@nestjs/common';
import { TemporalService } from 'nestjs-temporal-core';
import { Connection } from '@temporalio/client';

@Injectable()
export class TemporalRegister implements OnModuleInit {
  private readonly logger = new Logger(TemporalRegister.name);
  constructor(private _client: TemporalService) {}

  async onModuleInit(): Promise<void> {
    if (process.env.TEMPORAL_TLS === 'true') {
      return;
    }
    // Tolerate Temporal being offline — Illuminati dev runs without it
    // (no Docker). Scheduling features will be inert, but the API boots.
    try {
      const connection = this._client?.client?.getRawClient()
        ?.connection as Connection;
      if (!connection) {
        this.logger.warn('Temporal connection unavailable — skipping search attribute registration');
        return;
      }

      const { customAttributes } =
        await connection.operatorService.listSearchAttributes({
          namespace: process.env.TEMPORAL_NAMESPACE || 'default',
        });

      const neededAttribute = ['organizationId', 'postId'];
      const missingAttributes = neededAttribute.filter(
        (attr) => !customAttributes[attr]
      );

      if (missingAttributes.length > 0) {
        await connection.operatorService.addSearchAttributes({
          namespace: process.env.TEMPORAL_NAMESPACE || 'default',
          searchAttributes: missingAttributes.reduce((all, current) => {
            // @ts-ignore
            all[current] = 1;
            return all;
          }, {}),
        });
      }
    } catch (err) {
      this.logger.warn(
        `Temporal register skipped: ${(err as Error).message}`
      );
    }
  }
}

@Global()
@Module({
  imports: [],
  controllers: [],
  providers: [TemporalRegister],
  get exports() {
    return this.providers;
  },
})
export class TemporalRegisterMissingSearchAttributesModule {}
