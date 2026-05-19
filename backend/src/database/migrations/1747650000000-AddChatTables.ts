import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChatTables1747650000000 implements MigrationInterface {
  name = 'AddChatTables1747650000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "chat_messages" (
        "id"         uuid              NOT NULL DEFAULT gen_random_uuid(),
        "shopId"     character varying NOT NULL,
        "userId"     character varying NOT NULL,
        "role"       character varying NOT NULL,
        "content"    text              NOT NULL,
        "isError"    boolean           NOT NULL DEFAULT false,
        "createdAt"  TIMESTAMP         NOT NULL DEFAULT now(),
        CONSTRAINT "PK_chat_messages" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_chat_messages_shop_user_created"
      ON "chat_messages" ("shopId", "userId", "createdAt")
    `);

    await queryRunner.query(`
      CREATE TABLE "chat_sessions" (
        "id"                  uuid              NOT NULL DEFAULT gen_random_uuid(),
        "shopId"              character varying NOT NULL,
        "userId"              character varying NOT NULL,
        "lokteSessionId"      character varying NOT NULL,
        "lastAssistantMsgId"  integer,
        "createdAt"           TIMESTAMP         NOT NULL DEFAULT now(),
        "updatedAt"           TIMESTAMP         NOT NULL DEFAULT now(),
        CONSTRAINT "PK_chat_sessions"              PRIMARY KEY ("id"),
        CONSTRAINT "UQ_chat_sessions_shop_user"    UNIQUE ("shopId", "userId")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "chat_sessions"`);
    await queryRunner.query(`DROP INDEX "IDX_chat_messages_shop_user_created"`);
    await queryRunner.query(`DROP TABLE "chat_messages"`);
  }
}
