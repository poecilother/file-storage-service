export enum EnvVariable {
  PORT = 'PORT',
  REDIS_HOST = 'REDIS_HOST',
  REDIS_PORT = 'REDIS_PORT',
  POSTGRES_HOST = 'POSTGRES_HOST',
  POSTGRES_PORT = 'POSTGRES_PORT',
  POSTGRES_USER = 'POSTGRES_USER',
  POSTGRES_PASSWORD = 'POSTGRES_PASSWORD',
  POSTGRES_DB = 'POSTGRES_DB',
  FILE_MAX_SIZE = 'FILE_MAX_SIZE',
  FILE_STORAGE_PATH = 'FILE_STORAGE_PATH',
  FILE_ALLOWED_EXTENSIONS = 'FILE_ALLOWED_EXTENSIONS',
  FILE_ARCHIVE_AFTER_MS = 'FILE_ARCHIVE_AFTER_MS',
  FILE_ARCHIVE_CRON = 'FILE_ARCHIVE_CRON',
  MINIO_HOST = 'MINIO_HOST',
  MINIO_PORT = 'MINIO_PORT',
  MINIO_USE_SSL = 'MINIO_USE_SSL',
  MINIO_ACCESS_KEY = 'MINIO_ACCESS_KEY',
  MINIO_SECRET_KEY = 'MINIO_SECRET_KEY',
}

export const EnvVariableDefault = {
  [EnvVariable.PORT]: 3000,
  [EnvVariable.REDIS_HOST]: 'localhost',
  [EnvVariable.REDIS_PORT]: 6379,
  [EnvVariable.POSTGRES_HOST]: 'localhost',
  [EnvVariable.POSTGRES_PORT]: 5432,
  [EnvVariable.POSTGRES_USER]: 'postgres',
  [EnvVariable.POSTGRES_PASSWORD]: 'postgres',
  [EnvVariable.POSTGRES_DB]: 'file-storage-service',
  [EnvVariable.FILE_MAX_SIZE]: 1 * 1024 * 1024, // 1MB
  [EnvVariable.FILE_STORAGE_PATH]: './uploads',
  [EnvVariable.FILE_ALLOWED_EXTENSIONS]: 'txt,pdf,png,jpg,jpeg',
  [EnvVariable.FILE_ARCHIVE_AFTER_MS]: 30 * 24 * 60 * 60 * 1000, // 30 days
  [EnvVariable.FILE_ARCHIVE_CRON]: '0 * * * *', // every hour
  [EnvVariable.MINIO_HOST]: 'localhost',
  [EnvVariable.MINIO_PORT]: 9000,
  [EnvVariable.MINIO_USE_SSL]: false,
  [EnvVariable.MINIO_ACCESS_KEY]: 'minioadmin',
  [EnvVariable.MINIO_SECRET_KEY]: 'minioadmin',
}
