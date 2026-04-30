import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1714284000000 implements MigrationInterface {
  name = 'InitialSchema1714284000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "shops" (
        "id"           UUID              NOT NULL DEFAULT uuid_generate_v4(),
        "shopDomain"   CHARACTER VARYING NOT NULL,
        "accessToken"  CHARACTER VARYING NOT NULL,
        "scope"        CHARACTER VARYING NOT NULL,
        "isActive"     BOOLEAN           NOT NULL DEFAULT true,
        "createdAt"    TIMESTAMP         NOT NULL DEFAULT now(),
        "updatedAt"    TIMESTAMP         NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_shops_shopDomain" UNIQUE ("shopDomain"),
        CONSTRAINT "PK_shops" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_shops_shopDomain" ON "shops" ("shopDomain")
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."webhook_events_entity_enum"
        AS ENUM ('order', 'customer')
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."webhook_events_action_enum"
        AS ENUM ('create', 'update')
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."webhook_events_status_enum"
        AS ENUM ('new', 'processing', 'finished', 'failed')
    `);

    await queryRunner.query(`
      CREATE TABLE "webhook_events" (
        "id"               UUID                                    NOT NULL DEFAULT uuid_generate_v4(),
        "shopDomain"       CHARACTER VARYING                       NOT NULL,
        "entity"           "public"."webhook_events_entity_enum"   NOT NULL,
        "action"           "public"."webhook_events_action_enum"   NOT NULL,
        "shopifyId"        BIGINT,
        "topic"            CHARACTER VARYING                       NOT NULL,
        "shopifyWebhookId" CHARACTER VARYING                       NOT NULL,
        "payload"          JSONB                                   NOT NULL,
        "status"           "public"."webhook_events_status_enum"   NOT NULL DEFAULT 'new',
        "log"              TEXT,
        "createdAt"        TIMESTAMP                               NOT NULL DEFAULT now(),
        "updatedAt"        TIMESTAMP                               NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_webhook_events_shopifyWebhookId" UNIQUE ("shopifyWebhookId"),
        CONSTRAINT "PK_webhook_events" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_webhook_events_shopDomain"       ON "webhook_events" ("shopDomain")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_webhook_events_shopifyWebhookId" ON "webhook_events" ("shopifyWebhookId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_webhook_events_shopifyWebhookId"`);
    await queryRunner.query(`DROP INDEX "IDX_webhook_events_shopDomain"`);
    await queryRunner.query(`DROP TABLE "webhook_events"`);
    await queryRunner.query(`DROP TYPE "public"."webhook_events_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."webhook_events_action_enum"`);
    await queryRunner.query(`DROP TYPE "public"."webhook_events_entity_enum"`);
    await queryRunner.query(`DROP INDEX "IDX_shops_shopDomain"`);
    await queryRunner.query(`DROP TABLE "shops"`);
  }
}
