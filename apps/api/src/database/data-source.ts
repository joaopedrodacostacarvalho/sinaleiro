import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DataSource } from 'typeorm';

const __dirname = dirname(fileURLToPath(import.meta.url));

const loadEnvFile = (
  process as { loadEnvFile?: (path?: string) => void }
).loadEnvFile;

if (typeof loadEnvFile === 'function') {
  for (const envPath of ['../../.env', '.env']) {
    try {
      loadEnvFile(envPath);
    } catch {
      // Ignora se o arquivo não existir (ex.: variáveis injetadas pelo Docker ou CI)
    }
  }
}

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'sinaleiro',
  entities: [join(__dirname, '..', '**', '*.entity.js')],
  migrations: [join(__dirname, 'migrations', '*.js')],
  synchronize: false,
  logging: process.env.NODE_ENV !== 'production',
});
