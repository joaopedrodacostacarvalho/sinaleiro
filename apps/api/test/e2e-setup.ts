import {
  ForbiddenException,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DecodedIdToken } from 'firebase-admin/auth';
import { DataSource } from 'typeorm';
import { Estacao } from '../src/estacoes/entities/estacao.entity.js';
import { Linha } from '../src/linhas/entities/linha.entity.js';
import { LinhaSentido } from '../src/linhas/entities/linha-sentido.entity/linha-sentido.entity.js';

import { AppModule } from '../src/app.module.js';
import { AuthService } from '../src/auth/auth.service.js';
import { SeedService } from '../src/database/seeds/seed.service.js';
import { CacheService } from '../src/common/cache/cache.service.js';

export function criarTokenTeste(
  uid: string,
  email = `${uid}@metrorec.test`,
  nome = `Passageiro ${uid}`,
): string {
  return `test-token:${uid}:${email}:${encodeURIComponent(nome)}`;
}

export async function criarAppE2E(): Promise<{
  app: INestApplication;
  dataSource: DataSource;
}> {
  const mockAuthService: Partial<AuthService> = {
    verifyToken: (token: string): Promise<DecodedIdToken> => {
      if (!token.startsWith('test-token:')) {
        return Promise.reject(
          new UnauthorizedException('Token de autenticação ausente ou inválido'),
        );
      }

      const [, uid, email, nomeEncoded] = token.split(':');
      if (!uid) {
        return Promise.reject(
          new UnauthorizedException('Token de autenticação ausente ou inválido'),
        );
      }

      const agora = Math.floor(Date.now() / 1000);
      const decoded: DecodedIdToken = {
        aud: 'metrorec-colaborativo',
        auth_time: agora,
        exp: agora + 3600,
        iat: agora,
        iss: 'https://securetoken.google.com/metrorec-colaborativo',
        sub: uid,
        uid,
        email: email || `${uid}@metrorec.test`,
        name: nomeEncoded ? decodeURIComponent(nomeEncoded) : `Passageiro ${uid}`,
        firebase: {
          identities: {},
          sign_in_provider: 'custom',
        },
      };

      return Promise.resolve(decoded);
    },
    createCustomToken: (uid: string): Promise<string> => {
      if (process.env.NODE_ENV === 'production') {
        return Promise.reject(
          new ForbiddenException(
            'Geração de custom token desabilitada em produção',
          ),
        );
      }
      return Promise.resolve(`custom-${uid}`);
    },
  };

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(AuthService)
    .useValue(mockAuthService)
    .compile();

  const app = moduleRef.createNestApplication();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  await app.init();

  const seedService = app.get(SeedService);
  await seedService.runMetrorecSeed();

  const dataSource = app.get(DataSource);
  return { app, dataSource };
}

const ENTIDADES_CATALOGO = new Set<unknown>([Linha, LinhaSentido, Estacao]);

export async function limparDadosTransacionais(
  dataSource: DataSource,
  app?: INestApplication,
): Promise<void> {
  const tabelasTransacionais = dataSource.entityMetadatas
    .filter((meta) => !ENTIDADES_CATALOGO.has(meta.target))
    .map((meta) => `"${meta.tableName}"`);

  if (tabelasTransacionais.length > 0) {
    await dataSource.query(
      `TRUNCATE TABLE ${tabelasTransacionais.join(', ')} RESTART IDENTITY CASCADE;`,
    );
  }

  if (app) {
    await app.get(CacheService).clear();
  }
}
