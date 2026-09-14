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

<br>
<br>
<br>
<br>
<br>
<br>

# Opis przyjętych założeń

---

`zaproponuj dwie różne metody przechowywania plików gorących i archiwalnych - jedna
ma być szybka w dostępie, a druga tania w użyciu`:

- <b>szybka</b>
  - Gorące - Lokalny cache razem z SSOT (Single Source of Truth) w postaci np. S3 Express One Zone albo MinIO na SSD
  - Archiwalne - S3 Glacier Instant Retrieval (szybki dostęp do zamrożonych plików) albo MinIO na HDD

- <b>tania</b>
  - Gorące - Zwykłe S3 albo MinIO na HDD
  - Archiwalne - S3 Glacier Deep Archive (dużo tańsze niż Instant Retrieval, ale pliki nie są dostępne od razu - trzeba czekać na odmrożenie pliku)

W projekcie użyłem:

- Gorące - lokalny cache razem z SSOT w postaci MinIO na lokalnym dysku - gdy gorący plik nie jest dostępny w lokalnym cache zostaje pobrany z MinIO i zapisany do cache.

- Archiwalne - również w MinIO - z powodu tego, że nie mam dostępu do informacji jakie opcje chmurowe czy lokalne wchodzą w grę (np AWS S3) oraz projekt w ramach zadania jest ograniczony do działania lokalnego.

Status plików przechowywany jest w bazie SQL (PostgreSQL), która jest też SSOT dla cache w redisie.

---

## Pytania dotyczące implementacji

### Jaki ma być warunek przesuwania plików z gorących do archiwalnych?

- Przyjąłem, że parametrem będzie wiek pliku `FILE_ARCHIVE_AFTER_MS` (domyślnie 30 dni) oraz, że za przesuwanie plików odpowiadać będzie cron job, uruchamiany według reguły podanej w `FILE_ARCHIVE_CRON` (domyślnie co godzinę).

### Czy typy plików będą ustalane z góry, czy będzie można wprowadzić dowolny typ?

- Przyjąłem, że dowolny string jest przyjmowany jako typ pliku - wolałbym ustalić listę typów z góry jako enum w momencie ustalania wymagań (o ile byłoby to możliwe).

### Jaki ma być maksymalny rozmiar pliku?

- Maksymalny rozmiar pliku przyjąłem 1MB - łatwo można byłoby to zmienić poprzez zmienną środowiskową.

### Pliki z jakim rozszerzeniem mają być przesyłane do tego mikroserwisu?

- Jako dopuszczalne rozszerzenia plików przyjąłem plik tekstowe, pdf oraz 3 popularne rozszerzenia dla obrazków.

### Czy pliki mają być możliwe do odzyskania po usunięciu? Jak tak to przez jaki czas?

- Usuwanie pliku zaproponowałbym jako soft delete (`deletedAt` uzupełnione w bazie danych, rekordy z `deletedAt` w postgresie usuwane z redisa, pliki zostawione w MinIO) plus hard delete po upłynięciu czasu ustalonego w envach (np. `FILE_RETENTION_DAYS`). Dzięki temu można byłoby odzyskać usunięte pliki przed upływem `FILE_RETENTION_DAYS`.

- Jednak, żeby nie przedłużać implementacji i zostawić rozwiązanie zadania względnie nieskomplikowane zaimplemenowałem jedynie hard delete plików (plus soft delete w postgresie).

---

## Skrypt testowy

Skrypt testowy wypełnia serwis plikami bezpośrednio do pamięci pomijając HTTP - przyjąłem takie założenie, ponieważ przez HTTP skrypt wykonywałby się bardzo długo, a przeznaczenie tego skryptu interpretuje jako wypełnienie serwisu plikami, żeby sprawdzić jego responsywność przy dużej ilości danych w bazach.

Do skryptu zapełniającego serwis plikami `seed-load-test.ts` dodałem skrypt czyszczący testowe dane `remove-load-test-seed.ts` oraz plik konfiguracyjny `load-test.config.ts` (jest też czwarty plik, w którym są elementy wspólne dla skryptu zapełniającego i czyszczącego `load-test-shared.ts`). Wszystkie pliki skryptowe znajdują się w folderze `scripts`.'

Do tego dorzuciłem jeden dodatkowy skrypt `http-load-test.ts`, który używałem do stress-testów endpointu do wrzucania plików. W wymaganiach jest mowa o 10 000 requestach w przeciągu 8 godzin - ten skrypt wykonuje 10 000 możliwie szybko, z ograniczeniem 20 operacji jednocześnie.

Wynik testu przeprowadzonego na moim komputerze przy plikach 100kb:

```
Total: 10000, succeeded: 10000, failed: 0
Wall clock: 16.7s at concurrency=20
Throughput: 599.8 req/s
Latency (ms) - p50: 32, p95: 45, p99: 57, max: 156
```
