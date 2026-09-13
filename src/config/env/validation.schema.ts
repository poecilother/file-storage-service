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
})
