import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { FileEntity } from '../database/entities/file.entity'
import controllers from './controllers'
import pipes from './pipes'
import services from './services'

@Module({
  imports: [TypeOrmModule.forFeature([FileEntity])],
  controllers,
  providers: [...services, ...pipes],
})
export class FileStorageModule {}
