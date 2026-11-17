import { PartialType } from '@nestjs/swagger';
import { CreateEstacaoDto } from './create-estacao.dto.js';

export class UpdateEstacaoDto extends PartialType(CreateEstacaoDto) { }
