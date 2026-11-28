import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { LinhasService } from './linhas.service.js';

@ApiTags('linhas')
@Controller('linhas')
export class LinhasController {
  constructor(private readonly linhasService: LinhasService) { }

  @Get()
  @ApiOperation({ summary: 'Listar todas as linhas do Metrorec' })
  findAll() {
    return this.linhasService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar linha por ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.linhasService.findOne(id);
  }
}
