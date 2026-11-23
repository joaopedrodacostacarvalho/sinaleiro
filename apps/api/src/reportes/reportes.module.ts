import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ReportesService } from './reportes.service.js';
import { ConfirmacoesService } from './confirmacoes.service.js';
import { StatusService } from './status.service.js';
import { ReportesController } from './reportes.controller.js';
import { StatusController } from './status.controller.js';
import { CacheService } from '../common/cache/cache.service.js';
import { ReputacaoModule } from '../reputacao/reputacao.module.js';
import { TrensModule } from '../trens/trens.module.js';
import { ConfirmacaoReporte } from './entities/confirmacao-reporte.entity/confirmacao-reporte.entity.js';
import { Reporte } from './entities/reporte.entity.js';
import { Estacao } from '../estacoes/entities/estacao.entity.js';
import { Linha } from '../linhas/entities/linha.entity.js';
import { Trem } from '../trens/entities/trem.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Reporte,
      ConfirmacaoReporte,
      Estacao,
      Linha,
      Trem,
    ]),
    ReputacaoModule,
    TrensModule,
  ],
  controllers: [ReportesController, StatusController],
  providers: [
    ReportesService,
    ConfirmacoesService,
    StatusService,
    CacheService,
  ],
  exports: [ReportesService, ConfirmacoesService, StatusService],
})
export class ReportesModule { }
