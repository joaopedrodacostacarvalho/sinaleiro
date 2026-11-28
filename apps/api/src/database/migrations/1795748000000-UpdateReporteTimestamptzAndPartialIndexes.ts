import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class UpdateReporteTimestamptzAndPartialIndexes1795748000000
  implements MigrationInterface {
  name = 'UpdateReporteTimestamptzAndPartialIndexes1795748000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_reporte_expiracao"`);

    await queryRunner.query(`
      ALTER TABLE "reporte"
        ALTER COLUMN "data_hora_criacao" TYPE TIMESTAMPTZ
          USING "data_hora_criacao" AT TIME ZONE current_setting('TIMEZONE'),
        ALTER COLUMN "data_hora_expiracao" TYPE TIMESTAMPTZ
          USING "data_hora_expiracao" AT TIME ZONE current_setting('TIMEZONE')
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_reporte_expiracao"
        ON "reporte" ("data_hora_expiracao")
        WHERE "ativo" = TRUE
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_reporte_ativo_estacao"
        ON "reporte" ("estacao_id", "data_hora_criacao")
        WHERE "ativo" = TRUE AND "estacao_id" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_reporte_ativo_linha"
        ON "reporte" ("linha_id", "data_hora_criacao")
        WHERE "ativo" = TRUE AND "linha_id" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_reporte_ativo_trem"
        ON "reporte" ("trem_id", "data_hora_criacao")
        WHERE "ativo" = TRUE AND "trem_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_reporte_ativo_trem"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_reporte_ativo_linha"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_reporte_ativo_estacao"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_reporte_expiracao"`);

    await queryRunner.query(`
      ALTER TABLE "reporte"
        ALTER COLUMN "data_hora_criacao" TYPE TIMESTAMP
          USING "data_hora_criacao" AT TIME ZONE current_setting('TIMEZONE'),
        ALTER COLUMN "data_hora_expiracao" TYPE TIMESTAMP
          USING "data_hora_expiracao" AT TIME ZONE current_setting('TIMEZONE')
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_reporte_expiracao"
        ON "reporte" ("data_hora_expiracao")
        WHERE "ativo" = TRUE
    `);
  }
}
