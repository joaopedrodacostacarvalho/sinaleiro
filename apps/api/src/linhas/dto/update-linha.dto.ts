import { PartialType } from '@nestjs/swagger';
import { CreateLinhaDto } from './create-linha.dto.js';

export class UpdateLinhaDto extends PartialType(CreateLinhaDto) { }
