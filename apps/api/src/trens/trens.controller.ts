import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { TrensService } from './trens.service.js';
import { CreateTremDto } from './dto/create-trem.dto.js';
import { UpdateTrenDto } from './dto/update-trem.dto.js';

@Controller('trens')
export class TrensController {
  constructor(private readonly trensService: TrensService) { }

  @Post()
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
  update(@Param('id') id: string, @Body() updateTrenDto: UpdateTrenDto) {
    return this.trensService.update(+id, updateTrenDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.trensService.remove(+id);
  }
}
