import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Usuario } from "../usuarios/entities/usuario.entity.js";
import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service.js";
import { ReputacaoService } from "../reputacao/reputacao.service.js";
import { CurrentUser } from "./decorators/current-user.decorator.js";
import { FirebaseAuthGuard } from "./firebase-auth/firebase-auth.guard.js";
import { CreateCustomTokenDto } from "./dto/create-custom-token.dto.js";

export interface PerfilAutenticadoResponse {
  usuario: Usuario;
  peso: number;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly reputacaoService: ReputacaoService,
  ) { }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth('firebase-auth')
  @ApiOperation({
    summary: 'Sincroniza o usuário autenticado no Firebase com o PostgreSQL',
  })
  @ApiResponse({
    status: 200,
    description: 'Usuário sincronizado e peso de reputação calculado',
  })
  sync(@CurrentUser() usuario: Usuario): PerfilAutenticadoResponse {
    return {
      usuario,
      peso: this.reputacaoService.getPeso(usuario.reputacao),
    };
  }

  @Get('me')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth('firebase-auth')
  @ApiOperation({
    summary: 'Retorna o perfil e peso de reputação do usuário autenticado',
  })
  @ApiResponse({
    status: 200,
    description: 'Perfil do usuário autenticado',
  })
  me(@CurrentUser() usuario: Usuario): PerfilAutenticadoResponse {
    return {
      usuario,
      peso: this.reputacaoService.getPeso(usuario.reputacao)
    }
  }

  @Post('custom-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Gera um Custom Token do Firebase para testes locais (desabilitado em produção)',
  })
  @ApiResponse({
    status: 200,
    description: 'Custom token gerado com sucesso',
  })
  @ApiResponse({
    status: 403,
    description: 'Endpoint desabilitado em ambiente de produção',
  })
  async createCustomToken(
    @Body() dto: CreateCustomTokenDto,
  ): Promise<{ custom_token: string }> {
    const custom_token = await this.authService.createCustomToken(dto.uid);
    return { custom_token };
  }
} 
