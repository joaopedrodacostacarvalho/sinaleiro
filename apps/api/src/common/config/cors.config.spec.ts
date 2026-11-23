import { describe, expect, it } from 'vitest';
import { buildCorsOptions, parseCorsOrigins } from './cors.config.js';

describe('cors.config', () => {
  it('retorna lista normalizada de origens em produção quando CORS_ORIGINS está definida', () => {
    const origins = parseCorsOrigins(
      'https://sinaleiro.app/, https://www.sinaleiro.app ',
      'production',
    );

    expect(origins).toEqual([
      'https://sinaleiro.app',
      'https://www.sinaleiro.app',
    ]);
  });

  it('mescla origens configuradas com padrões locais fora de produção', () => {
    const origins = parseCorsOrigins('http://192.168.0.10:5173/', 'development');

    expect(origins).toEqual([
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:4173',
      'http://127.0.0.1:4173',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://192.168.0.10:5173',
    ]);
  });

  it('usa origens locais padrão fora de produção quando CORS_ORIGINS está vazia', () => {
    expect(parseCorsOrigins('', 'development')).toEqual([
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:4173',
      'http://127.0.0.1:4173',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ]);
  });

  it('bloqueia origens por padrão em produção se CORS_ORIGINS não for configurada', () => {
    expect(parseCorsOrigins(undefined, 'production')).toBe(false);
  });

  it('monta opções de CORS com métodos e headers esperados', () => {
    const options = buildCorsOptions();
    expect(options.credentials).toBe(true);
    expect(options.allowedHeaders).toEqual(['Content-Type', 'Authorization']);
  });
});
