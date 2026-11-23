import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { TipoConfirmacao, TipoReporte } from '@sinaleiro/types/enums';

import { Reporte } from './entities/reporte.entity.js';
import { ConfirmacaoReporte } from './entities/confirmacao-reporte.entity/confirmacao-reporte.entity.js';
import { Estacao } from '../estacoes/entities/estacao.entity.js';
import { Usuario } from '../usuarios/entities/usuario.entity.js';
import { ReputacaoService } from '../reputacao/reputacao.service.js';
import { StatusService } from './status.service.js';
import { Coordenada, haversineMetros } from '../common/geo/haversine.js';
import {
  decidirReporte,
  DecisaoReporte,
  efeitoReputacao,
} from './confirmacoes.regras.js';

const RAIO_CONFIRMACAO_METROS = 2_000;
const MAX_CONFIANCA_INICIAL = 30;

export interface ConfirmacaoResultado {
  reporte: Reporte;
  reputacao_usuario: number;
  decisao: DecisaoReporte;
}

@Injectable()
export class ConfirmacoesService {
  constructor(
    @InjectRepository(Reporte)
    private readonly reporteRepo: Repository<Reporte>,
    @InjectRepository(ConfirmacaoReporte)
    private readonly confirmacaoRepo: Repository<ConfirmacaoReporte>,
    @InjectRepository(Estacao)
    private readonly estacaoRepo: Repository<Estacao>,
    private readonly reputacaoService: ReputacaoService,
    @Optional()
    private readonly statusService?: StatusService,
  ) { }

  async confirmar(
    reporteId: string,
    tipo: TipoConfirmacao,
    usuario: Usuario,
    coords: Coordenada | null = null,
  ): Promise<ConfirmacaoResultado> {
    const reporte = await this.reporteRepo.findOne({
      where: { id: reporteId },
      relations: { estacao: true },
    });

    if (!reporte) {
      throw new NotFoundException('Reporte não encontrado');
    }

    // Regra 4.1.1 — Autor não pode confirmar/discordar do próprio reporte
    if (reporte.usuario_id === usuario.id) {
      throw new BadRequestException(
        'O autor não pode confirmar ou discordar do próprio reporte',
      );
    }

    // Regra 4.1.3 — Reporte precisa estar ativo e não expirado
    const agora = new Date();
    if (!reporte.ativo || new Date(reporte.data_hora_expiracao) <= agora) {
      throw new BadRequestException('Este reporte já expirou ou está inativo');
    }

    // Regra 4.1.2 — Idempotência por (reporte_id, usuario_id)
    const existente = await this.confirmacaoRepo.findOne({
      where: { reporte_id: reporteId, usuario_id: usuario.id },
    });
    if (existente) {
      throw new ConflictException('Você já avaliou este reporte');
    }

    // Regra 4.1.4 — Restrição geográfica para ESTACAO e TREM (≤ 2 km)
    if (
      coords !== null &&
      (reporte.tipo === TipoReporte.ESTACAO || reporte.tipo === TipoReporte.TREM)
    ) {
      const coordEstacao = await this.resolverCoordenadaEstacao(reporte);
      if (coordEstacao) {
        const distancia = haversineMetros(coords, coordEstacao);
        if (distancia > RAIO_CONFIRMACAO_METROS) {
          throw new BadRequestException(
            'Você está a mais de 2 km da estação deste reporte',
          );
        }
      }
    }

    const pesoUsuario = this.reputacaoService.getPeso(usuario.reputacao);

    const executarTransacao = async (
      rRepo: Pick<Repository<Reporte>, 'save'>,
      cRepo: Pick<Repository<ConfirmacaoReporte>, 'create' | 'save' | 'find'>,
      manager?: EntityManager,
    ): Promise<ConfirmacaoResultado> => {
      const novaConfirmacao = cRepo.create({
        reporte_id: reporteId,
        usuario_id: usuario.id,
        tipo,
        peso: pesoUsuario,
        data_hora: agora,
      });
      await cRepo.save(novaConfirmacao);

      const todasConfirmacoes = await cRepo.find({
        where: { reporte_id: reporteId },
      });

      const jaIncluiNova = todasConfirmacoes.some(
        (c) => c.usuario_id === usuario.id,
      );
      const listaConsolidada = jaIncluiNova
        ? todasConfirmacoes
        : [...todasConfirmacoes, novaConfirmacao];

      const { decisao, wConfirm } = decidirReporte(reporte, listaConsolidada);

      // Regra 2.2.1 — Ajuste de reputação aplicado uma única vez por reporte
      const jaAplicouReputacao =
        Boolean(reporte.reputacao_aplicada) ||
        reporte.confianca > MAX_CONFIANCA_INICIAL;

      if (decisao === 'CONFIRMADO') {
        reporte.ativo = true;
        reporte.confianca = Math.max(
          reporte.confianca,
          Math.min(100, Math.round(wConfirm * 10)),
        );
      } else if (decisao === 'REFUTADO') {
        reporte.ativo = false;
      }

      let reputacaoUsuario = usuario.reputacao;

      if (
        !jaAplicouReputacao &&
        (decisao === 'CONFIRMADO' || decisao === 'REFUTADO')
      ) {
        reporte.reputacao_aplicada = true;
        const efeitos = efeitoReputacao(reporte, decisao, listaConsolidada);

        for (const efeito of efeitos) {
          const atualizado = manager
            ? await this.reputacaoService.aplicarEvento(
              efeito.usuarioId,
              efeito.evento,
              manager,
            )
            : await this.reputacaoService.aplicarEvento(
              efeito.usuarioId,
              efeito.evento,
            );

          if (atualizado && efeito.usuarioId === usuario.id) {
            reputacaoUsuario = atualizado.reputacao;
          }
        }
      }

      const reporteSalvo = await rRepo.save(reporte);

      // Regra 5.4.2 — Invalida cache ao cruzar limiar CONFIRMADO/REFUTADO
      if (decisao === 'CONFIRMADO' || decisao === 'REFUTADO') {
        await this.statusService?.invalidarAlvo?.(reporteSalvo);
      }

      return {
        reporte: reporteSalvo,
        reputacao_usuario: reputacaoUsuario,
        decisao,
      };
    };

    if (typeof this.reporteRepo.manager?.transaction === 'function') {
      return this.reporteRepo.manager.transaction((manager) =>
        executarTransacao(
          manager.getRepository(Reporte),
          manager.getRepository(ConfirmacaoReporte),
          manager,
        ),
      );
    }

    return executarTransacao(this.reporteRepo, this.confirmacaoRepo);
  }

  private async resolverCoordenadaEstacao(
    reporte: Reporte,
  ): Promise<Coordenada | null> {
    if (reporte.estacao) {
      return {
        lat: Number(reporte.estacao.latitude),
        lng: Number(reporte.estacao.longitude),
      };
    }

    if (reporte.estacao_id == null) {
      return null;
    }

    const estacao = await this.estacaoRepo.findOne({
      where: { id: reporte.estacao_id },
    });
    if (!estacao) {
      return null;
    }

    return {
      lat: Number(estacao.latitude),
      lng: Number(estacao.longitude),
    };
  }
}
