import { Module } from '@nestjs/common'
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager'
import { ConfigService } from '@nestjs/config'
import KeyvRedis from '@keyv/redis'
import { Keyv } from 'keyv'
import { EnvVariable } from '../config/env/env-variable.constants'

@Module({
  imports: [
    NestCacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        stores: [
          new Keyv({
            store: new KeyvRedis(
              `redis://${configService.getOrThrow<string>(EnvVariable.REDIS_HOST)}:${configService.getOrThrow<number>(EnvVariable.REDIS_PORT)}`,
            ),
          }),
        ],
      }),
    }),
  ],
})
export class CacheModule {}
