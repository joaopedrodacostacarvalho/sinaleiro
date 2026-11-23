import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

const __dirname = dirname(fileURLToPath(import.meta.url));

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
          migrations: [join(__dirname, 'migrations', '*.js')],
          synchronize,
          migrationsRun,
        };
      },
    }),
  ],
})
export class DatabaseModule { }
