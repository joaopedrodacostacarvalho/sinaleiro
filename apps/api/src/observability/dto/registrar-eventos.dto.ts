import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import type { CategoriaEventoProduto } from '@sinaleiro/types';

export class EventoItemDto {
  @ApiProperty({ example: 'map_viewed' })
  @IsString()
  @MaxLength(80)
  nome!: string;

  @ApiProperty({ enum: ['uso', 'web_vital', 'erro_cliente', 'viabilidade'] })
  @IsIn(['uso', 'web_vital', 'erro_cliente', 'viabilidade'])
  categoria!: CategoriaEventoProduto;

  @ApiPropertyOptional({ example: 'sess_8f92a1b4' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sessao_id?: string;

  @ApiPropertyOptional({ example: { estacao_id: 12, zoom: 14 } })
  @IsOptional()
  @IsObject()
  propriedades?: Record<string, unknown>;
}

export class RegistrarEventosDto {
  @ApiProperty({ type: [EventoItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => EventoItemDto)
  eventos!: EventoItemDto[];
}
