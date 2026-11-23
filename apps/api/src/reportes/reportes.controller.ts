import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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

import { ReportesService } from './reportes.service.js';
import { ConfirmacoesService } from './confirmacoes.service.js';
import { CreateReporteDto } from './dto/create-reporte.dto.js';
import { UpdateReporteDto } from './dto/update-reporte.dto.js';
import { CreateConfirmacaoDto } from './dto/create-confirmacao.dto.js';
import { FirebaseAuthGuard } from '../auth/firebase-auth/firebase-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Usuario } from '../usuarios/entities/usuario.entity.js';

@ApiTags('reportes')
@ApiBearerAuth('firebase-auth')
@Controller('reportes')
export class ReportesController {
  constructor(
    private readonly reportesService: ReportesService,
    private readonly confirmacoesService: ConfirmacoesService,
  ) { }

  @Post()
  @UseGuards(FirebaseAuthGuard)
  @ApiOperation({ summary: 'Criar um novo reporte' })
  create(
    @Body() createReporteDto: CreateReporteDto,
    @CurrentUser() usuario: Usuario,
  ) {
    return this.reportesService.create(createReporteDto, usuario);
  }

  @Post(':id/confirmacoes')
  @UseGuards(FirebaseAuthGuard)
  @ApiOperation({ summary: 'Confirmar ou discordar de um reporte ativo' })
  confirmar(
    @Param('id') id: string,
    @Body() body: CreateConfirmacaoDto,
    @CurrentUser() usuario: Usuario,
  ) {
    const coords =
      body.latitude != null && body.longitude != null
        ? { lat: body.latitude, lng: body.longitude }
        : null;

    return this.confirmacoesService.confirmar(id, body.tipo, usuario, coords);
  }

  @Get()
  @ApiOperation({ summary: 'Listar reportes ativos (opcionalmente filtrados por alvo)' })
  @ApiQuery({ name: 'alvo', required: false, example: 'estacao' })
  @ApiQuery({ name: 'id', required: false, example: '1' })
  findAll(@Query('alvo') alvo?: string, @Query('id') id?: string) {
    return this.reportesService.findAll(alvo, id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar reporte por ID' })
  findOne(@Param('id') id: string) {
    return this.reportesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(FirebaseAuthGuard)
  update(@Param('id') id: string, @Body() updateReporteDto: UpdateReporteDto) {
    return this.reportesService.update(id, updateReporteDto);
  }

  @Delete(':id')
  @UseGuards(FirebaseAuthGuard)
  remove(@Param('id') id: string) {
    return this.reportesService.remove(id);
  }
}
