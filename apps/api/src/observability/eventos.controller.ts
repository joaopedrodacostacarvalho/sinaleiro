import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import { AuthService } from '../auth/auth.service.js';
import { UsuariosService } from '../usuarios/usuarios.service.js';
import { RegistrarEventosDto } from './dto/registrar-eventos.dto.js';
import { Evento } from './entities/observability.entity.js';

@ApiTags('observability')
@Controller({ path: 'eventos', version: '1' })
export class EventosController {
  constructor(
    @InjectRepository(Evento)
    private readonly eventoRepo: Repository<Evento>,
    private readonly authService: AuthService,
    private readonly usuariosService: UsuariosService,
  ) { }

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Registra lote de eventos de uso, Web Vitals e viabilidade (NPS)' })
  async registrar(@Body() dto: RegistrarEventosDto, @Req() req: Request) {
    let usuarioId: string | null = null;
    const authHeader = req.headers.authorization;

    if (authHeader?.startsWith('Bearer ')) {
      try {
        const decoded = await this.authService.verifyToken(authHeader.slice(7));
        const usuario = await this.usuariosService.findOrCreateFromFirebase(decoded);
        usuarioId = usuario.id;
      } catch {
        // Telemetria anônima permitida antes do login (ex.: map_viewed, LCP/INP/CLS)
      }
    }

    const registros = dto.eventos.map((ev) =>
      this.eventoRepo.create({
        usuario_id: usuarioId,
        sessao_id: ev.sessao_id ?? null,
        categoria: ev.categoria,
        nome: ev.nome,
        propriedades: ev.propriedades ?? {},
      }),
    );

    await this.eventoRepo.save(registros);
    return { aceitos: registros.length };
  }
}
