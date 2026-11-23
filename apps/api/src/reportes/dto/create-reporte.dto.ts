import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Sentido,
  StatusEstacao,
  StatusLinha,
  StatusTrem,
  TipoReporte,
} from '@sinaleiro/types/enums';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
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
    description:
      'ID da estação (obrigatório se tipo = ESTACAO ou TREM — local do avistamento)',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  estacao_id?: number;

  @ApiPropertyOptional({
    description: 'ID da linha (obrigatório se tipo = LINHA ou TREM)',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  linha_id?: number;

  @ApiPropertyOptional({
    description: 'Sentido da viagem (obrigatório se tipo = TREM)',
    enum: Sentido,
    example: Sentido.RECIFE,
  })
  @IsOptional()
  @IsEnum(Sentido)
  sentido?: Sentido;

  @ApiPropertyOptional({
    description: 'Identificador do vagão (opcional se tipo = TREM — match exato)',
    example: 'TUE 101',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  id_vagao?: string;

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
    description: 'Latitude atual do usuário (validação soft de raio de 2 km)',
    example: -8.067794,
  })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({
    description: 'Longitude atual do usuário (validação soft de raio de 2 km)',
    example: -34.885139,
  })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}
