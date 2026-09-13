## Description

A microservice for storing and retrieving files.

## Project setup

```bash
$ npm install
```

### Configuration

| Variable name       | Required | Type     | Default value          | Description                         |
| ------------------- | -------- | -------- | ---------------------- | ----------------------------------- |
| `PORT`              | **Yes**  | `number` | `3000`                 | Port on which HTTP server listen on |
| `REDIS_HOST`        | **Yes**  | `string` | `localhost`            | Hostname of the Redis instance      |
| `REDIS_PORT`        | **Yes**  | `number` | `6379`                 | Port of the Redis instance          |
| `POSTGRES_HOST`     | **Yes**  | `string` | `localhost`            | Hostname of the Postgres instance   |
| `POSTGRES_PORT`     | **Yes**  | `number` | `5432`                 | Port of the Postgres instance       |
| `POSTGRES_USER`     | **Yes**  | `string` | `postgres`             | Postgres user                       |
| `POSTGRES_PASSWORD` | **Yes**  | `string` | `postgres`             | Postgres password                   |
| `POSTGRES_DB`       | **Yes**  | `string` | `file-storage-service` | Postgres database name              |

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
