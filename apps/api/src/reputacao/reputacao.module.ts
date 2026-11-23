import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReputacaoService } from './reputacao.service.js';
import { Usuario } from '../usuarios/entities/usuario.entity.js';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Usuario])],
  providers: [ReputacaoService],
  exports: [ReputacaoService],
})
export class ReputacaoModule { }
