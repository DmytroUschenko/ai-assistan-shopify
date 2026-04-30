import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCoreConfig1745798400000 implements MigrationInterface {
  name = 'AddCoreConfig1745798400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "core_config" (
        "id"         UUID              NOT NULL DEFAULT uuid_generate_v4(),
        "shop_id"    CHARACTER VARYING NOT NULL,
        "path"       CHARACTER VARYING NOT NULL,
        "value"      JSONB             NOT NULL,
        "created_at" TIMESTAMP         NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP         NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_core_config_shop_id_path" UNIQUE ("shop_id", "path"),
        CONSTRAINT "PK_core_config" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_core_config_shop_id" ON "core_config" ("shop_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_core_config_path" ON "core_config" ("path")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_core_config_path"`);
    await queryRunner.query(`DROP INDEX "IDX_core_config_shop_id"`);
    await queryRunner.query(`DROP TABLE "core_config"`);
  }
}
