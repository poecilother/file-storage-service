import { MigrationInterface, QueryRunner } from 'typeorm'

export class InitFileEntity1789304914570 implements MigrationInterface {
  name = 'InitFileEntity1789304914570'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."file_entity_storage_enum" AS ENUM('hot', 'archive')`,
    )
    await queryRunner.query(
      `CREATE TABLE "file_entity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" character varying(255) NOT NULL, "originalName" character varying(255) NOT NULL, "mimetype" character varying(255) NOT NULL, "size" integer NOT NULL, "storage" "public"."file_entity_storage_enum" NOT NULL DEFAULT 'hot', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_d8375e0b2592310864d2b4974b2" PRIMARY KEY ("id"))`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "file_entity"`)
    await queryRunner.query(`DROP TYPE "public"."file_entity_storage_enum"`)
  }
}
