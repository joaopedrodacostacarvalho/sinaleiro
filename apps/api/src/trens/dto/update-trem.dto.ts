import { PartialType } from '@nestjs/mapped-types'
import { CreateTremDto } from './create-trem.dto.js';

export class UpdateTrenDto extends PartialType(CreateTremDto) { }
