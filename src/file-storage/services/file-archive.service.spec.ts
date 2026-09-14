import { ConfigService } from '@nestjs/config'
import { SchedulerRegistry } from '@nestjs/schedule'
import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { CronJob } from 'cron'

import { FileEntity, FileStorage } from '../../database/entities/file.entity'
import { StorageService } from '../../storage/storage.service'
import { FileArchiveService } from './file-archive.service'
import { FileCacheService } from './file-cache.service'

jest.mock('cron', () => ({
  CronJob: jest.fn().mockImplementation((cronTime: string) => ({
    cronTime,
    start: jest.fn(),
    stop: jest.fn(),
  })),
}))

describe('FileArchiveService', () => {
  let service: FileArchiveService
  let configService: { getOrThrow: jest.Mock }
  let storageService: { moveToArchive: jest.Mock }
  let fileCacheService: { set: jest.Mock }
  let fileRepository: { find: jest.Mock; update: jest.Mock }
  let schedulerRegistry: { addCronJob: jest.Mock }

  const oldFile = {
    id: 'old-file',
    type: 'document',
    originalName: 'report.txt',
    storage: FileStorage.HOT,
  }

  beforeEach(async () => {
    configService = {
      getOrThrow: jest.fn((key: string) =>
        key === 'FILE_ARCHIVE_CRON' ? '0 * * * *' : 1000,
      ),
    }
    storageService = {
      moveToArchive: jest.fn(() => Promise.resolve()),
    }
    fileCacheService = { set: jest.fn(() => Promise.resolve()) }
    fileRepository = {
      find: jest.fn(() => Promise.resolve([])),
      update: jest.fn(() =>
        Promise.resolve({ affected: 1, raw: [], generatedMaps: [] }),
      ),
    }
    schedulerRegistry = { addCronJob: jest.fn() }

    jest.mocked(CronJob).mockClear()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileArchiveService,
        { provide: ConfigService, useValue: configService },
        { provide: StorageService, useValue: storageService },
        { provide: FileCacheService, useValue: fileCacheService },
        { provide: SchedulerRegistry, useValue: schedulerRegistry },
        { provide: getRepositoryToken(FileEntity), useValue: fileRepository },
      ],
    }).compile()

    service = module.get<FileArchiveService>(FileArchiveService)
  })

  describe('onModuleInit', () => {
    it('registers and starts a cron job using the configured schedule', () => {
      service.onModuleInit()

      expect(configService.getOrThrow).toHaveBeenCalledWith('FILE_ARCHIVE_CRON')
      expect(CronJob).toHaveBeenCalledWith('0 * * * *', expect.any(Function))

      const job = jest.mocked(CronJob).mock.results[0].value as {
        start: jest.Mock
      }

      expect(schedulerRegistry.addCronJob).toHaveBeenCalledWith(
        'archive-old-hot-files',
        job,
      )
      expect(job.start).toHaveBeenCalled()
    })
  })

  describe('archiveOldHotFiles', () => {
    it('queries for hot files older than the configured threshold', async () => {
      await service.archiveOldHotFiles()

      expect(configService.getOrThrow).toHaveBeenCalledWith(
        'FILE_ARCHIVE_AFTER_MS',
      )
      expect(fileRepository.find).toHaveBeenCalledWith({
        where: {
          storage: FileStorage.HOT,
          createdAt: expect.anything(),
        },
      })
    })

    it('moves the file to archive storage, flips the storage tier, and updates the cache', async () => {
      fileRepository.find.mockResolvedValueOnce([oldFile])

      await service.archiveOldHotFiles()

      expect(storageService.moveToArchive).toHaveBeenCalledWith(
        'old-file',
        'report.txt',
      )
      expect(fileRepository.update).toHaveBeenCalledWith('old-file', {
        storage: FileStorage.ARCHIVE,
      })
      expect(fileCacheService.set).toHaveBeenCalledWith({
        id: 'old-file',
        type: 'document',
        storage: FileStorage.ARCHIVE,
      })
    })

    it('does not flip the storage tier when the move fails', async () => {
      fileRepository.find.mockResolvedValueOnce([oldFile])
      storageService.moveToArchive.mockRejectedValueOnce(
        new Error('minio down'),
      )

      await service.archiveOldHotFiles()

      expect(fileRepository.update).not.toHaveBeenCalled()
      expect(fileCacheService.set).not.toHaveBeenCalled()
    })

    it('still counts the file as archived when the cache update fails', async () => {
      fileRepository.find.mockResolvedValueOnce([oldFile])
      fileCacheService.set.mockRejectedValueOnce(new Error('redis down'))

      await expect(service.archiveOldHotFiles()).resolves.not.toThrow()

      expect(fileRepository.update).toHaveBeenCalledWith('old-file', {
        storage: FileStorage.ARCHIVE,
      })
    })

    it('continues archiving remaining files when one fails', async () => {
      const secondFile = { ...oldFile, id: 'second-file' }
      fileRepository.find.mockResolvedValueOnce([oldFile, secondFile])
      storageService.moveToArchive.mockRejectedValueOnce(
        new Error('minio down'),
      )

      await service.archiveOldHotFiles()

      expect(fileRepository.update).toHaveBeenCalledTimes(1)
      expect(fileRepository.update).toHaveBeenCalledWith('second-file', {
        storage: FileStorage.ARCHIVE,
      })
    })
  })
})
