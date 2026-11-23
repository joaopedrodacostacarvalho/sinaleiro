import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { LinhasService } from './linhas.service.js';
import { CreateLinhaDto } from './dto/create-linha.dto.js';
import { UpdateLinhaDto } from './dto/update-linha.dto.js';
import { FirebaseAuthGuard } from '../auth/firebase-auth/firebase-auth.guard.js';

@ApiTags('linhas')
@Controller('linhas')
export class LinhasController {
  constructor(private readonly linhasService: LinhasService) { }

  @Post()
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth('firebase-auth')
  @ApiOperation({ summary: 'Criar uma nova linha' })
  create(@Body() createLinhaDto: CreateLinhaDto) {
    return this.linhasService.create(createLinhaDto);
  }

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

  @Patch(':id')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth('firebase-auth')
  @ApiOperation({ summary: 'Atualizar uma linha' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateLinhaDto: UpdateLinhaDto,
  ) {
    return this.linhasService.update(id, updateLinhaDto);
  }

  @Delete(':id')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth('firebase-auth')
  @ApiOperation({ summary: 'Remover uma linha' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.linhasService.remove(id);
  }
}
