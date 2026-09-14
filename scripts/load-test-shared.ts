import { Client } from 'minio'

import {
  EnvVariable,
  EnvVariableDefault,
} from '../src/config/env/env-variable.constants'

export async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  const executing = new Set<Promise<void>>()

  for (const item of items) {
    const promise = worker(item).finally(() => executing.delete(promise))
    executing.add(promise)

    if (executing.size >= limit) {
      await Promise.race(executing)
    }
  }

  await Promise.all(executing)
}

export function createMinioClient(): Client {
  return new Client({
    endPoint:
      process.env[EnvVariable.MINIO_HOST] ??
      EnvVariableDefault[EnvVariable.MINIO_HOST],
    port: Number(
      process.env[EnvVariable.MINIO_PORT] ??
        EnvVariableDefault[EnvVariable.MINIO_PORT],
    ),
    useSSL:
      (process.env[EnvVariable.MINIO_USE_SSL] ??
        String(EnvVariableDefault[EnvVariable.MINIO_USE_SSL])) === 'true',
    accessKey:
      process.env[EnvVariable.MINIO_ACCESS_KEY] ??
      EnvVariableDefault[EnvVariable.MINIO_ACCESS_KEY],
    secretKey:
      process.env[EnvVariable.MINIO_SECRET_KEY] ??
      EnvVariableDefault[EnvVariable.MINIO_SECRET_KEY],
  })
}
