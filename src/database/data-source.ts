import 'reflect-metadata'

import { DataSource } from 'typeorm'

import {
  EnvVariable,
  EnvVariableDefault,
} from '../config/env/env-variable.constants'
import entities from './entities'

export default new DataSource({
  type: 'postgres',
  host:
    process.env[EnvVariable.POSTGRES_HOST] ??
    EnvVariableDefault[EnvVariable.POSTGRES_HOST],
  port: Number(
    process.env[EnvVariable.POSTGRES_PORT] ??
      EnvVariableDefault[EnvVariable.POSTGRES_PORT],
  ),
  username:
    process.env[EnvVariable.POSTGRES_USER] ??
    EnvVariableDefault[EnvVariable.POSTGRES_USER],
  password:
    process.env[EnvVariable.POSTGRES_PASSWORD] ??
    EnvVariableDefault[EnvVariable.POSTGRES_PASSWORD],
  database:
    process.env[EnvVariable.POSTGRES_DB] ??
    EnvVariableDefault[EnvVariable.POSTGRES_DB],
  entities,
  migrations: ['src/database/migrations/*.ts'],
})
