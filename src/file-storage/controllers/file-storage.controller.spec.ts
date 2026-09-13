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

  beforeEach(async () => {
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
            delete: jest.fn(() => Promise.resolve()),
          },
        },
        {
          provide: FileCacheService,
          useValue: { set: jest.fn(() => Promise.resolve()) },
        },
        {
          provide: getRepositoryToken(FileEntity),
          useValue: {
            create: jest.fn((entity) => entity),
            save: jest.fn((entity) => Promise.resolve(entity)),
            delete: jest.fn(() => Promise.resolve({ affected: 1, raw: [] })),
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
})
