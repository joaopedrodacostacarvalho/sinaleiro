import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAvistamentoTremAndEventos1795500000000 implements MigrationInterface {
  name = 'AddAvistamentoTremAndEventos1795500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "trem"
      ADD COLUMN IF NOT EXISTS "estacao_atual_id" integer NULL,
      ADD COLUMN IF NOT EXISTS "ultimo_avistamento_em" timestamptz NULL;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "trem"
        ADD CONSTRAINT "FK_trem_estacao_atual"
        FOREIGN KEY ("estacao_atual_id") REFERENCES "estacao"("id") ON DELETE SET NULL;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "eventos" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "usuario_id" uuid NULL,
        "sessao_id" varchar(64) NULL,
        "categoria" varchar(32) NOT NULL DEFAULT 'uso',
        "nome" varchar(80) NOT NULL,
        "propriedades" jsonb NOT NULL DEFAULT '{}',
        "criado_em" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_eventos" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_eventos_nome_criado" ON "eventos" ("nome", "criado_em");
      CREATE INDEX IF NOT EXISTS "IDX_eventos_categoria_criado" ON "eventos" ("categoria", "criado_em");
      CREATE INDEX IF NOT EXISTS "IDX_eventos_usuario_criado" ON "eventos" ("usuario_id", "criado_em");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "eventos";`);
    await queryRunner.query(`ALTER TABLE "trem" DROP CONSTRAINT IF EXISTS "FK_trem_estacao_atual";`);
    await queryRunner.query(`
      ALTER TABLE "trem"
      DROP COLUMN IF EXISTS "ultimo_avistamento_em",
      DROP COLUMN IF EXISTS "estacao_atual_id";
    `);
  }
}
