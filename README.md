## Description

A microservice for storing and retrieving files.

## Project setup

```bash
$ npm install
```

### Configuration

| Variable name             | Required | Type      | Default value          | Description                                                                |
| ------------------------- | -------- | --------- | ---------------------- | -------------------------------------------------------------------------- |
| `PORT`                    | **Yes**  | `number`  | `3000`                 | Port on which HTTP server listen on                                        |
| `REDIS_HOST`              | **Yes**  | `string`  | `localhost`            | Hostname of the Redis instance                                             |
| `REDIS_PORT`              | **Yes**  | `number`  | `6379`                 | Port of the Redis instance                                                 |
| `POSTGRES_HOST`           | **Yes**  | `string`  | `localhost`            | Hostname of the Postgres instance                                          |
| `POSTGRES_PORT`           | **Yes**  | `number`  | `5432`                 | Port of the Postgres instance                                              |
| `POSTGRES_USER`           | **Yes**  | `string`  | `postgres`             | Postgres user                                                              |
| `POSTGRES_PASSWORD`       | **Yes**  | `string`  | `postgres`             | Postgres password                                                          |
| `POSTGRES_DB`             | **Yes**  | `string`  | `file-storage-service` | Postgres database name                                                     |
| `FILE_MAX_SIZE`           | **Yes**  | `number`  | `1048576` (1MB)        | Maximum allowed uploaded file size, in bytes                               |
| `FILE_STORAGE_PATH`       | **Yes**  | `string`  | `./uploads`            | Local disk cache directory for hot files                                   |
| `FILE_ALLOWED_EXTENSIONS` | **Yes**  | `string`  | `txt,pdf,png,jpg,jpeg` | Comma-separated list of allowed file extensions (no dot)                   |
| `FILE_ARCHIVE_AFTER_MS`   | **Yes**  | `number`  | `2592000000` (30 days) | How long a file stays in hot storage before being moved to archive storage |
| `FILE_ARCHIVE_CRON`       | **Yes**  | `string`  | `0 * * * *` (hourly)   | Cron expression controlling how often the hot-to-archive job runs          |
| `MINIO_HOST`              | **Yes**  | `string`  | `localhost`            | Hostname of the MinIO instance                                             |
| `MINIO_PORT`              | **Yes**  | `number`  | `9000`                 | Port of the MinIO instance                                                 |
| `MINIO_USE_SSL`           | **Yes**  | `boolean` | `false`                | Whether to connect to MinIO over TLS                                       |
| `MINIO_ACCESS_KEY`        | **Yes**  | `string`  | `minioadmin`           | MinIO access key                                                           |
| `MINIO_SECRET_KEY`        | **Yes**  | `string`  | `minioadmin`           | MinIO secret key                                                           |

### Redis

A Redis instance is required. For local development, start one with:

```bash
$ docker compose up -d redis
```

### Postgres

A Postgres instance is required. For local development, start one with:

```bash
$ docker compose up -d postgres
```

Schema is managed with TypeORM migrations (no `synchronize`). Migrations run
automatically on app startup (`migrationsRun: true`). To manage them manually:

```bash
# generate a migration from entity changes
$ npm run migration:generate -- src/database/migrations/MigrationName

# apply pending migrations
$ npm run migration:run

# revert the last migration
$ npm run migration:revert
```

### MinIO

A MinIO instance is required, storing files in two buckets: `hot-files` and
`archive-files` (created automatically on startup). Hot files are additionally
cached on local disk at `FILE_STORAGE_PATH` for fast reads. For local
development, start one with:

```bash
$ docker compose up -d minio
```

The MinIO console is available at `http://localhost:9001`.

## Run with Docker

The whole app, along with Redis and Postgres, can be run in development mode (watch mode, with the container reflecting `src`/`test` changes live) with Docker Compose:

```bash
$ docker compose up -d --build
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```
