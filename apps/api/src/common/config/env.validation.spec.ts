import { describe, expect, it } from 'vitest';
import { validarAmbienteProducao } from './env.validation.js';

describe('validarAmbienteProducao', () => {
  const envCompleto: NodeJS.ProcessEnv = {
    NODE_ENV: 'production',
    DB_HOST: 'db.internal',
    DB_PORT: '5432',
    DB_USER: 'sinaleiro',
    DB_PASSWORD: 'secret',
    DB_NAME: 'sinaleiro',
    CORS_ORIGINS: 'https://sinaleiro.app',
    FIREBASE_PROJECT_ID: 'sinaleiro-prod',
    FIREBASE_CLIENT_EMAIL: 'firebase@sinaleiro-prod.iam.gserviceaccount.com',
    FIREBASE_PRIVATE_KEY:
      '-----BEGIN PRIVATE KEY-----\nABC\n-----END PRIVATE KEY-----',
  };

  it('não lança erro fora de produção mesmo sem variáveis', () => {
    expect(() =>
      validarAmbienteProducao({ NODE_ENV: 'development' }),
    ).not.toThrow();
  });

  it('aceita configuração completa em produção', () => {
    expect(() => validarAmbienteProducao(envCompleto)).not.toThrow();
  });

  it('lista variáveis ausentes quando NODE_ENV=production', () => {
    expect(() =>
      validarAmbienteProducao({
        ...envCompleto,
        DB_PASSWORD: '',
        CORS_ORIGINS: undefined,
      }),
    ).toThrow(/DB_PASSWORD, CORS_ORIGINS/);
  });

  it('bloqueia TYPEORM_SYNCHRONIZE=true em produção', () => {
    expect(() =>
      validarAmbienteProducao({
        ...envCompleto,
        TYPEORM_SYNCHRONIZE: 'true',
      }),
    ).toThrow(/TYPEORM_SYNCHRONIZE=true/);
  });

  it('bloqueia wildcard "*" em CORS_ORIGINS quando NODE_ENV=production', () => {
    expect(() =>
      validarAmbienteProducao({
        ...envCompleto,
        CORS_ORIGINS: 'https://sinaleiro.app, *',
      }),
    ).toThrow(/CORS_ORIGINS/);
  });

  it('rejeita FIREBASE_PRIVATE_KEY sem cabeçalho PEM em produção', () => {
    expect(() =>
      validarAmbienteProducao({
        ...envCompleto,
        FIREBASE_PRIVATE_KEY: 'chave-invalida',
      }),
    ).toThrow(/FIREBASE_PRIVATE_KEY/);
  });
});
