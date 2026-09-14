import 'reflect-metadata'

import { extname } from 'node:path'

import { Like } from 'typeorm'

import dataSource from '../src/database/data-source'
import { FileEntity } from '../src/database/entities/file.entity'
import { BUCKET_BY_STORAGE } from '../src/storage/storage.constants'
import {
  CATEGORY_PREFIX,
  DB_BATCH_SIZE,
  MINIO_CONCURRENCY,
} from './load-test.config'
import { createMinioClient, runWithConcurrency } from './load-test-shared'

function buildKey(id: string, originalName: string): string {
  return `${id}${extname(originalName)}`
}

async function main(): Promise<void> {
  await dataSource.initialize()

  const minioClient = createMinioClient()
  const fileRepository = dataSource.getRepository(FileEntity)

  let totalDeleted = 0
  const startedAt = Date.now()

  while (true) {
    const batch = await fileRepository.find({
      where: { type: Like(`${CATEGORY_PREFIX}%`) },
      take: DB_BATCH_SIZE,
    })

    if (batch.length === 0) {
      break
    }

    await runWithConcurrency(batch, MINIO_CONCURRENCY, async (entity) => {
      const key = buildKey(entity.id, entity.originalName)

      await Promise.all(
        Object.values(BUCKET_BY_STORAGE).map((bucket) =>
          minioClient.removeObject(bucket, key).catch(() => undefined),
        ),
      )
    })

    await fileRepository.delete(batch.map((entity) => entity.id))

    totalDeleted += batch.length
    console.log(`Deleted ${totalDeleted} seeded test files so far...`)
  }

  const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1)

  console.log(
    `Done. Deleted ${totalDeleted} seeded test files in ${elapsedSeconds}s.`,
  )

  await dataSource.destroy()
}

main().catch((error: Error) => {
  console.error(error)
  process.exit(1)
})
