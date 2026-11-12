import { Module } from '@nestjs/common';
import { ReportesService } from './reportes.service.js';
import { ReportesController } from './reportes.controller.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfirmacaoReporte } from './entities/confirmacao-reporte.entity/confirmacao-reporte.entity.js';
import { Reporte } from './entities/reporte.entity.js';

@Module({
  controllers: [ReportesController],
  providers: [ReportesService],
  imports: [TypeOrmModule.forFeature([Reporte, ConfirmacaoReporte])]
})
export class ReportesModule { }
