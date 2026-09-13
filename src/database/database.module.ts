import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'

import { EnvVariable } from '../config/env/env-variable.constants'
import entities from './entities'

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.getOrThrow<string>(EnvVariable.POSTGRES_HOST),
        port: configService.getOrThrow<number>(EnvVariable.POSTGRES_PORT),
        username: configService.getOrThrow<string>(EnvVariable.POSTGRES_USER),
        password: configService.getOrThrow<string>(
          EnvVariable.POSTGRES_PASSWORD,
        ),
        database: configService.getOrThrow<string>(EnvVariable.POSTGRES_DB),
        autoLoadEntities: true,
        migrations: ['dist/database/migrations/*.js'],
        migrationsRun: true,

        entities,
      }),
    }),
  ],
})
export class DatabaseModule {}
