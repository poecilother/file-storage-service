import { Readable } from 'node:stream'

import { HttpException, HttpStatus } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'

import { FileEntity, FileStorage } from '../../database/entities/file.entity'
import { StorageService } from '../../storage/storage.service'
import { FileCacheService } from './file-cache.service'
import { FileStorageService } from './file-storage.service'

describe('FileStorageService', () => {
  let service: FileStorageService
  let storageService: {
    upload: jest.Mock
    delete: jest.Mock
    download: jest.Mock
  }
  let fileCacheService: {
    set: jest.Mock
    getStorage: jest.Mock
    getIdsByType: jest.Mock
    delete: jest.Mock
  }
  let fileRepository: {
    create: jest.Mock
    save: jest.Mock
    delete: jest.Mock
    softDelete: jest.Mock
    findOneBy: jest.Mock
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
      download: jest.fn(),
    }
    fileCacheService = {
      set: jest.fn(() => Promise.resolve()),
      getStorage: jest.fn(),
      getIdsByType: jest.fn(),
      delete: jest.fn(() => Promise.resolve()),
    }
    fileRepository = {
      create: jest.fn((entity) => entity),
      save: jest.fn((entity) => Promise.resolve(entity)),
      delete: jest.fn(() => Promise.resolve({ affected: 1, raw: [] })),
      softDelete: jest.fn(() => Promise.resolve({ affected: 1, raw: [] })),
      findOneBy: jest.fn(),
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

  describe('getFileStorage', () => {
    it('returns the id, type, and storage from the cache without querying the database', async () => {
      fileCacheService.getStorage.mockResolvedValueOnce(FileStorage.HOT)

      const result = await service.getFileStorage('abc-123', 'document')

      expect(fileCacheService.getStorage).toHaveBeenCalledWith(
        'document',
        'abc-123',
      )
      expect(fileRepository.findOneBy).not.toHaveBeenCalled()
      expect(result).toEqual({
        id: 'abc-123',
        type: 'document',
        storage: FileStorage.HOT,
      })
    })

    it('falls back to the database and repopulates the cache on a cache miss', async () => {
      fileCacheService.getStorage.mockResolvedValueOnce(null)
      fileRepository.findOneBy.mockResolvedValueOnce({
        id: 'abc-123',
        type: 'document',
        storage: FileStorage.ARCHIVE,
      })

      const result = await service.getFileStorage('abc-123', 'document')

      expect(fileRepository.findOneBy).toHaveBeenCalledWith({
        id: 'abc-123',
        type: 'document',
      })
      expect(fileCacheService.set).toHaveBeenCalledWith({
        id: 'abc-123',
        type: 'document',
        storage: FileStorage.ARCHIVE,
      })
      expect(result).toEqual({
        id: 'abc-123',
        type: 'document',
        storage: FileStorage.ARCHIVE,
      })
    })

    it('still returns the result when repopulating the cache fails', async () => {
      fileCacheService.getStorage.mockResolvedValueOnce(null)
      fileRepository.findOneBy.mockResolvedValueOnce({
        id: 'abc-123',
        type: 'document',
        storage: FileStorage.HOT,
      })
      fileCacheService.set.mockRejectedValueOnce(new Error('redis down'))

      const result = await service.getFileStorage('abc-123', 'document')

      expect(result).toEqual({
        id: 'abc-123',
        type: 'document',
        storage: FileStorage.HOT,
      })
    })

    it('throws a not-found when neither cached nor in the database', async () => {
      fileCacheService.getStorage.mockResolvedValueOnce(null)
      fileRepository.findOneBy.mockResolvedValueOnce(null)

      await expect(
        service.getFileStorage('abc-123', 'document'),
      ).rejects.toThrow(HttpException)

      try {
        await service.getFileStorage('abc-123', 'document')

        throw new Error('expected getFileStorage to throw')
      } catch (error) {
        expect((error as HttpException).getStatus()).toBe(HttpStatus.NOT_FOUND)
      }
    })
  })

  describe('getFile', () => {
    it('returns the stream and entity using the storage tier from the database', async () => {
      const fileEntity = {
        id: 'abc-123',
        type: 'document',
        originalName: 'report.txt',
        storage: FileStorage.ARCHIVE,
      }
      fileRepository.findOneBy.mockResolvedValueOnce(fileEntity)
      const stream = Readable.from(Buffer.from('content'))
      storageService.download.mockResolvedValueOnce(stream)

      const result = await service.getFile('abc-123', 'document')

      expect(fileRepository.findOneBy).toHaveBeenCalledWith({
        id: 'abc-123',
        type: 'document',
      })
      expect(storageService.download).toHaveBeenCalledWith(
        'abc-123',
        FileStorage.ARCHIVE,
        'report.txt',
      )
      expect(result).toEqual({ stream, fileEntity })
    })

    it('throws a not-found when the file does not exist, regardless of the cache', async () => {
      fileRepository.findOneBy.mockResolvedValueOnce(null)

      await expect(service.getFile('abc-123', 'document')).rejects.toThrow(
        HttpException,
      )
      expect(fileCacheService.getStorage).not.toHaveBeenCalled()
    })
  })

  describe('deleteFile', () => {
    const fileEntity = {
      id: 'abc-123',
      type: 'document',
      originalName: 'report.txt',
      storage: FileStorage.HOT,
    }

    it('soft-deletes the entity, then deletes the storage and cache entry', async () => {
      fileRepository.findOneBy.mockResolvedValueOnce(fileEntity)

      await service.deleteFile('abc-123', 'document')

      expect(fileRepository.softDelete).toHaveBeenCalledWith('abc-123')
      expect(fileRepository.delete).not.toHaveBeenCalled()
      expect(storageService.delete).toHaveBeenCalledWith(
        'abc-123',
        FileStorage.HOT,
        'report.txt',
      )
      expect(fileCacheService.delete).toHaveBeenCalledWith(
        'document',
        'abc-123',
      )
    })

    it('throws a not-found and deletes nothing when the file does not exist', async () => {
      fileRepository.findOneBy.mockResolvedValueOnce(null)

      await expect(service.deleteFile('abc-123', 'document')).rejects.toThrow(
        HttpException,
      )

      expect(fileRepository.softDelete).not.toHaveBeenCalled()
      expect(storageService.delete).not.toHaveBeenCalled()
      expect(fileCacheService.delete).not.toHaveBeenCalled()
    })

    it('still succeeds and still cleans up the cache when deleting storage fails', async () => {
      fileRepository.findOneBy.mockResolvedValueOnce(fileEntity)
      storageService.delete.mockRejectedValueOnce(new Error('minio down'))

      await expect(
        service.deleteFile('abc-123', 'document'),
      ).resolves.toBeUndefined()

      expect(fileCacheService.delete).toHaveBeenCalledWith(
        'document',
        'abc-123',
      )
    })

    it('still succeeds when deleting the cache entry fails', async () => {
      fileRepository.findOneBy.mockResolvedValueOnce(fileEntity)
      fileCacheService.delete.mockRejectedValueOnce(new Error('redis down'))

      await expect(
        service.deleteFile('abc-123', 'document'),
      ).resolves.toBeUndefined()
    })
  })

  describe('getFileListByType', () => {
    it('returns the ids cached under the given type', async () => {
      fileCacheService.getIdsByType.mockResolvedValueOnce(['id-1', 'id-2'])

      const result = await service.getFileListByType('document')

      expect(fileCacheService.getIdsByType).toHaveBeenCalledWith('document')
      expect(result).toEqual(['id-1', 'id-2'])
    })

    it('returns an empty array when no files are cached for the type', async () => {
      fileCacheService.getIdsByType.mockResolvedValueOnce([])

      const result = await service.getFileListByType('document')

      expect(result).toEqual([])
    })
  })
})
