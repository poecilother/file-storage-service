import { Inject, Injectable } from '@nestjs/common'
import type { RedisClientType } from '@redis/client'

import { REDIS_CLIENT } from '../../cache/cache.constants'
import { FileEntity, FileStorage } from '../../database/entities/file.entity'

@Injectable()
export class FileCacheService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redisClient: RedisClientType,
  ) {}

  async set(file: Pick<FileEntity, 'id' | 'type' | 'storage'>): Promise<void> {
    await this.redisClient.set(
      this.buildStorageKey(file.type, file.id),
      file.storage,
    )

    await this.redisClient.sAdd(this.buildTypeKey(file.type), file.id)
  }

  getIdsByType(type: string): Promise<string[]> {
    return this.redisClient.sMembers(this.buildTypeKey(type))
  }

  async getStorage(type: string, id: string): Promise<FileStorage | null> {
    const storage = await this.redisClient.get(this.buildStorageKey(type, id))

    return storage as FileStorage | null
  }

  async delete(type: string, id: string): Promise<void> {
    await this.redisClient.del(this.buildStorageKey(type, id))
    await this.redisClient.sRem(this.buildTypeKey(type), id)
  }

  private buildTypeKey(type: string): string {
    return `file:type:${type}`
  }

  private buildStorageKey(type: string, id: string): string {
    return `file:${type}:${id}`
  }
}
