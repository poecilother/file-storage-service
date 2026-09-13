import { Module } from '@nestjs/common'
import { CacheModule } from './cache/cache.module'
import { ConfigModule } from './config/config.module'
import { DatabaseModule } from './database/database.module'
import { HealthModule } from './health/health.module'

@Module({
  imports: [ConfigModule, CacheModule, DatabaseModule, HealthModule],
})
export class AppModule {}
