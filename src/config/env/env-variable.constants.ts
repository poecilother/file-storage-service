export enum EnvVariable {
  PORT = 'PORT',
  REDIS_HOST = 'REDIS_HOST',
  REDIS_PORT = 'REDIS_PORT',
  POSTGRES_HOST = 'POSTGRES_HOST',
  POSTGRES_PORT = 'POSTGRES_PORT',
  POSTGRES_USER = 'POSTGRES_USER',
  POSTGRES_PASSWORD = 'POSTGRES_PASSWORD',
  POSTGRES_DB = 'POSTGRES_DB',
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
}
