import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface.js';

const ORIGENS_DEV_PADRAO = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

function normalizarOrigem(origin: string): string {
  return origin.trim().replace(/\/+$/, '');
}

export function parseCorsOrigins(
  rawOrigins = process.env.CORS_ORIGINS,
  nodeEnv = process.env.NODE_ENV,
): string[] | boolean {
  const isProd = nodeEnv === 'production';

  if (rawOrigins && rawOrigins.trim().length > 0) {
    const configuradas = rawOrigins
      .split(',')
      .map(normalizarOrigem)
      .filter((origin) => origin.length > 0);

    if (isProd) {
      return configuradas;
    }

    return Array.from(new Set([...ORIGENS_DEV_PADRAO, ...configuradas]));
  }

  return isProd ? false : ORIGENS_DEV_PADRAO;
}

export function buildCorsOptions(): CorsOptions {
  return {
    origin: parseCorsOrigins(),
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86_400,
  };
}
