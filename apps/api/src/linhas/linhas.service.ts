import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CreateLinhaDto } from './dto/create-linha.dto.js';
import { UpdateLinhaDto } from './dto/update-linha.dto.js';
import { Linha } from './entities/linha.entity.js';

@Injectable()
export class LinhasService {
  constructor(
    @InjectRepository(Linha)
    private readonly linhaRepo: Repository<Linha>,
  ) { }

  async create(createLinhaDto: CreateLinhaDto): Promise<Linha> {
    const linha = this.linhaRepo.create(createLinhaDto);
    return this.linhaRepo.save(linha);
  }

  async findAll(): Promise<Linha[]> {
    return this.linhaRepo.find({
      order: { id: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Linha> {
    const linha = await this.linhaRepo.findOne({
      where: { id },
    });
    if (!linha) {
      throw new NotFoundException(`Linha #${id} não encontrada`);
    }
    return linha;
  }

  async update(id: number, updateLinhaDto: UpdateLinhaDto): Promise<Linha> {
    const linha = await this.findOne(id);
    Object.assign(linha, updateLinhaDto);
    return this.linhaRepo.save(linha);
  }

  async remove(id: number): Promise<void> {
    const linha = await this.findOne(id);
    await this.linhaRepo.remove(linha);
  }
}
