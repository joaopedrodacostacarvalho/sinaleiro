import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ReportesService } from './reportes.service.js';
import { CreateReporteDto } from './dto/create-reporte.dto.js';
import { UpdateReporteDto } from './dto/update-reporte.dto.js';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FirebaseAuthGuard } from '../auth/firebase-auth/firebase-auth.guard.js';

@ApiTags('reportes')
@ApiBearerAuth('firebase-auth')
@Controller('reportes')
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) { }

  @Post()
  @UseGuards(FirebaseAuthGuard)
  create(@Body() createReporteDto: CreateReporteDto) {
    return this.reportesService.create(createReporteDto);
  }

  // TODO POST /reportes/:id/confirmacoes

  @Get()
  findAll() {
    return this.reportesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.reportesService.findOne(+id);
  }

  @Patch(':id')
  @UseGuards(FirebaseAuthGuard)
  update(@Param('id') id: string, @Body() updateReporteDto: UpdateReporteDto) {
    return this.reportesService.update(+id, updateReporteDto);
  }

  @Delete(':id')
  @UseGuards(FirebaseAuthGuard)
  remove(@Param('id') id: string) {
    return this.reportesService.remove(+id);
  }
}
