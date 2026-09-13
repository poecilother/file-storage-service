import { FileStorage } from '../database/entities/file.entity'

export const MINIO_CLIENT = Symbol('MINIO_CLIENT')

export const BUCKET_BY_STORAGE: Record<FileStorage, string> = {
  [FileStorage.HOT]: 'hot-files',
  [FileStorage.ARCHIVE]: 'archive-files',
}
