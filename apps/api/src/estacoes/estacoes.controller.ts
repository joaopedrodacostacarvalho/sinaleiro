import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { EstacoesService } from './estacoes.service.js';
import { CreateEstacaoDto } from './dto/create-estacao.dto.js';
import { UpdateEstacaoDto } from './dto/update-estacao.dto.js';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FirebaseAuthGuard } from '../auth/firebase-auth/firebase-auth.guard.js';

@ApiTags('estacoes')
@Controller('estacoes')
export class EstacoesController {
  constructor(private readonly estacoesService: EstacoesService) { }

  @Post()
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth('firebase-auth')
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
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth('firebase-auth')
  update(@Param('id') id: string, @Body() updateEstacoeDto: UpdateEstacaoDto) {
    return this.estacoesService.update(+id, updateEstacoeDto);
  }

  @Delete(':id')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth('firebase-auth')
  remove(@Param('id') id: string) {
    return this.estacoesService.remove(+id);
  }
}
