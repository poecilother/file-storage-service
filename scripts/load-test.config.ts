export const CATEGORY_PREFIX = 'category-'
export const CATEGORY_COUNT = 10
export const CATEGORIES = Array.from(
  { length: CATEGORY_COUNT },
  (_, i) => `${CATEGORY_PREFIX}${i + 1}`,
)

export const FILES_PER_CATEGORY = 30_000
export const MIN_SIZE_BYTES = 50 * 1024
export const MAX_SIZE_BYTES = 150 * 1024 // uniform 50-150KB => ~100KB average

// Spread createdAt over the past N days so that, once seeded, a realistic
// portion of files already sit past the default FILE_ARCHIVE_AFTER_MS
// (30 days) threshold - useful for exercising the archive job at scale.
export const CREATED_AT_SPREAD_DAYS = 60

export const MINIO_CONCURRENCY = 100
export const DB_BATCH_SIZE = 1_000

// Pool of random bytes that per-file content is sliced from, instead of
// generating fresh random bytes for every one of the (up to) 300k files.
export const CONTENT_POOL_SIZE = 2 * 1024 * 1024
