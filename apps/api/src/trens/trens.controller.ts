import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { TrensService } from './trens.service.js';

@ApiTags('trens')
@Controller('trens')
export class TrensController {
  constructor(private readonly trensService: TrensService) { }

  @Get('ativos')
  @ApiOperation({ summary: 'Lista trens com reportes nos últimos 20 minutos' })
  listarAtivos() {
    return this.trensService.listarAtivos();
  }

  @Get()
  findAll() {
    return this.trensService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.trensService.findOne(id);
  }
}
