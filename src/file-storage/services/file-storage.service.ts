import { randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'

import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { FileEntity, FileStorage } from '../../database/entities/file.entity'
import { StorageService } from '../../storage/storage.service'
import { FileStorageDto } from '../dto/file-storage.dto'
import { FileCacheService } from './file-cache.service'

@Injectable()
export class FileStorageService implements OnModuleInit {
  private readonly logger = new Logger(FileStorageService.name)

  constructor(
    private readonly storageService: StorageService,
    private readonly fileCacheService: FileCacheService,
    @InjectRepository(FileEntity)
    private readonly fileRepository: Repository<FileEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.warmCacheOnStartup()
  }

  async getFile(
    id: string,
    type: string,
  ): Promise<{ stream: Readable; fileEntity: FileEntity }> {
    const fileEntity = await this.fileRepository.findOneBy({ id, type })

    if (!fileEntity) {
      throw this.entityNotFoundError(id, type)
    }

    const stream = await this.storageService.download(
      id,
      fileEntity.storage,
      fileEntity.originalName,
    )

    return { stream, fileEntity }
  }

  async getFileStorage(id: string, type: string): Promise<FileStorageDto> {
    const cachedStorage = await this.fileCacheService.getStorage(type, id)

    if (cachedStorage) {
      return { id, type, storage: cachedStorage }
    }

    const fileEntity = await this.fileRepository.findOneBy({ id, type })

    if (!fileEntity) {
      throw this.entityNotFoundError(id, type)
    }

    await this.fileCacheService
      .set({
        id: fileEntity.id,
        type: fileEntity.type,
        storage: fileEntity.storage,
      })
      .catch((error: Error) => {
        this.logger.warn(`Failed to warm cache for ${id}: ${error.message}`)
      })

    return { id, type, storage: fileEntity.storage }
  }

  async getFileListByType(type: string): Promise<string[]> {
    return this.fileCacheService.getIdsByType(type)
  }

  async saveFile(file: Express.Multer.File, fileType: string): Promise<string> {
    const id = randomUUID()
    const storage = FileStorage.HOT

    await this.storageService.upload(
      id,
      Readable.from(file.buffer),
      storage,
      file.originalname,
    )

    let entitySaved = false

    try {
      await this.fileRepository.save(
        this.fileRepository.create({
          id,
          type: fileType,
          originalName: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          storage,
        }),
      )
      entitySaved = true

      await this.fileCacheService.set({ id, type: fileType, storage })
    } catch (error) {
      await this.rollback(id, storage, file.originalname, entitySaved)

      throw error
    }

    return id
  }

  async deleteFile(id: string, type: string): Promise<void> {
    const fileEntity = await this.fileRepository.findOneBy({ id, type })

    if (!fileEntity) {
      throw this.entityNotFoundError(id, type)
    }

    await this.fileRepository.softDelete(id)

    await this.storageService
      .delete(id, fileEntity.storage, fileEntity.originalName)
      .catch((error: Error) => {
        this.logger.warn(
          `Failed to delete storage for ${id} after deleting its entity: ${error.message}`,
        )
      })

    await this.fileCacheService.delete(type, id).catch((error: Error) => {
      this.logger.warn(
        `Failed to delete cache entry for ${id} after deleting its entity: ${error.message}`,
      )
    })
  }

  private async rollback(
    id: string,
    storage: FileStorage,
    originalName: string,
    entitySaved: boolean,
  ): Promise<void> {
    if (entitySaved) {
      await this.fileRepository.delete(id).catch((error: Error) => {
        this.logger.warn(
          `Failed to roll back FileEntity ${id} after a failed save: ${error.message}`,
        )
      })
    }

    await this.storageService
      .delete(id, storage, originalName)
      .catch((error: Error) => {
        this.logger.warn(
          `Failed to clean up storage for ${id} after a failed save: ${error.message}`,
        )
      })
  }

  private entityNotFoundError(id: string, type: string): HttpException {
    return new HttpException(
      `File with id ${id} and type ${type} not found`,
      HttpStatus.NOT_FOUND,
    )
  }

  private async warmCacheOnStartup(): Promise<void> {
    let files: FileEntity[]

    try {
      files = await this.fileRepository.find()
    } catch (error) {
      this.logger.warn(
        `Failed to warm cache on startup: ${(error as Error).message}`,
      )
      return
    }

    let failedCount = 0

    for (const file of files) {
      try {
        await this.fileCacheService.set({
          id: file.id,
          type: file.type,
          storage: file.storage,
        })
      } catch (error) {
        failedCount++
        this.logger.warn(
          `Failed to warm cache for ${file.id}: ${(error as Error).message}`,
        )
      }
    }

    if (failedCount > 0) {
      this.logger.warn(
        `Warmed cache with ${files.length - failedCount} of ${files.length} files on startup`,
      )
    } else {
      this.logger.log(`Warmed cache with ${files.length} files on startup`)
    }
  }
}
