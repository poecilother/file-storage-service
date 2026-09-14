import { Readable } from 'node:stream'

import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import request from 'supertest'
import { App } from 'supertest/types'

import { ConfigModule } from '../../config/config.module'
import { FileEntity } from '../../database/entities/file.entity'
import { StorageService } from '../../storage/storage.service'
import { FileValidatorPipe } from '../pipes/file-validator.pipe'
import { FileCacheService } from '../services/file-cache.service'
import { FileStorageService } from '../services/file-storage.service'
import { FileStorageController } from './file-storage.controller'

describe('FileStorageController', () => {
  const url = '/file-storage'
  let app: INestApplication<App>
  let fileStorageService: FileStorageService
  let fileCacheService: {
    getStorage: jest.Mock
    getIdsByType: jest.Mock
    delete: jest.Mock
  }
  let storageService: { download: jest.Mock; delete: jest.Mock }
  let fileRepository: {
    findOneBy: jest.Mock
    delete: jest.Mock
    softDelete: jest.Mock
  }

  beforeEach(async () => {
    fileCacheService = {
      getStorage: jest.fn(),
      getIdsByType: jest.fn(),
      delete: jest.fn(() => Promise.resolve()),
    }
    storageService = {
      download: jest.fn(),
      delete: jest.fn(() => Promise.resolve()),
    }
    fileRepository = {
      findOneBy: jest.fn(),
      delete: jest.fn(() => Promise.resolve({ affected: 1, raw: [] })),
      softDelete: jest.fn(() => Promise.resolve({ affected: 1, raw: [] })),
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule],
      controllers: [FileStorageController],
      providers: [
        FileValidatorPipe,
        FileStorageService,
        {
          provide: StorageService,
          useValue: {
            upload: jest.fn(() => Promise.resolve()),
            ...storageService,
          },
        },
        {
          provide: FileCacheService,
          useValue: {
            set: jest.fn(() => Promise.resolve()),
            ...fileCacheService,
          },
        },
        {
          provide: getRepositoryToken(FileEntity),
          useValue: {
            create: jest.fn((entity) => entity),
            save: jest.fn((entity) => Promise.resolve(entity)),
            ...fileRepository,
          },
        },
      ],
    }).compile()

    fileStorageService =
      moduleFixture.get<FileStorageService>(FileStorageService)

    app = moduleFixture.createNestApplication()
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))

    await app.init()
  })

  afterEach(async () => {
    await app.close()
  })

  describe('POST /file-storage', () => {
    it('returns the id of the saved file', () => {
      return request(app.getHttpServer())
        .post(url)
        .attach('file', Buffer.from('very important file'), 'report.txt')
        .field('fileType', 'document')
        .expect(HttpStatus.CREATED)
        .expect((response) => {
          expect(response.body).toEqual({ id: expect.any(String) })
        })
    })

    it('fails with a server error when saving the file fails', () => {
      jest
        .spyOn(fileStorageService, 'saveFile')
        .mockRejectedValueOnce(new Error('save failed'))

      return request(app.getHttpServer())
        .post(url)
        .attach('file', Buffer.from('very important file'), 'report.txt')
        .field('fileType', 'document')
        .expect(HttpStatus.INTERNAL_SERVER_ERROR)
    })

    it('rejects a file larger than FILE_MAX_SIZE', () => {
      const oversizedBuffer = Buffer.alloc(2 * 1024 * 1024) // 2MB > 1MB default

      return request(app.getHttpServer())
        .post(url)
        .attach('file', oversizedBuffer, 'big.txt')
        .field('fileType', 'document')
        .expect(HttpStatus.BAD_REQUEST)
        .expect((response) => {
          expect(response.body).toEqual({
            error: 'Bad Request',
            message:
              'Validation failed (current file size is 2097152, expected size is less than 1048576)',
            statusCode: HttpStatus.BAD_REQUEST,
          })
        })
    })

    it('rejects a file with a disallowed extension', () => {
      return request(app.getHttpServer())
        .post(url)
        .attach('file', Buffer.from('malicious'), 'malware.exe')
        .field('fileType', 'document')
        .expect(HttpStatus.BAD_REQUEST)
        .expect((response) => {
          expect(response.body).toEqual({
            error: 'Bad Request',
            message:
              'Validation failed (extension of file "malware.exe" is not allowed, allowed extensions are: txt, pdf, png, jpg, jpeg)',
            statusCode: HttpStatus.BAD_REQUEST,
          })
        })
    })

    it('rejects a request missing fileType', () => {
      return request(app.getHttpServer())
        .post(url)
        .attach('file', Buffer.from('very important file'), 'report.txt')
        .expect(HttpStatus.BAD_REQUEST)
        .expect((response) => {
          expect(response.body).toEqual({
            error: 'Bad Request',
            message: [
              'fileType must be shorter than or equal to 50 characters',
              'fileType should not be empty',
              'fileType must be a string',
            ],
            statusCode: HttpStatus.BAD_REQUEST,
          })
        })
    })

    it('rejects an empty fileType', () => {
      return request(app.getHttpServer())
        .post(url)
        .attach('file', Buffer.from('very important file'), 'report.txt')
        .field('fileType', '')
        .expect(HttpStatus.BAD_REQUEST)
        .expect((response) => {
          expect(response.body).toEqual({
            error: 'Bad Request',
            message: ['fileType should not be empty'],
            statusCode: HttpStatus.BAD_REQUEST,
          })
        })
    })

    it('rejects a fileType longer than 50 characters', () => {
      return request(app.getHttpServer())
        .post(url)
        .attach('file', Buffer.from('very important file'), 'report.txt')
        .field('fileType', 'a'.repeat(51))
        .expect(HttpStatus.BAD_REQUEST)
        .expect((response) => {
          expect(response.body).toEqual({
            error: 'Bad Request',
            message: [
              'fileType must be shorter than or equal to 50 characters',
            ],
            statusCode: HttpStatus.BAD_REQUEST,
          })
        })
    })
  })

  describe('GET /file-storage/:id/:type', () => {
    it('streams the file content with the correct headers', () => {
      fileRepository.findOneBy.mockResolvedValueOnce({
        id: '00000000-0000-0000-0000-000000000001',
        type: 'document',
        originalName: 'report.txt',
        mimetype: 'text/plain',
        storage: 'hot',
      })
      storageService.download.mockResolvedValueOnce(
        Readable.from(Buffer.from('file content')),
      )

      return request(app.getHttpServer())
        .get(`${url}/00000000-0000-0000-0000-000000000001/document`)
        .expect(HttpStatus.OK)
        .expect('Content-Type', 'text/plain')
        .expect(
          'Content-Disposition',
          `attachment; filename*=UTF-8''report.txt`,
        )
        .expect((response) => {
          expect(response.text).toBe('file content')
        })
    })

    it('serves the file even when the cache has nothing for it', () => {
      fileRepository.findOneBy.mockResolvedValueOnce({
        id: '00000000-0000-0000-0000-000000000001',
        type: 'document',
        originalName: 'report.txt',
        mimetype: 'text/plain',
        storage: 'hot',
      })
      storageService.download.mockResolvedValueOnce(
        Readable.from(Buffer.from('file content')),
      )

      return request(app.getHttpServer())
        .get(`${url}/00000000-0000-0000-0000-000000000001/document`)
        .expect(HttpStatus.OK)
        .expect((response) => {
          expect(response.text).toBe('file content')
          expect(fileCacheService.getStorage).not.toHaveBeenCalled()
        })
    })

    it('returns 404 when the file does not exist', () => {
      fileRepository.findOneBy.mockResolvedValueOnce(null)

      return request(app.getHttpServer())
        .get(`${url}/00000000-0000-0000-0000-000000000001/document`)
        .expect(HttpStatus.NOT_FOUND)
        .expect((response) => {
          expect(response.body).toEqual({
            statusCode: HttpStatus.NOT_FOUND,
            message:
              'File with id 00000000-0000-0000-0000-000000000001 and type document not found',
          })
        })
    })

    it('rejects a malformed id before it ever reaches the database', () => {
      return request(app.getHttpServer())
        .get(`${url}/not-a-uuid/document`)
        .expect(HttpStatus.BAD_REQUEST)
        .expect((response) => {
          expect(response.body).toEqual({
            error: 'Bad Request',
            message: 'Validation failed (uuid is expected)',
            statusCode: HttpStatus.BAD_REQUEST,
          })
          expect(fileRepository.findOneBy).not.toHaveBeenCalled()
        })
    })
  })

  describe('GET /file-storage/storage/:id/:type', () => {
    it('returns the id, type, and storage from the cache', () => {
      fileCacheService.getStorage.mockResolvedValueOnce('hot')

      return request(app.getHttpServer())
        .get(`${url}/storage/00000000-0000-0000-0000-000000000001/document`)
        .expect(HttpStatus.OK)
        .expect((response) => {
          expect(response.body).toEqual({
            id: '00000000-0000-0000-0000-000000000001',
            type: 'document',
            storage: 'hot',
          })
          expect(fileRepository.findOneBy).not.toHaveBeenCalled()
        })
    })

    it('falls back to the database on a cache miss', () => {
      fileCacheService.getStorage.mockResolvedValueOnce(null)
      fileRepository.findOneBy.mockResolvedValueOnce({
        id: '00000000-0000-0000-0000-000000000001',
        type: 'document',
        storage: 'archive',
      })

      return request(app.getHttpServer())
        .get(`${url}/storage/00000000-0000-0000-0000-000000000001/document`)
        .expect(HttpStatus.OK)
        .expect((response) => {
          expect(response.body).toEqual({
            id: '00000000-0000-0000-0000-000000000001',
            type: 'document',
            storage: 'archive',
          })
        })
    })

    it('returns 404 when neither cached nor in the database', () => {
      fileCacheService.getStorage.mockResolvedValueOnce(null)
      fileRepository.findOneBy.mockResolvedValueOnce(null)

      return request(app.getHttpServer())
        .get(`${url}/storage/00000000-0000-0000-0000-000000000001/document`)
        .expect(HttpStatus.NOT_FOUND)
        .expect((response) => {
          expect(response.body).toEqual({
            statusCode: HttpStatus.NOT_FOUND,
            message:
              'File with id 00000000-0000-0000-0000-000000000001 and type document not found',
          })
        })
    })

    it('rejects a malformed id before it ever reaches the cache or database', () => {
      return request(app.getHttpServer())
        .get(`${url}/storage/not-a-uuid/document`)
        .expect(HttpStatus.BAD_REQUEST)
        .expect((response) => {
          expect(response.body).toEqual({
            error: 'Bad Request',
            message: 'Validation failed (uuid is expected)',
            statusCode: HttpStatus.BAD_REQUEST,
          })
          expect(fileCacheService.getStorage).not.toHaveBeenCalled()
          expect(fileRepository.findOneBy).not.toHaveBeenCalled()
        })
    })
  })

  describe('DELETE /file-storage/:id/:type', () => {
    const fileEntity = {
      id: '00000000-0000-0000-0000-000000000001',
      type: 'document',
      originalName: 'report.txt',
      storage: 'hot',
    }

    it('deletes the file', () => {
      fileRepository.findOneBy.mockResolvedValueOnce(fileEntity)

      return request(app.getHttpServer())
        .delete(`${url}/00000000-0000-0000-0000-000000000001/document`)
        .expect(HttpStatus.OK)
        .expect(() => {
          expect(fileRepository.softDelete).toHaveBeenCalledWith(
            '00000000-0000-0000-0000-000000000001',
          )
          expect(storageService.delete).toHaveBeenCalledWith(
            '00000000-0000-0000-0000-000000000001',
            'hot',
            'report.txt',
          )
          expect(fileCacheService.delete).toHaveBeenCalledWith(
            'document',
            '00000000-0000-0000-0000-000000000001',
          )
        })
    })

    it('returns 404 when the file does not exist', () => {
      fileRepository.findOneBy.mockResolvedValueOnce(null)

      return request(app.getHttpServer())
        .delete(`${url}/00000000-0000-0000-0000-000000000001/document`)
        .expect(HttpStatus.NOT_FOUND)
        .expect((response) => {
          expect(response.body).toEqual({
            statusCode: HttpStatus.NOT_FOUND,
            message:
              'File with id 00000000-0000-0000-0000-000000000001 and type document not found',
          })
          expect(fileRepository.softDelete).not.toHaveBeenCalled()
        })
    })

    it('still succeeds when deleting from storage fails', () => {
      fileRepository.findOneBy.mockResolvedValueOnce(fileEntity)
      storageService.delete.mockRejectedValueOnce(new Error('minio down'))

      return request(app.getHttpServer())
        .delete(`${url}/00000000-0000-0000-0000-000000000001/document`)
        .expect(HttpStatus.OK)
        .expect(() => {
          expect(fileCacheService.delete).toHaveBeenCalledWith(
            'document',
            '00000000-0000-0000-0000-000000000001',
          )
        })
    })

    it('still succeeds when deleting the cache entry fails', () => {
      fileRepository.findOneBy.mockResolvedValueOnce(fileEntity)
      fileCacheService.delete.mockRejectedValueOnce(new Error('redis down'))

      return request(app.getHttpServer())
        .delete(`${url}/00000000-0000-0000-0000-000000000001/document`)
        .expect(HttpStatus.OK)
    })

    it('rejects a malformed id before it ever reaches the database', () => {
      return request(app.getHttpServer())
        .delete(`${url}/not-a-uuid/document`)
        .expect(HttpStatus.BAD_REQUEST)
        .expect((response) => {
          expect(response.body).toEqual({
            error: 'Bad Request',
            message: 'Validation failed (uuid is expected)',
            statusCode: HttpStatus.BAD_REQUEST,
          })
          expect(fileRepository.findOneBy).not.toHaveBeenCalled()
        })
    })
  })

  describe('GET /file-storage/list', () => {
    it('returns the ids cached under the given type', () => {
      fileCacheService.getIdsByType.mockResolvedValueOnce(['id-1', 'id-2'])

      return request(app.getHttpServer())
        .get(`${url}/list`)
        .query({ fileType: 'document' })
        .expect(HttpStatus.OK)
        .expect((response) => {
          expect(response.body).toEqual(['id-1', 'id-2'])
        })
    })

    it('rejects a request missing fileType', () => {
      return request(app.getHttpServer())
        .get(`${url}/list`)
        .expect(HttpStatus.BAD_REQUEST)
        .expect((response) => {
          expect(response.body).toEqual({
            error: 'Bad Request',
            message: [
              'fileType must be shorter than or equal to 50 characters',
              'fileType should not be empty',
              'fileType must be a string',
            ],
            statusCode: HttpStatus.BAD_REQUEST,
          })
        })
    })

    it('rejects an empty fileType', () => {
      return request(app.getHttpServer())
        .get(`${url}/list`)
        .query({ fileType: '' })
        .expect(HttpStatus.BAD_REQUEST)
        .expect((response) => {
          expect(response.body).toEqual({
            error: 'Bad Request',
            message: ['fileType should not be empty'],
            statusCode: HttpStatus.BAD_REQUEST,
          })
        })
    })
  })
})
