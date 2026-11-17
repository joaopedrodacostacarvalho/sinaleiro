import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsLatitude, IsLongitude, IsNotEmpty, IsString, MaxLength, Min } from "class-validator";

export class CreateEstacaoDto {
  @ApiProperty({
    description: 'Nome da estação',
    example: 'Recife',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  nome: string;

  @ApiProperty({
    description: 'Latitude da estação (graus decimais)',
    example: -8.067794,
  })
  @IsLatitude()
  latitude: number;

  @ApiProperty({
    description: 'Longitude da estação (graus decimais)',
    example: -34.885139,
  })
  @IsLongitude()
  longitude: number;

  @ApiProperty({
    description: 'ID da Linha à qual a estação pertence',
    example: 1
  })
  @IsInt()
  @Min(1)
  linha_id: number;
}
