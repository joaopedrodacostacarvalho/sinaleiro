import { Module } from '@nestjs/common';
import { TrensService } from './trens.service.js';
import { TrensController } from './trens.controller.js';
import { Trem } from './entities/trem.entity.js';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  controllers: [TrensController],
  providers: [TrensService],
  imports: [TypeOrmModule.forFeature([Trem])]
})
export class TrensModule { }
