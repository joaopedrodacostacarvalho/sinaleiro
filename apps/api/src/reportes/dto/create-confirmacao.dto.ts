import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipoConfirmacao } from '@sinaleiro/types/enums';
import { IsEnum, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class CreateConfirmacaoDto {
  @ApiProperty({ enum: TipoConfirmacao, example: TipoConfirmacao.CONFIRMAR })
  @IsEnum(TipoConfirmacao)
  tipo: TipoConfirmacao;

  @ApiPropertyOptional({
    description: 'Latitude atual do usuário (obrigatória para validar raio de 2 km em ESTACAO/TREM)',
    example: -8.067794,
  })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({
    description: 'Longitude atual do usuário (obrigatória para validar raio de 2 km em ESTACAO/TREM)',
    example: -34.885139,
  })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}
