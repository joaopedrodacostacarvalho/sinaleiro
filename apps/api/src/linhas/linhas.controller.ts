import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { LinhasService } from './linhas.service.js';
import { CreateLinhaDto } from './dto/create-linha.dto.js';
import { UpdateLinhaDto } from './dto/update-linha.dto.js';

@Controller('linhas')
export class LinhasController {
  constructor(private readonly linhasService: LinhasService) {}

  @Post()
  create(@Body() createLinhaDto: CreateLinhaDto) {
    return this.linhasService.create(createLinhaDto);
  }

  @Get()
  findAll() {
    return this.linhasService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.linhasService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateLinhaDto: UpdateLinhaDto) {
    return this.linhasService.update(+id, updateLinhaDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.linhasService.remove(+id);
  }
}
