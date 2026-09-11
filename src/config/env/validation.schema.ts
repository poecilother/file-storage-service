import * as Joi from 'joi'
import { EnvVariable, EnvVariableDefault } from './env-variable.constants'

export const validationSchema = Joi.object({
  [EnvVariable.PORT]: Joi.number().default(
    EnvVariableDefault[EnvVariable.PORT],
  ),
})
