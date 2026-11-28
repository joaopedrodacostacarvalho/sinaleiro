import { DataSource } from 'typeorm';

interface ExistsRow {
  exists: boolean;
}

function isExistsRow(value: unknown): value is ExistsRow {
  return (
    typeof value === 'object' &&
    value !== null &&
    'exists' in value &&
    typeof (value as ExistsRow).exists === 'boolean'
  );
}

export default async function setup(): Promise<void> {
  const dbName = process.env.DB_NAME ?? 'sinaleiro_test';
  if (!/^[a-zA-Z0-9_]+$/.test(dbName)) {
    throw new Error(`Nome de banco inválido para E2E: ${dbName}`);
  }

  const adminDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? '5432'),
    username: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: 'postgres',
  });

  await adminDataSource.initialize();
  try {
    const rawResult: unknown = await adminDataSource.query(
      'SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) AS "exists"',
      [dbName],
    );

    const jaExiste =
      Array.isArray(rawResult) &&
      rawResult.length > 0 &&
      isExistsRow(rawResult[0]) &&
      rawResult[0].exists;

    if (!jaExiste) {
      await adminDataSource.query(`CREATE DATABASE "${dbName}"`);
    }
  } finally {
    await adminDataSource.destroy();
  }
}
