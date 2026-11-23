import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { EventoReputacao } from '@sinaleiro/types/enums';

import { Usuario } from '../usuarios/entities/usuario.entity.js';
import { getPeso, PISO_REPUTACAO } from './reputacao.regras.js';

const DELTAS: Record<EventoReputacao, number> = {
  [EventoReputacao.REPORTE_CONFIRMADO]: +3,
  [EventoReputacao.REPORTE_REFUTADO]: -5,
  [EventoReputacao.CONFIRMOU_REPORTE_REFUTADO]: -1,
  [EventoReputacao.DISCORDOU_REPORTE_CONFIRMADO]: -2,
};

@Injectable()
export class ReputacaoService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
  ) { }

  getPeso(reputacao: number): number {
    return getPeso(reputacao);
  }

  async aplicarEvento(
    usuarioId: string,
    evento: EventoReputacao,
    manager?: EntityManager,
  ): Promise<Usuario> {
    const repo = manager ? manager.getRepository(Usuario) : this.usuarioRepo;
    const usuario = await repo.findOne({ where: { id: usuarioId } });
    if (!usuario) throw new NotFoundException('Usuário não encontrado');

    const delta = DELTAS[evento];
    usuario.reputacao = Math.max(PISO_REPUTACAO, usuario.reputacao + delta);

    return repo.save(usuario);
  }
}
