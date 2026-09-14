import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SchedulerRegistry } from '@nestjs/schedule'
import { InjectRepository } from '@nestjs/typeorm'
import { CronJob } from 'cron'
import { LessThan, Repository } from 'typeorm'

import { EnvVariable } from '../../config/env/env-variable.constants'
import { FileEntity, FileStorage } from '../../database/entities/file.entity'
import { StorageService } from '../../storage/storage.service'
import { FileCacheService } from './file-cache.service'

const ARCHIVE_CRON_JOB_NAME = 'archive-old-hot-files'

@Injectable()
export class FileArchiveService implements OnModuleInit {
  private readonly logger = new Logger(FileArchiveService.name)

  constructor(
    private readonly configService: ConfigService,
    private readonly storageService: StorageService,
    private readonly fileCacheService: FileCacheService,
    private readonly schedulerRegistry: SchedulerRegistry,
    @InjectRepository(FileEntity)
    private readonly fileRepository: Repository<FileEntity>,
  ) {}

  onModuleInit(): void {
    this.runCronJobWithConfiguredCronTime()
  }

  async archiveOldHotFiles(): Promise<void> {
    const archiveAfterMs = this.configService.getOrThrow<number>(
      EnvVariable.FILE_ARCHIVE_AFTER_MS,
    )
    const cutoff = new Date(Date.now() - archiveAfterMs)

    const files = await this.fileRepository.find({
      where: { storage: FileStorage.HOT, createdAt: LessThan(cutoff) },
    })

    let archivedCount = 0

    for (const file of files) {
      const archived = await this.archiveFile(file)

      if (archived) {
        archivedCount++
      }
    }

    if (files.length > 0) {
      this.logger.log(`Archived ${archivedCount} of ${files.length} files`)
    }
  }

  private async archiveFile(file: FileEntity): Promise<boolean> {
    try {
      await this.storageService.moveToArchive(file.id, file.originalName)

      await this.fileRepository.update(file.id, {
        storage: FileStorage.ARCHIVE,
      })
    } catch (error) {
      this.logger.warn(
        `Failed to archive file ${file.id}: ${(error as Error).message}`,
      )

      return false
    }

    await this.fileCacheService
      .set({ id: file.id, type: file.type, storage: FileStorage.ARCHIVE })
      .catch((error: Error) => {
        this.logger.warn(
          `Failed to update cache for archived file ${file.id}: ${error.message}`,
        )
      })

    return true
  }

  private runCronJobWithConfiguredCronTime(): void {
    const cronTime = this.configService.getOrThrow<string>(
      EnvVariable.FILE_ARCHIVE_CRON,
    )

    const job = new CronJob(cronTime, () => void this.archiveOldHotFiles())

    this.schedulerRegistry.addCronJob(ARCHIVE_CRON_JOB_NAME, job)
    job.start()
  }
}
