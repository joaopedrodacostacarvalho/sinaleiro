import { Module } from '@nestjs/common';
import { LinhasService } from './linhas.service.js';
import { LinhasController } from './linhas.controller.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LinhaSentido } from './entities/linha-sentido.entity/linha-sentido.entity.js';
import { Linha } from './entities/linha.entity.js';

@Module({
  controllers: [LinhasController],
  providers: [LinhasService],
  imports: [TypeOrmModule.forFeature([Linha, LinhaSentido])]
})
export class LinhasModule { }
