import { Module } from '@nestjs/common';
import { SeedService } from './seeds/seed.service.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Linha } from '../linhas/entities/linha.entity.js';
import { LinhaSentido } from '../linhas/entities/linha-sentido.entity/linha-sentido.entity.js';
import { Estacao } from '../estacoes/entities/estacao.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Linha, LinhaSentido, Estacao])],
  providers: [SeedService],

})
export class DatabaseModule { }
