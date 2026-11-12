import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { EstacoesService } from './estacoes.service.js';
import { CreateEstacaoDto } from './dto/create-estacao.dto.js';
import { UpdateEstacaoDto } from './dto/update-estacao.dto.js';

@Controller('estacoes')
export class EstacoesController {
  constructor(private readonly estacoesService: EstacoesService) { }

  @Post()
  create(@Body() createEstacoeDto: CreateEstacaoDto) {
    return this.estacoesService.create(createEstacoeDto);
  }

  @Get()
  findAll() {
    return this.estacoesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.estacoesService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateEstacoeDto: UpdateEstacaoDto) {
    return this.estacoesService.update(+id, updateEstacoeDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.estacoesService.remove(+id);
  }
}
