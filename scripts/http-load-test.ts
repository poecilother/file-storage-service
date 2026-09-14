// Uploads via actual POST /file-storage requests (not the
// seed script's direct-to-Postgres/MinIO bypass), so it exercises
// FileValidatorPipe, multer, disk cache write, MinIO putObject and the
// Postgres insert exactly as a real client would. Cleans up everything it
// created once the run finishes.

import 'reflect-metadata'

import { randomBytes } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { extname, join } from 'node:path'

import {
  EnvVariable,
  EnvVariableDefault,
} from '../src/config/env/env-variable.constants'
import dataSource from '../src/database/data-source'
import { FileEntity } from '../src/database/entities/file.entity'
import { BUCKET_BY_STORAGE } from '../src/storage/storage.constants'
import { DB_BATCH_SIZE } from './load-test.config'
import {
  buildTypeKey,
  createMinioClient,
  createRedisClient,
  deleteRedisKeysMatching,
  runWithConcurrency,
} from './load-test-shared'

const BASE_URL = 'http://localhost:3000'
const FILE_TYPE = 'load-test'
const TOTAL_FILES = 10_000
const CONCURRENCY = 20
const FILE_SIZE_BYTES = 100 * 1024
const FILE_STORAGE_PATH =
  process.env[EnvVariable.FILE_STORAGE_PATH] ??
  EnvVariableDefault[EnvVariable.FILE_STORAGE_PATH]

async function uploadOne(content: Buffer, index: number): Promise<number> {
  const form = new FormData()
  form.append(
    'file',
    new Blob([content as unknown as BlobPart]),
    `load-test-${index}.txt`,
  )
  form.append('fileType', FILE_TYPE)

  const startedAt = Date.now()
  const response = await fetch(`${BASE_URL}/file-storage`, {
    method: 'POST',
    body: form,
  })
  const elapsed = Date.now() - startedAt

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`)
  }

  return elapsed
}

function buildKey(id: string, originalName: string): string {
  return `${id}${extname(originalName)}`
}

async function deleteDiskCacheFiles(keys: string[]): Promise<void> {
  await runWithConcurrency(keys, CONCURRENCY, async (key) => {
    await rm(join(FILE_STORAGE_PATH, key), { force: true }).catch(
      (error: Error) => {
        console.warn(
          `Failed to clean up disk cache file ${key}: ${error.message}`,
        )
      },
    )
  })
}

async function cleanup(): Promise<void> {
  await dataSource.initialize()

  const minioClient = createMinioClient()
  const redisClient = await createRedisClient()
  const fileRepository = dataSource.getRepository(FileEntity)

  let totalDeleted = 0

  while (true) {
    const batch = await fileRepository.find({
      where: { type: FILE_TYPE },
      take: DB_BATCH_SIZE,
    })

    if (batch.length === 0) {
      break
    }

    const keys = batch.map((entity) => buildKey(entity.id, entity.originalName))

    await runWithConcurrency(batch, CONCURRENCY, async (entity) => {
      const key = buildKey(entity.id, entity.originalName)

      await Promise.all(
        Object.values(BUCKET_BY_STORAGE).map((bucket) =>
          minioClient.removeObject(bucket, key).catch(() => undefined),
        ),
      )
    })

    await deleteDiskCacheFiles(keys)

    await fileRepository.delete(batch.map((entity) => entity.id))
    totalDeleted += batch.length
  }

  const redisKeysDeleted = await deleteRedisKeysMatching(
    redisClient,
    `file:${FILE_TYPE}:*`,
  )
  await redisClient.del(buildTypeKey(FILE_TYPE)).catch(() => undefined)

  console.log(
    `Cleaned up ${totalDeleted} test files and ${redisKeysDeleted} stray Redis keys.`,
  )

  await dataSource.destroy()
  await redisClient.quit()
}

async function main(): Promise<void> {
  const content = randomBytes(FILE_SIZE_BYTES)

  const indices = Array.from({ length: TOTAL_FILES }, (_, i) => i)
  const latencies: number[] = []
  let failures = 0

  const startedAt = Date.now()

  await runWithConcurrency(indices, CONCURRENCY, async (index) => {
    try {
      const elapsed = await uploadOne(content, index)
      latencies.push(elapsed)
    } catch (error) {
      failures++
      console.error(`[${index}] FAILED: ${(error as Error).message}`)
    }

    if ((index + 1) % 500 === 0) {
      console.log(`Progress: ${index + 1}/${TOTAL_FILES}`)
    }
  })

  const totalElapsedSeconds = (Date.now() - startedAt) / 1000
  latencies.sort((a, b) => a - b)

  const p50 = latencies[Math.floor(latencies.length * 0.5)]
  const p95 = latencies[Math.floor(latencies.length * 0.95)]
  const p99 = latencies[Math.floor(latencies.length * 0.99)]
  const max = latencies[latencies.length - 1]
  const throughput = latencies.length / totalElapsedSeconds

  console.log('---')
  console.log(
    `Total: ${TOTAL_FILES}, succeeded: ${latencies.length}, failed: ${failures}`,
  )
  console.log(
    `Wall clock: ${totalElapsedSeconds.toFixed(1)}s at concurrency=${CONCURRENCY}`,
  )
  console.log(`Throughput: ${throughput.toFixed(1)} req/s`)
  console.log(
    `Latency (ms) - p50: ${p50}, p95: ${p95}, p99: ${p99}, max: ${max}`,
  )

  await cleanup()
}

main().catch((error: Error) => {
  console.error(error)
  process.exit(1)
})
