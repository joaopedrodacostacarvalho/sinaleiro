import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Sentido } from '@sinaleiro/types/enums';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateTremDto {
  @ApiProperty({
    description: 'ID da linha em que o trem está operando',
    example: 1,
  })
  @IsInt()
  @Min(1)
  linha_id: number;

  @ApiProperty({
    description: 'Sentido da viagem (terminal de destino)',
    enum: Sentido,
    example: Sentido.RECIFE,
  })
  @IsEnum(Sentido)
  sentido: Sentido;

  @ApiPropertyOptional({
    description: 'Identificador dos vagões (opcional, texto livre)',
    example: 'TUE 101',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  id_vagao?: string;
}
