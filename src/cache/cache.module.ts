import { Global, Logger, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createClient } from '@redis/client'

import { EnvVariable } from '../config/env/env-variable.constants'
import { REDIS_CLIENT } from './cache.constants'

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const logger = new Logger('RedisClient')
        const client = createClient({
          url: `redis://${configService.getOrThrow<string>(EnvVariable.REDIS_HOST)}:${configService.getOrThrow<number>(EnvVariable.REDIS_PORT)}`,
        })

        client.on('error', (error: Error) =>
          logger.error(`Redis client error: ${error.message}`),
        )

        await client.connect()

        return client
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class CacheModule {}
