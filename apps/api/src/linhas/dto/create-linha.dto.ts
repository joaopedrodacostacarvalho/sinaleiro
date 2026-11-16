import { ApiProperty } from "@nestjs/swagger";
import { IsHexColor, IsNotEmpty, IsString, MaxLength } from "class-validator";

export class CreateLinhaDto {
  @ApiProperty({
    description: 'Nome da linha',
    example: 'Linha Centro - Ramal Camaragibe',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  nome: string;

  @ApiProperty({
    description: 'Cor da linha em hexadecimal',
    example: '#E31C32'
  })
  @IsHexColor()
  cor: string;
}
