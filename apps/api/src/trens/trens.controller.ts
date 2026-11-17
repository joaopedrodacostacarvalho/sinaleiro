import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { TrensService } from './trens.service.js';
import { CreateTremDto } from './dto/create-trem.dto.js';
import { UpdateTremDto } from './dto/update-trem.dto.js';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FirebaseAuthGuard } from '../auth/firebase-auth/firebase-auth.guard.js';

@ApiTags('trens')
@Controller('trens')
export class TrensController {
  constructor(private readonly trensService: TrensService) { }

  @Post()
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth('firebase-auth')
  create(@Body() createTrenDto: CreateTremDto) {
    return this.trensService.create(createTrenDto);
  }

  @Get()
  findAll() {
    return this.trensService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.trensService.findOne(+id);
  }

  @Patch(':id')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth('firebase-auth')
  update(@Param('id') id: string, @Body() updateTrenDto: UpdateTremDto) {
    return this.trensService.update(+id, updateTrenDto);
  }

  @Delete(':id')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth('firebase-auth')
  remove(@Param('id') id: string) {
    return this.trensService.remove(+id);
  }
}
