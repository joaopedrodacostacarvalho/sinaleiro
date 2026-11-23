import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class CreateCustomTokenDto {
  @ApiProperty({
    description: 'UID do usuário no Firebase Authentication para emissão de token local',
    example: 'dev-user-01',
    maxLength: 128,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  uid: string;
}
