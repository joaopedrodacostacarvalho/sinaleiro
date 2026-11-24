import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Linha } from '../linhas/entities/linha.entity.js';
import { LinhaSentido } from '../linhas/entities/linha-sentido.entity/linha-sentido.entity.js';
import { Estacao } from '../estacoes/entities/estacao.entity.js';
import { SeedService } from './seeds/seed.service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationExt = import.meta.url.endsWith('.ts') ? '.ts' : '.js';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        const isProd = process.env.NODE_ENV === 'production';

        const synchronize =
          process.env.TYPEORM_SYNCHRONIZE != null
            ? process.env.TYPEORM_SYNCHRONIZE === 'true'
            : !isProd;

        const migrationsRun =
          process.env.TYPEORM_MIGRATIONS_RUN != null
            ? process.env.TYPEORM_MIGRATIONS_RUN === 'true'
            : isProd;

        return {
          type: 'postgres',
          host: process.env.DB_HOST ?? 'postgres',
          port: Number(process.env.DB_PORT ?? 5432),
          username: process.env.DB_USER ?? 'postgres',
          password: process.env.DB_PASSWORD ?? 'postgres',
          database: process.env.DB_NAME ?? 'sinaleiro',
          autoLoadEntities: true,
          migrations: [join(__dirname, 'migrations', `*${migrationExt}`)],
          retryAttempts: process.env.NODE_ENV === 'test' ? 1 : 10,
          synchronize,
          migrationsRun,
        };
      },
    }),
    TypeOrmModule.forFeature([Linha, LinhaSentido, Estacao]),
  ],
  providers: [SeedService],
  exports: [SeedService],
})
export class DatabaseModule { }
