import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  StatusEstacao,
  StatusLinha,
  StatusTrem,
  TipoReporte,
} from '@sinaleiro/types/enums';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateReporteDto {
  @ApiProperty({
    description: 'Tipo de alvo do reporte',
    enum: TipoReporte,
    example: TipoReporte.ESTACAO,
  })
  @IsEnum(TipoReporte)
  tipo: TipoReporte;

  @ApiPropertyOptional({
    description: 'ID do trem (obrigatório se tipo = TREM)',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  trem_id?: string;

  @ApiPropertyOptional({
    description:
      'ID da estação (obrigatório se tipo = ESTACAO ou TREM — local do avistamento)',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  estacao_id?: number;

  @ApiPropertyOptional({
    description: 'ID da linha (obrigatório se tipo = LINHA)',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  linha_id?: number;

  @ApiPropertyOptional({
    description: 'Status da estação (obrigatório se tipo = ESTACAO)',
    enum: StatusEstacao,
  })
  @IsOptional()
  @IsEnum(StatusEstacao)
  status_estacao?: StatusEstacao;

  @ApiPropertyOptional({
    description: 'Status da linha (obrigatório se tipo = LINHA)',
    enum: StatusLinha,
  })
  @IsOptional()
  @IsEnum(StatusLinha)
  status_linha?: StatusLinha;

  @ApiPropertyOptional({
    description: 'Status do trem (obrigatório se tipo = TREM)',
    enum: StatusTrem,
  })
  @IsOptional()
  @IsEnum(StatusTrem)
  status_trem?: StatusTrem;

  @ApiPropertyOptional({
    description: 'Confiança inicial do reporte (0–100)',
    example: 1,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  confianca?: number;
}
