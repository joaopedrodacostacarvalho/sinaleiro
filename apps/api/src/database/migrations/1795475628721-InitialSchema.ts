import type { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1795475628721 implements MigrationInterface {
  name = 'InitialSchema1795475628721'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE TYPE "public"."linha_sentido_sentido_enum" AS ENUM('RECIFE', 'CAMARAGIBE', 'JABOATAO', 'CAJUEIRO_SECO', 'CABO', 'SOTAVE')`);
    await queryRunner.query(`CREATE TABLE "linha_sentido" ("linha_id" integer NOT NULL, "sentido" "public"."linha_sentido_sentido_enum" NOT NULL, CONSTRAINT "PK_7485cab0c4c2a79ee86081bc5cd" PRIMARY KEY ("linha_id", "sentido"))`);
    await queryRunner.query(`CREATE TYPE "public"."confirmacao_reporte_tipo_enum" AS ENUM('CONFIRMAR', 'DISCORDAR')`);
    await queryRunner.query(`CREATE TABLE "confirmacao_reporte" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "reporte_id" uuid NOT NULL, "usuario_id" uuid NOT NULL, "tipo" "public"."confirmacao_reporte_tipo_enum" NOT NULL, "peso" double precision NOT NULL DEFAULT '1', "data_hora" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_dbf14bdd163520d35283d220ff2" UNIQUE ("reporte_id", "usuario_id"), CONSTRAINT "PK_165cf8e22cf4d5d498e4abfa0a2" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE TABLE "usuario" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "firebase_uid" character varying(128), "google_id" character varying(255), "nome" character varying(255) NOT NULL, "email" character varying(255) NOT NULL, "reputacao" smallint NOT NULL DEFAULT '0', "data_cadastro" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_86778b54fc33a06c2a261d06450" UNIQUE ("firebase_uid"), CONSTRAINT "UQ_2863682842e688ca198eb25c124" UNIQUE ("email"), CONSTRAINT "PK_a56c58e5cabaa04fb2c98d2d7e2" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE TYPE "public"."reporte_tipo_enum" AS ENUM('ESTACAO', 'LINHA', 'TREM')`);
    await queryRunner.query(`CREATE TYPE "public"."reporte_status_estacao_enum" AS ENUM('NORMAL', 'ATENCAO', 'PARALISADA', 'LOTADA', 'FECHADA')`);
    await queryRunner.query(`CREATE TYPE "public"."reporte_status_linha_enum" AS ENUM('NORMAL', 'ATENCAO', 'PARALISADA')`);
    await queryRunner.query(`CREATE TYPE "public"."reporte_status_trem_enum" AS ENUM('NORMAL', 'LOTADO', 'ATRASO', 'PARADO', 'AR_CONDICIONADO_QUEBRADO', 'AVARIADO')`);
    await queryRunner.query(`CREATE TABLE "reporte" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tipo" "public"."reporte_tipo_enum" NOT NULL, "usuario_id" uuid NOT NULL, "trem_id" uuid, "estacao_id" integer, "linha_id" integer, "status_estacao" "public"."reporte_status_estacao_enum", "status_linha" "public"."reporte_status_linha_enum", "status_trem" "public"."reporte_status_trem_enum", "data_hora_criacao" TIMESTAMP NOT NULL, "data_hora_expiracao" TIMESTAMP NOT NULL, "confianca" integer NOT NULL DEFAULT '0', "ativo" boolean NOT NULL DEFAULT true, "reputacao_aplicada" boolean NOT NULL DEFAULT false, CONSTRAINT "reporte_alvo_unico" CHECK (
  (tipo = 'ESTACAO'
    AND estacao_id IS NOT NULL AND status_estacao IS NOT NULL
    AND linha_id IS NULL AND trem_id IS NULL
    AND status_linha IS NULL AND status_trem IS NULL)
  OR
  (tipo = 'LINHA'
    AND linha_id IS NOT NULL AND status_linha IS NOT NULL
    AND estacao_id IS NULL AND trem_id IS NULL
    AND status_estacao IS NULL AND status_trem IS NULL)
  OR
  (tipo = 'TREM'
    AND trem_id IS NOT NULL AND estacao_id IS NOT NULL AND status_trem IS NOT NULL
    AND linha_id IS NULL AND status_estacao IS NULL AND status_linha IS NULL)
), CONSTRAINT "PK_8ff73251b8d9b8c8c6acf1deb46" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "idx_reporte_expiracao" ON "reporte"  ("data_hora_expiracao") WHERE "ativo" = TRUE`);
    await queryRunner.query(`CREATE TYPE "public"."trem_sentido_enum" AS ENUM('RECIFE', 'CAMARAGIBE', 'JABOATAO', 'CAJUEIRO_SECO', 'CABO', 'SOTAVE')`);
    await queryRunner.query(`CREATE TABLE "trem" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "linha_id" integer NOT NULL, "sentido" "public"."trem_sentido_enum" NOT NULL, "id_vagao" character varying(255), CONSTRAINT "PK_e3fd2e3b6b50bb23500e61646dc" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE TABLE "linha" ("id" SERIAL NOT NULL, "nome" character varying(255) NOT NULL, "cor" character(7) NOT NULL, CONSTRAINT "PK_0ffd987432071dbe15c6d4bf52b" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE TABLE "estacao" ("id" SERIAL NOT NULL, "nome" character varying(255) NOT NULL, "latitude" numeric(10,8) NOT NULL, "longitude" numeric(11,8) NOT NULL, "linha_id" integer NOT NULL, CONSTRAINT "PK_0663192d3e2bae63d97a3226004" PRIMARY KEY ("id"))`);
    await queryRunner.query(`ALTER TABLE "linha_sentido" ADD CONSTRAINT "FK_2ab4675a34cac1dff955630ac3c" FOREIGN KEY ("linha_id") REFERENCES "linha"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "confirmacao_reporte" ADD CONSTRAINT "FK_54c8f83a6c1ebb2dc1f56427be0" FOREIGN KEY ("reporte_id") REFERENCES "reporte"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "confirmacao_reporte" ADD CONSTRAINT "FK_980922a315c8e86a0f7c52ca087" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "reporte" ADD CONSTRAINT "FK_6fb31faf9e5813b45f9ff66680e" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "reporte" ADD CONSTRAINT "FK_3fb11379dc4ca801ddfcd7b2625" FOREIGN KEY ("trem_id") REFERENCES "trem"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "reporte" ADD CONSTRAINT "FK_72b488a0afb7c62b5579892e98e" FOREIGN KEY ("estacao_id") REFERENCES "estacao"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "reporte" ADD CONSTRAINT "FK_251d5c612444a89f8077b191ccf" FOREIGN KEY ("linha_id") REFERENCES "linha"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "trem" ADD CONSTRAINT "FK_b9e7f840d81af3bb0c32f525945" FOREIGN KEY ("linha_id") REFERENCES "linha"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "estacao" ADD CONSTRAINT "FK_bbe9567f34f4a0b6b869ad3f2b0" FOREIGN KEY ("linha_id") REFERENCES "linha"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "estacao" DROP CONSTRAINT "FK_bbe9567f34f4a0b6b869ad3f2b0"`);
    await queryRunner.query(`ALTER TABLE "trem" DROP CONSTRAINT "FK_b9e7f840d81af3bb0c32f525945"`);
    await queryRunner.query(`ALTER TABLE "reporte" DROP CONSTRAINT "FK_251d5c612444a89f8077b191ccf"`);
    await queryRunner.query(`ALTER TABLE "reporte" DROP CONSTRAINT "FK_72b488a0afb7c62b5579892e98e"`);
    await queryRunner.query(`ALTER TABLE "reporte" DROP CONSTRAINT "FK_3fb11379dc4ca801ddfcd7b2625"`);
    await queryRunner.query(`ALTER TABLE "reporte" DROP CONSTRAINT "FK_6fb31faf9e5813b45f9ff66680e"`);
    await queryRunner.query(`ALTER TABLE "confirmacao_reporte" DROP CONSTRAINT "FK_980922a315c8e86a0f7c52ca087"`);
    await queryRunner.query(`ALTER TABLE "confirmacao_reporte" DROP CONSTRAINT "FK_54c8f83a6c1ebb2dc1f56427be0"`);
    await queryRunner.query(`ALTER TABLE "linha_sentido" DROP CONSTRAINT "FK_2ab4675a34cac1dff955630ac3c"`);
    await queryRunner.query(`DROP TABLE "estacao"`);
    await queryRunner.query(`DROP TABLE "linha"`);
    await queryRunner.query(`DROP TABLE "trem"`);
    await queryRunner.query(`DROP TYPE "public"."trem_sentido_enum"`);
    await queryRunner.query(`DROP INDEX "public"."idx_reporte_expiracao"`);
    await queryRunner.query(`DROP TABLE "reporte"`);
    await queryRunner.query(`DROP TYPE "public"."reporte_status_trem_enum"`);
    await queryRunner.query(`DROP TYPE "public"."reporte_status_linha_enum"`);
    await queryRunner.query(`DROP TYPE "public"."reporte_status_estacao_enum"`);
    await queryRunner.query(`DROP TYPE "public"."reporte_tipo_enum"`);
    await queryRunner.query(`DROP TABLE "usuario"`);
    await queryRunner.query(`DROP TABLE "confirmacao_reporte"`);
    await queryRunner.query(`DROP TYPE "public"."confirmacao_reporte_tipo_enum"`);
    await queryRunner.query(`DROP TABLE "linha_sentido"`);
    await queryRunner.query(`DROP TYPE "public"."linha_sentido_sentido_enum"`);
  }

}
