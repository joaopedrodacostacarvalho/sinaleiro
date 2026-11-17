import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsuariosService } from './usuarios.service.js';
import { FirebaseAuthGuard } from '../auth/firebase-auth/firebase-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Usuario } from './entities/usuario.entity.js';
import { UpdateMeDto } from './dto/update-me.dto.js';

@ApiTags('usuarios')
@ApiBearerAuth('firebase-auth')
@Controller('usuarios')
@UseGuards(FirebaseAuthGuard)   // guard no controller cobre todas as rotas
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) { }

  /**
   * Retorna o usuário autenticado. Evita round-trip ao banco:
   * o FirebaseAuthGuard já anexou a entidade em `request.user`.
   */
  @Get('me')
  getMe(@CurrentUser() usuario: Usuario): Usuario {
    return usuario;
  }

  /**
   * Atualiza o próprio perfil. O `id` vem do token, nunca do body ou da URL.
   */
  @Patch('me')
  updateMe(
    @CurrentUser('id') id: string,
    @Body() updateMeDto: UpdateMeDto,
  ): Promise<Usuario> {
    return this.usuariosService.updateMe(id, updateMeDto);
  }

  /**
   * Exclusão de conta (LGPD). Retorna 204 sem corpo.
   */
  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMe(@CurrentUser('id') id: string): Promise<void> {
    await this.usuariosService.remove(id);
  }

  /**
   * Consulta pública por ID (mantida). Não permite alteração.
   */
  @Get(':id')
  findOne(@Param('id') id: string): Promise<Usuario> {
    return this.usuariosService.findOne(id);
  }
}
