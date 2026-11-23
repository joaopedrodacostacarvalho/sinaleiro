import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseFloatPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { EstacoesService } from './estacoes.service.js';
import { CreateEstacaoDto } from './dto/create-estacao.dto.js';
import { UpdateEstacaoDto } from './dto/update-estacao.dto.js';
import { FirebaseAuthGuard } from '../auth/firebase-auth/firebase-auth.guard.js';

@ApiTags('estacoes')
@Controller('estacoes')
export class EstacoesController {
  constructor(private readonly estacoesService: EstacoesService) { }

  @Post()
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth('firebase-auth')
  create(@Body() createEstacaoDto: CreateEstacaoDto) {
    return this.estacoesService.create(createEstacaoDto);
  }

  @Get('proximas')
  @ApiOperation({ summary: 'Retorna as N estações mais próximas via Haversine' })
  @ApiQuery({ name: 'lat', type: Number, example: -8.067794 })
  @ApiQuery({ name: 'lng', type: Number, example: -34.885139 })
  @ApiQuery({ name: 'limite', type: Number, required: false, example: 3 })
  getProximas(
    @Query('lat', ParseFloatPipe) lat: number,
    @Query('lng', ParseFloatPipe) lng: number,
    @Query('limite', new DefaultValuePipe(3), ParseIntPipe) limite: number,
  ) {
    return this.estacoesService.getProximas(lat, lng, limite);
  }

  @Get()
  findAll() {
    return this.estacoesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.estacoesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth('firebase-auth')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateEstacaoDto: UpdateEstacaoDto,
  ) {
    return this.estacoesService.update(id, updateEstacaoDto);
  }

  @Delete(':id')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth('firebase-auth')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.estacoesService.remove(id);
  }
}
