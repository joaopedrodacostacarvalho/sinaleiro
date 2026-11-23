import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { TrensService } from './trens.service.js';
import { CreateTremDto } from './dto/create-trem.dto.js';
import { UpdateTremDto } from './dto/update-trem.dto.js';
import { FirebaseAuthGuard } from '../auth/firebase-auth/firebase-auth.guard.js';

@ApiTags('trens')
@Controller('trens')
export class TrensController {
  constructor(private readonly trensService: TrensService) { }

  @Post()
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth('firebase-auth')
  create(@Body() createTremDto: CreateTremDto) {
    return this.trensService.create(createTremDto);
  }

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

  @Patch(':id')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth('firebase-auth')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTremDto: UpdateTremDto,
  ) {
    return this.trensService.update(id, updateTremDto);
  }

  @Delete(':id')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth('firebase-auth')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.trensService.remove(id);
  }
}
