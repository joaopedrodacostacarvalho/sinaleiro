import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import {
  StatusEstacao,
  StatusLinha,
  StatusTrem,
} from '@sinaleiro/types/enums';

export class UpdateReporteDto {
  @ApiPropertyOptional({ enum: StatusEstacao })
  @IsOptional()
  @IsEnum(StatusEstacao)
  status_estacao?: StatusEstacao;

  @ApiPropertyOptional({ enum: StatusLinha })
  @IsOptional()
  @IsEnum(StatusLinha)
  status_linha?: StatusLinha;

  @ApiPropertyOptional({ enum: StatusTrem })
  @IsOptional()
  @IsEnum(StatusTrem)
  status_trem?: StatusTrem;
}
