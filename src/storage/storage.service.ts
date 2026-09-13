import { createReadStream, createWriteStream, WriteStream } from 'node:fs'
import { access, mkdir, rm } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Client } from 'minio'

import { EnvVariable } from '../config/env/env-variable.constants'
import { FileStorage } from '../database/entities/file.entity'
import { BUCKET_BY_STORAGE, MINIO_CLIENT } from './storage.constants'

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name)

  constructor(
    @Inject(MINIO_CLIENT) private readonly minioClient: Client,
    private readonly configService: ConfigService,
  ) {}

  async upload(
    id: string,
    stream: Readable,
    storage: FileStorage,
    originalName: string,
  ): Promise<void> {
    const key = this.buildKey(id, originalName)

    if (storage === FileStorage.HOT) {
      const path = await this.diskCachePath(key)

      await pipeline(stream, createWriteStream(path))

      await this.minioClient.putObject(
        BUCKET_BY_STORAGE[storage],
        key,
        createReadStream(path),
      )

      return
    }

    await this.minioClient.putObject(BUCKET_BY_STORAGE[storage], key, stream)
  }

  async download(
    id: string,
    storage: FileStorage,
    originalName: string,
  ): Promise<Readable> {
    const key = this.buildKey(id, originalName)
    const path = await this.diskCachePath(key)

    if (storage === FileStorage.HOT && (await this.exists(path))) {
      return createReadStream(path)
    }

    const stream = await this.minioClient.getObject(
      BUCKET_BY_STORAGE[storage],
      key,
    )

    if (storage === FileStorage.HOT) {
      const cacheWrite = await this.saveToDiskCache(id, path)

      stream.pipe(cacheWrite)
    }

    return stream
  }

  async delete(
    id: string,
    storage: FileStorage,
    originalName: string,
  ): Promise<void> {
    const key = this.buildKey(id, originalName)

    await this.minioClient.removeObject(BUCKET_BY_STORAGE[storage], key)

    if (storage === FileStorage.HOT) {
      const path = await this.diskCachePath(key)
      await rm(path, { force: true })
    }
  }

  private buildKey(id: string, originalName: string): string {
    return `${id}${extname(originalName)}`
  }

  private async diskCachePath(key: string): Promise<string> {
    const dir = this.configService.getOrThrow<string>(
      EnvVariable.FILE_STORAGE_PATH,
    )

    await mkdir(dir, { recursive: true })

    return join(dir, key)
  }

  private async exists(path: string): Promise<boolean> {
    try {
      await access(path)

      return true
    } catch {
      return false
    }
  }

  private async saveToDiskCache(
    id: string,
    path: string,
  ): Promise<WriteStream> {
    const cacheWrite = createWriteStream(path)

    cacheWrite.on('error', (error) =>
      this.logger.warn(`Failed to warm disk cache for ${id}: ${error.message}`),
    )

    return cacheWrite
  }
}
