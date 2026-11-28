import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseFloatPipe,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { EstacoesService } from './estacoes.service.js';

@ApiTags('estacoes')
@Controller('estacoes')
export class EstacoesController {
  constructor(private readonly estacoesService: EstacoesService) { }

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
}
