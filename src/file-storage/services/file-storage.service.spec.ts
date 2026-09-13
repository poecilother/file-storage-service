import { Readable } from 'node:stream'

import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'

import { FileEntity, FileStorage } from '../../database/entities/file.entity'
import { StorageService } from '../../storage/storage.service'
import { FileCacheService } from './file-cache.service'
import { FileStorageService } from './file-storage.service'

describe('FileStorageService', () => {
  let service: FileStorageService
  let storageService: { upload: jest.Mock; delete: jest.Mock }
  let fileCacheService: { set: jest.Mock }
  let fileRepository: {
    create: jest.Mock
    save: jest.Mock
    delete: jest.Mock
  }

  const file: Express.Multer.File = {
    fieldname: 'file',
    originalname: 'report.txt',
    encoding: '7bit',
    mimetype: 'text/plain',
    size: 19,
    buffer: Buffer.from('very important file'),
    stream: Readable.from(Buffer.alloc(0)),
    destination: '',
    filename: '',
    path: '',
  }

  beforeEach(async () => {
    storageService = {
      upload: jest.fn(),
      delete: jest.fn(() => Promise.resolve()),
    }
    fileCacheService = { set: jest.fn() }
    fileRepository = {
      create: jest.fn((entity) => entity),
      save: jest.fn((entity) => Promise.resolve(entity)),
      delete: jest.fn(() => Promise.resolve({ affected: 1, raw: [] })),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileStorageService,
        { provide: StorageService, useValue: storageService },
        { provide: FileCacheService, useValue: fileCacheService },
        { provide: getRepositoryToken(FileEntity), useValue: fileRepository },
      ],
    }).compile()

    service = module.get<FileStorageService>(FileStorageService)
  })

  describe('saveFile', () => {
    it('should successfully upload a file', async () => {
      await service.saveFile(file, 'document')

      expect(storageService.upload).toHaveBeenCalledTimes(1)
      const [id, stream, storage, originalName] =
        storageService.upload.mock.calls[0]

      expect(typeof id).toBe('string')
      expect(storage).toBe(FileStorage.HOT)
      expect(originalName).toBe('report.txt')

      const chunks: Buffer[] = []
      for await (const chunk of stream as Readable) {
        chunks.push(chunk as Buffer)
      }
      expect(Buffer.concat(chunks)).toEqual(file.buffer)

      expect(fileRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'document',
          originalName: 'report.txt',
          mimetype: 'text/plain',
          size: 19,
          storage: FileStorage.HOT,
        }),
      )
      expect(fileRepository.save).toHaveBeenCalledTimes(1)

      expect(fileCacheService.set).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'document', storage: FileStorage.HOT }),
      )
    })

    it('throws error and rolls back nothing when the storage upload fails', async () => {
      const error = new Error('minio unavailable')
      storageService.upload.mockRejectedValueOnce(error)

      await expect(service.saveFile(file, 'document')).rejects.toThrow(error)

      expect(fileRepository.save).not.toHaveBeenCalled()
      expect(fileCacheService.set).not.toHaveBeenCalled()
      expect(fileRepository.delete).not.toHaveBeenCalled()
      expect(storageService.delete).not.toHaveBeenCalled()
    })

    it('rolls back the uploaded file and throws error when saving to database fails', async () => {
      const error = new Error('postgres unavailable')
      fileRepository.save.mockRejectedValueOnce(error)

      await expect(service.saveFile(file, 'document')).rejects.toThrow(error)

      const [uploadedId] = storageService.upload.mock.calls[0]

      expect(storageService.delete).toHaveBeenCalledWith(
        uploadedId,
        FileStorage.HOT,
        'report.txt',
      )
      expect(fileRepository.delete).not.toHaveBeenCalled()
      expect(fileCacheService.set).not.toHaveBeenCalled()
    })

    it('rolls back both the uploaded file and entity when caching fails', async () => {
      const error = new Error('redis unavailable')
      fileCacheService.set.mockRejectedValueOnce(error)

      await expect(service.saveFile(file, 'document')).rejects.toThrow(error)

      const [uploadedId] = storageService.upload.mock.calls[0]

      expect(fileRepository.delete).toHaveBeenCalledWith(uploadedId)
      expect(storageService.delete).toHaveBeenCalledWith(
        uploadedId,
        FileStorage.HOT,
        'report.txt',
      )
    })
  })
})
