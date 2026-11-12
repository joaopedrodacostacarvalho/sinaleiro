import { Module } from '@nestjs/common';
import { EstacoesService } from './estacoes.service.js';
import { EstacoesController } from './estacoes.controller.js';
import { Estacao } from './entities/estacao.entity.js';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  controllers: [EstacoesController],
  providers: [EstacoesService],
  imports: [TypeOrmModule.forFeature([Estacao])]
})
export class EstacoesModule { }
