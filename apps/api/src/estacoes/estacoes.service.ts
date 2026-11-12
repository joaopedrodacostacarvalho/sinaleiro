import { Injectable } from '@nestjs/common';
import { CreateEstacaoDto } from './dto/create-estacao.dto.js';
import { UpdateEstacaoDto } from './dto/update-estacao.dto.js';

@Injectable()
export class EstacoesService {
  create(createEstacaoDto: CreateEstacaoDto) {
    return 'This action adds a new estacoe';
  }

  findAll() {
    return `This action returns all estacoes`;
  }

  findOne(id: number) {
    return `This action returns a #${id} estacoe`;
  }

  update(id: number, UpdateEstacaoDto: UpdateEstacaoDto) {
    return `This action updates a #${id} estacoe`;
  }

  remove(id: number) {
    return `This action removes a #${id} estacoe`;
  }
}
