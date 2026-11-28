import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
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
@UseGuards(FirebaseAuthGuard)
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) { }

  @Get('me')
  getMe(@CurrentUser() usuario: Usuario): Usuario {
    return usuario;
  }

  @Patch('me')
  updateMe(
    @CurrentUser('id') id: string,
    @Body() updateMeDto: UpdateMeDto,
  ): Promise<Usuario> {
    return this.usuariosService.updateMe(id, updateMeDto);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMe(@CurrentUser('id') id: string): Promise<void> {
    await this.usuariosService.remove(id);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const usuario = await this.usuariosService.findOne(id);
    return {
      id: usuario.id,
      nome: usuario.nome,
      reputacao: usuario.reputacao,
      data_cadastro: usuario.data_cadastro,
    };
  }
}
