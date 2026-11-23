import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TrensService } from './trens.service.js';
import { TrensController } from './trens.controller.js';
import { Trem } from './entities/trem.entity.js';
import { Reporte } from '../reportes/entities/reporte.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Trem, Reporte])],
  controllers: [TrensController],
  providers: [TrensService],
  exports: [TrensService],
})
export class TrensModule { }
