import { Module } from '@nestjs/common'
import { ConfigModule as NestConfigModule } from '@nestjs/config'

import { validationSchema } from './env/validation.schema'

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      validationSchema,
    }),
  ],
})
export class ConfigModule {}
