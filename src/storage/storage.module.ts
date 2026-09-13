import { Global, Inject, Module, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Client } from 'minio'

import { EnvVariable } from '../config/env/env-variable.constants'
import { BUCKET_BY_STORAGE, MINIO_CLIENT } from './storage.constants'
import { StorageService } from './storage.service'

@Global()
@Module({
  providers: [
    {
      provide: MINIO_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        new Client({
          endPoint: configService.getOrThrow<string>(EnvVariable.MINIO_HOST),
          port: configService.getOrThrow<number>(EnvVariable.MINIO_PORT),
          useSSL: configService.getOrThrow<boolean>(EnvVariable.MINIO_USE_SSL),
          accessKey: configService.getOrThrow<string>(
            EnvVariable.MINIO_ACCESS_KEY,
          ),
          secretKey: configService.getOrThrow<string>(
            EnvVariable.MINIO_SECRET_KEY,
          ),
        }),
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule implements OnModuleInit {
  constructor(@Inject(MINIO_CLIENT) private readonly minioClient: Client) {}

  async onModuleInit(): Promise<void> {
    for (const bucket of Object.values(BUCKET_BY_STORAGE)) {
      const exists = await this.minioClient.bucketExists(bucket)
      if (!exists) {
        await this.minioClient.makeBucket(bucket)
      }
    }
  }
}
