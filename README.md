## Description

A microservice for storing and retrieving files.

## Requirements

### Local setup

Run the app directly on your machine
(see [Run locally](#run-locally)).

- [Node.js](https://nodejs.org/) 24.x and npm (matches the version used by
  the `Dockerfile`; check with `node --version`)
- [Docker](https://docs.docker.com/get-docker/) and
  [Docker Compose](https://docs.docker.com/compose/) v2, to run Redis,
  Postgres and MinIO (see below)
- Ports `5432` (Postgres), `6379` (Redis), `9000`/`9001` (MinIO) and `3000`
  (the app itself) free on the host

### Docker setup

Run the whole stack - app included - in Docker
(see [Run with Docker](#run-with-docker)).

- [Docker](https://docs.docker.com/get-docker/) and
  [Docker Compose](https://docs.docker.com/compose/) v2.24+ (the `app`
  service's `env_file.required: false` needs 2.24 or newer; check with
  `docker compose version`)
- Ports `3000`, `5432`, `6379`, `9000` and `9001` free on the host
- No local Node.js install required - everything runs inside the containers

## Quickstart

The app listens on `http://localhost:3000` (Swagger docs at
`http://localhost:3000/docs`), migrations run automatically on startup, and
the default [configuration](#configuration) already points at the ports
Docker Compose publishes for Redis/Postgres/MinIO - no `.env` needed unless
you want to override something.

### Run locally

Install dependencies, start Redis/Postgres/MinIO in Docker, then run the app
directly on the host:

```bash
$ npm install
$ docker compose up -d redis postgres minio
$ npm run start:dev
```

### Run with Docker

The whole app, along with Redis and Postgres, can be run in development mode (watch mode, with the container reflecting `src`/`test` changes live) with Docker Compose:

```bash
$ docker compose up -d --build
```

## Project setup

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

## Load tests scripts

Scripts under `scripts/` for exercising the service at scale. Shared
tuning (category count, file count/size, batch sizes) lives in
`scripts/load-test.config.ts`.

- **`seed-load-test.ts`** (`npm run seed:load-test`) - seeds Postgres, MinIO
  and Redis directly (bypassing the HTTP API, for speed) with a large
  synthetic dataset: 10 categories x 30,000 ~100KB files by default.
- **`remove-load-test-seed.ts`** (`npm run seed:load-test:clean`) - removes
  everything the seed script created: the Postgres rows, the MinIO objects
  in both buckets, and any matching Redis cache entries (including stray
  ones left by earlier/interrupted runs).
- **`http-load-test.ts`** (`npm run test:http-load`) - a throughput check
  that uploads real files through the actual `POST /file-storage` endpoint
  (not a shortcut) and reports latency/throughput, then automatically
  cleans up everything it created.

Run them either on the host or inside the app container - just prefix with
`docker compose exec app` for the latter:

```bash
# locally (needs the app and infra reachable via localhost)
$ npm run seed:load-test
$ npm run test:http-load
$ npm run seed:load-test:clean

# inside the dockerized app
$ docker compose exec app npm run seed:load-test
$ docker compose exec app npm run test:http-load
$ docker compose exec app npm run seed:load-test:clean
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
