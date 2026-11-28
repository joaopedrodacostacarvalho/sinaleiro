import fs from 'node:fs';
import { defineConfig } from 'vitest/config';
import baseConfig from './vitest.config.js';

const loadEnvFile = (
  process as { loadEnvFile?: (path?: string) => void }
).loadEnvFile;

if (typeof loadEnvFile === 'function') {
  for (const envPath of ['../../.env', '.env']) {
    try {
      loadEnvFile(envPath);
    } catch {
      // Ignora se o arquivo não existir (ex.: ambiente de CI)
    }
  }
}

const rodandoEmContainer = fs.existsSync('/.dockerenv');
const dbHostResolvido =
  process.env.E2E_DB_HOST ??
  (!rodandoEmContainer && process.env.DB_HOST === 'db'
    ? 'localhost'
    : (process.env.DB_HOST ?? 'localhost'));

const e2eEnv = {
  NODE_ENV: 'test',
  DB_HOST: dbHostResolvido,
  DB_PORT: process.env.DB_PORT ?? '5432',
  DB_USER: process.env.DB_USER ?? 'postgres',
  DB_PASSWORD: process.env.DB_PASSWORD ?? 'postgres',
  DB_NAME: process.env.E2E_DB_NAME ?? 'sinaleiro_test',
  TYPEORM_SYNCHRONIZE: 'false',
  TYPEORM_MIGRATIONS_RUN: 'true',
  THROTTLE_SHORT_LIMIT: '1000',
  THROTTLE_LIMIT: '1000',
};

Object.assign(process.env, e2eEnv);

export default defineConfig(
  Object.assign({}, baseConfig, {
    test: Object.assign({}, baseConfig.test, {
      include: ['test/**/*.e2e-spec.ts'],
      globalSetup: ['./test/global-setup.e2e.ts'],
      testTimeout: 30_000,
      hookTimeout: 30_000,
      fileParallelism: false,
      env: e2eEnv,
    }),
  }),
);
