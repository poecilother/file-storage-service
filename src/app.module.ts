import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'

import { CacheModule } from './cache/cache.module'
import { ConfigModule } from './config/config.module'
import { DatabaseModule } from './database/database.module'
import { FileStorageModule } from './file-storage/file-storage.module'
import { HealthModule } from './health/health.module'
import { StorageModule } from './storage/storage.module'

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    CacheModule,
    DatabaseModule,
    StorageModule,
    HealthModule,
    FileStorageModule,
  ],
})
export class AppModule {}
