import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface.js';

const ORIGENS_DEV_PADRAO = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3000',
];

export function parseCorsOrigins(
  rawOrigins = process.env.CORS_ORIGINS,
  nodeEnv = process.env.NODE_ENV,
): string[] | boolean {
  if (rawOrigins && rawOrigins.trim().length > 0) {
    return rawOrigins
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);
  }

  return nodeEnv === 'production' ? false : ORIGENS_DEV_PADRAO;
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
