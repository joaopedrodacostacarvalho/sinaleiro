import { Injectable } from '@nestjs/common';
import { CreateTremDto } from './dto/create-trem.dto.js';
import { UpdateTrenDto } from './dto/update-trem.dto.js';

@Injectable()
export class TrensService {
  create(createTrenDto: CreateTremDto) {
    return 'This action adds a new tren';
  }

  findAll() {
    return `This action returns all trens`;
  }

  findOne(id: number) {
    return `This action returns a #${id} tren`;
  }

  update(id: number, updateTrenDto: UpdateTrenDto) {
    return `This action updates a #${id} tren`;
  }

  remove(id: number) {
    return `This action removes a #${id} tren`;
  }
}
