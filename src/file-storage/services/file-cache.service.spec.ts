import { Test, TestingModule } from '@nestjs/testing'

import { REDIS_CLIENT } from '../../cache/cache.constants'
import { FileStorage } from '../../database/entities/file.entity'
import { FileCacheService } from './file-cache.service'

describe('FileCacheService', () => {
  let service: FileCacheService
  let redisClient: {
    set: jest.Mock
    get: jest.Mock
    del: jest.Mock
    sAdd: jest.Mock
    sRem: jest.Mock
    sMembers: jest.Mock
  }

  beforeEach(async () => {
    redisClient = {
      set: jest.fn(() => Promise.resolve('OK')),
      get: jest.fn(() => Promise.resolve(null)),
      del: jest.fn(() => Promise.resolve(1)),
      sAdd: jest.fn(() => Promise.resolve(1)),
      sRem: jest.fn(() => Promise.resolve(1)),
      sMembers: jest.fn(() => Promise.resolve([])),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileCacheService,
        { provide: REDIS_CLIENT, useValue: redisClient },
      ],
    }).compile()

    service = module.get<FileCacheService>(FileCacheService)
  })

  describe('set', () => {
    it('stores the storage tier under the type:id key', async () => {
      await service.set({
        id: 'abc-123',
        type: 'document',
        storage: FileStorage.HOT,
      })

      expect(redisClient.set).toHaveBeenCalledWith(
        'file:document:abc-123',
        FileStorage.HOT,
      )
    })

    it('adds the id to the type index set', async () => {
      await service.set({
        id: 'abc-123',
        type: 'document',
        storage: FileStorage.HOT,
      })

      expect(redisClient.sAdd).toHaveBeenCalledWith(
        'file:type:document',
        'abc-123',
      )
    })
  })

  describe('getIdsByType', () => {
    it('returns the members of the type index set', async () => {
      redisClient.sMembers.mockResolvedValueOnce(['id-1', 'id-2'])

      const ids = await service.getIdsByType('document')

      expect(redisClient.sMembers).toHaveBeenCalledWith('file:type:document')
      expect(ids).toEqual(['id-1', 'id-2'])
    })

    it('returns an empty array when the type has no files', async () => {
      redisClient.sMembers.mockResolvedValueOnce([])

      const ids = await service.getIdsByType('document')

      expect(ids).toEqual([])
    })
  })

  describe('getStorage', () => {
    it('returns the cached storage tier for a type:id pair', async () => {
      redisClient.get.mockResolvedValueOnce(FileStorage.ARCHIVE)

      const storage = await service.getStorage('document', 'abc-123')

      expect(redisClient.get).toHaveBeenCalledWith('file:document:abc-123')
      expect(storage).toBe(FileStorage.ARCHIVE)
    })

    it('returns null on a cache miss', async () => {
      redisClient.get.mockResolvedValueOnce(null)

      const storage = await service.getStorage('document', 'abc-123')

      expect(storage).toBeNull()
    })
  })

  describe('delete', () => {
    it('removes the storage tier key', async () => {
      await service.delete('document', 'abc-123')

      expect(redisClient.del).toHaveBeenCalledWith('file:document:abc-123')
    })

    it('removes the id from the type index set', async () => {
      await service.delete('document', 'abc-123')

      expect(redisClient.sRem).toHaveBeenCalledWith(
        'file:type:document',
        'abc-123',
      )
    })
  })
})
