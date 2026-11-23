import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { StatusService } from './status.service.js';

@ApiTags('status')
@Controller()
export class StatusController {
  constructor(private readonly statusService: StatusService) { }

  @Get('estacoes/:id/status')
  @ApiOperation({ summary: 'Status efetivo da estação' })
  getStatusEstacao(@Param('id', ParseIntPipe) id: number) {
    return this.statusService.getStatusEstacao(id);
  }

  @Get('linhas/:id/status')
  @ApiOperation({ summary: 'Status efetivo da linha' })
  getStatusLinha(@Param('id', ParseIntPipe) id: number) {
    return this.statusService.getStatusLinha(id);
  }

  @Get('trens/:id/status')
  @ApiOperation({ summary: 'Status efetivo do trem' })
  getStatusTrem(@Param('id', ParseUUIDPipe) id: string) {
    return this.statusService.getStatusTrem(id);
  }

  @Get('mapa')
  @ApiOperation({ summary: 'Payload agregado do mapa (linhas, estações e trens)' })
  getMapa() {
    return this.statusService.getMapa();
  }
}
