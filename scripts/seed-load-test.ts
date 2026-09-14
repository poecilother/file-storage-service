import 'reflect-metadata'

import { randomBytes, randomUUID } from 'node:crypto'

import type { RedisClientType } from '@redis/client'
import { Client } from 'minio'

import dataSource from '../src/database/data-source'
import { FileEntity, FileStorage } from '../src/database/entities/file.entity'
import { BUCKET_BY_STORAGE } from '../src/storage/storage.constants'
import {
  CATEGORIES,
  CONTENT_POOL_SIZE,
  CREATED_AT_SPREAD_DAYS,
  DB_BATCH_SIZE,
  FILES_PER_CATEGORY,
  MAX_SIZE_BYTES,
  MIN_SIZE_BYTES,
  MINIO_CONCURRENCY,
} from './load-test.config'
import {
  buildStorageKey,
  buildTypeKey,
  createMinioClient,
  createRedisClient,
  runWithConcurrency,
} from './load-test-shared'

function randomSize(): number {
  return (
    MIN_SIZE_BYTES +
    Math.floor(Math.random() * (MAX_SIZE_BYTES - MIN_SIZE_BYTES))
  )
}

function randomCreatedAt(): Date {
  const maxAgeMs = CREATED_AT_SPREAD_DAYS * 24 * 60 * 60 * 1000

  return new Date(Date.now() - Math.floor(Math.random() * maxAgeMs))
}

function buildKey(id: string): string {
  return `${id}.bin`
}

async function ensureHotBucketExists(minioClient: Client): Promise<void> {
  const bucket = BUCKET_BY_STORAGE[FileStorage.HOT]
  const exists = await minioClient.bucketExists(bucket)

  if (!exists) {
    await minioClient.makeBucket(bucket)
  }
}

// Postgres, MinIO and Redis are all seeded, matching what a real upload
// does (see FileStorageService.saveFile), so list/storage-lookup work
// immediately without needing an app restart to trigger cache warming.
// The local disk cache is left alone though: it's a lazily populated
// read-through optimization (see StorageService.download), so leaving it
// empty here is consistent with files that were uploaded but never yet
// downloaded.
async function seedCategory(
  category: string,
  minioClient: Client,
  redisClient: RedisClientType,
  contentPool: Buffer,
): Promise<void> {
  const bucket = BUCKET_BY_STORAGE[FileStorage.HOT]
  let seeded = 0

  while (seeded < FILES_PER_CATEGORY) {
    const batchSize = Math.min(DB_BATCH_SIZE, FILES_PER_CATEGORY - seeded)

    const batch = Array.from({ length: batchSize }, () => {
      const id = randomUUID()
      const size = randomSize()

      return {
        id,
        type: category,
        originalName: `seed-${id}.bin`,
        mimetype: 'application/octet-stream',
        size,
        storage: FileStorage.HOT,
        createdAt: randomCreatedAt(),
      }
    })

    await runWithConcurrency(batch, MINIO_CONCURRENCY, async (entity) => {
      const offset = Math.floor(
        Math.random() * (contentPool.length - entity.size),
      )
      const content = contentPool.subarray(offset, offset + entity.size)

      await minioClient.putObject(
        bucket,
        buildKey(entity.id),
        content,
        entity.size,
      )

      await redisClient.set(
        buildStorageKey(entity.type, entity.id),
        entity.storage,
      )
    })

    await redisClient.sAdd(
      buildTypeKey(category),
      batch.map((entity) => entity.id),
    )

    await dataSource.getRepository(FileEntity).insert(batch)

    seeded += batchSize
    console.log(`[${category}] seeded ${seeded}/${FILES_PER_CATEGORY}`)
  }
}

async function main(): Promise<void> {
  await dataSource.initialize()

  const minioClient = createMinioClient()
  const redisClient = await createRedisClient()
  await ensureHotBucketExists(minioClient)

  const contentPool = randomBytes(CONTENT_POOL_SIZE)
  const startedAt = Date.now()

  for (const category of CATEGORIES) {
    await seedCategory(category, minioClient, redisClient, contentPool)
  }

  const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1)
  const totalFiles = CATEGORIES.length * FILES_PER_CATEGORY

  console.log(
    `Done. Seeded ${totalFiles} files across ${CATEGORIES.length} categories in ${elapsedSeconds}s.`,
  )

  await dataSource.destroy()
  await redisClient.quit()
}

main().catch((error: Error) => {
  console.error(error)
  process.exit(1)
})
