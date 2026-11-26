import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { UsuariosModule } from './usuarios/usuarios.module.js';
import { LinhasModule } from './linhas/linhas.module.js';
import { EstacoesModule } from './estacoes/estacoes.module.js';
import { TrensModule } from './trens/trens.module.js';
import { ReportesModule } from './reportes/reportes.module.js';
import { ReputacaoModule } from './reputacao/reputacao.module.js'
import { DatabaseModule } from './database/database.module.js';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { HealthModule } from './health/health.module.js';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1_000,
        limit: Number(process.env.THROTTLE_SHORT_LIMIT ?? 10),
      },
      {
        name: 'default',
        ttl: Number(process.env.THROTTLE_TTL_MS ?? 60_000),
        limit: Number(process.env.THROTTLE_LIMIT ?? 60),
      },
    ]),
    AuthModule,
    UsuariosModule,
    LinhasModule,
    EstacoesModule,
    TrensModule,
    ReportesModule,
    ReputacaoModule,
    DatabaseModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    }
  ],
})
export class AppModule { }
