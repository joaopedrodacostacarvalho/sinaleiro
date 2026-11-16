import { PartialType } from '@nestjs/swagger';
import { CreateTremDto } from './create-trem.dto.js';

export class UpdateTremDto extends PartialType(CreateTremDto) { }
