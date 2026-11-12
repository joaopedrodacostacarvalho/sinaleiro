import { Injectable } from '@nestjs/common';
import { CreateLinhaDto } from './dto/create-linha.dto.js';
import { UpdateLinhaDto } from './dto/update-linha.dto.js';

@Injectable()
export class LinhasService {
  create(createLinhaDto: CreateLinhaDto) {
    return 'This action adds a new linha';
  }

  findAll() {
    return `This action returns all linhas`;
  }

  findOne(id: number) {
    return `This action returns a #${id} linha`;
  }

  update(id: number, updateLinhaDto: UpdateLinhaDto) {
    return `This action updates a #${id} linha`;
  }

  remove(id: number) {
    return `This action removes a #${id} linha`;
  }
}
