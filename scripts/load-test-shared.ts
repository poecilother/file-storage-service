import { createClient, type RedisClientType } from '@redis/client'
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

export async function createRedisClient(): Promise<RedisClientType> {
  const host =
    process.env[EnvVariable.REDIS_HOST] ??
    EnvVariableDefault[EnvVariable.REDIS_HOST]
  const port =
    process.env[EnvVariable.REDIS_PORT] ??
    EnvVariableDefault[EnvVariable.REDIS_PORT]

  const client = createClient({ url: `redis://${host}:${port}` })

  client.on('error', (error: Error) =>
    console.warn(`Redis client error: ${error.message}`),
  )

  await client.connect()

  return client as RedisClientType
}

export function buildStorageKey(type: string, id: string): string {
  return `file:${type}:${id}`
}

export function buildTypeKey(type: string): string {
  return `file:type:${type}`
}

export async function deleteRedisKeysMatching(
  redisClient: RedisClientType,
  pattern: string,
): Promise<number> {
  let deleted = 0

  for await (const keys of redisClient.scanIterator({ MATCH: pattern })) {
    const batch = Array.isArray(keys) ? keys : [keys]

    if (batch.length === 0) {
      continue
    }

    await redisClient.del(batch)
    deleted += batch.length
  }

  return deleted
}
