import { randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'

import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { FileEntity, FileStorage } from '../../database/entities/file.entity'
import { StorageService } from '../../storage/storage.service'
import { FileStorageDto } from '../dto/file-storage.dto'
import { FileCacheService } from './file-cache.service'

@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name)

  constructor(
    private readonly storageService: StorageService,
    private readonly fileCacheService: FileCacheService,
    @InjectRepository(FileEntity)
    private readonly fileRepository: Repository<FileEntity>,
  ) {}

  async getFileStorage(id: string, type: string): Promise<FileStorageDto> {
    const storage = await this.fileCacheService.getStorage(type, id)

    if (!storage) {
      throw new HttpException(
        `File with id ${id} and type ${type} not found`,
        HttpStatus.NOT_FOUND,
      )
    }

    return { id, type, storage }
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
}
