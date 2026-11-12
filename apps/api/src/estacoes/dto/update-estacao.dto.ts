import { PartialType } from '@nestjs/mapped-types';
import { CreateEstacaoDto } from './create-estacao.dto.js';

export class UpdateEstacaoDto extends PartialType(CreateEstacaoDto) { }
