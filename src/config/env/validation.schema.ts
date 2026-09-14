import * as Joi from 'joi'

import { EnvVariable, EnvVariableDefault } from './env-variable.constants'

export const validationSchema = Joi.object({
  [EnvVariable.PORT]: Joi.number().default(
    EnvVariableDefault[EnvVariable.PORT],
  ),
  [EnvVariable.REDIS_HOST]: Joi.string().default(
    EnvVariableDefault[EnvVariable.REDIS_HOST],
  ),
  [EnvVariable.REDIS_PORT]: Joi.number().default(
    EnvVariableDefault[EnvVariable.REDIS_PORT],
  ),
  [EnvVariable.POSTGRES_HOST]: Joi.string().default(
    EnvVariableDefault[EnvVariable.POSTGRES_HOST],
  ),
  [EnvVariable.POSTGRES_PORT]: Joi.number().default(
    EnvVariableDefault[EnvVariable.POSTGRES_PORT],
  ),
  [EnvVariable.POSTGRES_USER]: Joi.string().default(
    EnvVariableDefault[EnvVariable.POSTGRES_USER],
  ),
  [EnvVariable.POSTGRES_PASSWORD]: Joi.string().default(
    EnvVariableDefault[EnvVariable.POSTGRES_PASSWORD],
  ),
  [EnvVariable.POSTGRES_DB]: Joi.string().default(
    EnvVariableDefault[EnvVariable.POSTGRES_DB],
  ),
  [EnvVariable.FILE_MAX_SIZE]: Joi.number().default(
    EnvVariableDefault[EnvVariable.FILE_MAX_SIZE],
  ),
  [EnvVariable.FILE_STORAGE_PATH]: Joi.string().default(
    EnvVariableDefault[EnvVariable.FILE_STORAGE_PATH],
  ),
  [EnvVariable.FILE_ALLOWED_EXTENSIONS]: Joi.string().default(
    EnvVariableDefault[EnvVariable.FILE_ALLOWED_EXTENSIONS],
  ),
  [EnvVariable.FILE_ARCHIVE_AFTER_MS]: Joi.number().default(
    EnvVariableDefault[EnvVariable.FILE_ARCHIVE_AFTER_MS],
  ),
  [EnvVariable.FILE_ARCHIVE_CRON]: Joi.string().default(
    EnvVariableDefault[EnvVariable.FILE_ARCHIVE_CRON],
  ),
  [EnvVariable.MINIO_HOST]: Joi.string().default(
    EnvVariableDefault[EnvVariable.MINIO_HOST],
  ),
  [EnvVariable.MINIO_PORT]: Joi.number().default(
    EnvVariableDefault[EnvVariable.MINIO_PORT],
  ),
  [EnvVariable.MINIO_USE_SSL]: Joi.boolean().default(
    EnvVariableDefault[EnvVariable.MINIO_USE_SSL],
  ),
  [EnvVariable.MINIO_ACCESS_KEY]: Joi.string().default(
    EnvVariableDefault[EnvVariable.MINIO_ACCESS_KEY],
  ),
  [EnvVariable.MINIO_SECRET_KEY]: Joi.string().default(
    EnvVariableDefault[EnvVariable.MINIO_SECRET_KEY],
  ),
})
