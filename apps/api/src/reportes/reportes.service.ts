import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import {
  FindOptionsWhere,
  LessThanOrEqual,
  MoreThan,
  Repository,
} from 'typeorm';
import type { MapaStreamPayload } from '@sinaleiro/types';
import {
  StatusEstacao,
  TipoConfirmacao,
  TipoReporte,
} from '@sinaleiro/types/enums';

import { CreateReporteDto } from './dto/create-reporte.dto.js';
import { UpdateReporteDto } from './dto/update-reporte.dto.js';
import { Reporte } from './entities/reporte.entity.js';
import { ConfirmacaoReporte } from './entities/confirmacao-reporte.entity/confirmacao-reporte.entity.js';
import { Estacao } from '../estacoes/entities/estacao.entity.js';
import { Trem } from '../trens/entities/trem.entity.js';
import { Usuario } from '../usuarios/entities/usuario.entity.js';
import { ReputacaoService } from '../reputacao/reputacao.service.js';
import { StatusService } from './status.service.js';
import { TrensService } from '../trens/trens.service.js';
import { haversineMetros } from '../common/geo/haversine.js';
import {
  assertAlvoCoerente,
  calcularConfiancaInicialComPeso,
  calcularExpiracao,
  isDuplicata,
} from './reportes.regras.js';

const LIMITE_REPORTES_POR_HORA = 10;
const COOLDOWN_REFUTACAO_MS = 15 * 60_000;
const PESO_SUSPEITO = 0.5;

@Injectable()
export class ReportesService {
  constructor(
    @InjectRepository(Reporte)
    private readonly reporteRepo: Repository<Reporte>,
    @InjectRepository(Estacao)
    private readonly estacaoRepo: Repository<Estacao>,
    private readonly reputacaoService: ReputacaoService,
    @Optional()
    private readonly statusService?: StatusService,
    @Optional()
    @InjectRepository(ConfirmacaoReporte)
    private readonly confirmacaoRepo?: Repository<ConfirmacaoReporte>,
    @Optional()
    private readonly trensService?: TrensService,
    @Optional()
    @InjectRepository(Trem)
    private readonly tremRepo?: Repository<Trem>,
    @Optional()
    private readonly eventEmitter?: EventEmitter2,
  ) { }

  async create(dto: CreateReporteDto, autor: Usuario): Promise<Reporte> {
    // Regra 3.1 — Validação cruzada de alvo coerente
    assertAlvoCoerente(dto);

    const agora = new Date();

    // Regra 3.2.2 — Rate limit por usuário (máx. 10 reportes/hora)
    const umaHoraAtras = new Date(agora.getTime() - 60 * 60_000);
    const qtdUltimaHora = await this.reporteRepo.count({
      where: {
        usuario_id: autor.id,
        data_hora_criacao: MoreThan(umaHoraAtras),
      },
    });
    if (qtdUltimaHora >= LIMITE_REPORTES_POR_HORA) {
      throw new HttpException(
        'Limite de 10 reportes por hora atingido',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Valida existência e coerência da estação quando estacao_id for informado
    let estacaoAlvo: Estacao | null = null;
    if (dto.estacao_id != null) {
      estacaoAlvo = await this.estacaoRepo.findOne({
        where: { id: dto.estacao_id },
      });
      if (!estacaoAlvo) {
        throw new NotFoundException(`Estação #${dto.estacao_id} não encontrada`);
      }
      if (
        dto.tipo === TipoReporte.TREM &&
        dto.linha_id != null &&
        estacaoAlvo.linha_id !== dto.linha_id
      ) {
        throw new BadRequestException(
          'A estação informada não pertence à linha selecionada para o trem',
        );
      }
    }

    // Decisão Seção 11 — Estação FECHADA bloqueia novos reportes de TREM
    if (
      dto.tipo === TipoReporte.TREM &&
      dto.estacao_id != null &&
      this.statusService
    ) {
      const statusEstacao = await this.statusService.getStatusEstacao(
        dto.estacao_id,
      );
      if (statusEstacao.status === StatusEstacao.FECHADA) {
        throw new ForbiddenException(
          'Não é possível reportar trem em uma estação fechada',
        );
      }
    }

    // Regra 7.1 — Resolve o trem com id_vagao normalizado (sem mutar posição antes do check de duplicata)
    const idVagaoNormalizado = dto.id_vagao?.trim() || undefined;
    let tremResolvido: Trem | null = null;
    let tremId: string | null = null;

    if (dto.tipo === TipoReporte.TREM) {
      if (!this.trensService) {
        throw new BadRequestException('TrensService não disponível');
      }

      const linhaIdEfetiva = dto.linha_id ?? estacaoAlvo?.linha_id;
      if (linhaIdEfetiva == null) {
        throw new BadRequestException(
          'Informe a linha ou a estação onde o trem foi avistado',
        );
      }

      tremResolvido = await this.trensService.resolverTrem(
        linhaIdEfetiva,
        dto.sentido!,
        idVagaoNormalizado,
        autor,
      );
      tremId = tremResolvido.id;
    }

    // Busca reporte ativo existente do mesmo alvo + status (Regras 3.2.1 e 3.3.3)
    const existente = await this.reporteRepo.findOne({
      where: this.buildWhereMesmoAlvoEStatus(dto, agora, tremId),
      order: { data_hora_criacao: 'DESC' },
    });

    if (
      existente &&
      existente.ativo &&
      new Date(existente.data_hora_expiracao).getTime() > agora.getTime()
    ) {
      // Regra 3.2.1 — Anti-duplicata pelo mesmo autor dentro de 5 min
      if (existente.usuario_id === autor.id && isDuplicata(existente, agora)) {
        throw new ConflictException({
          message: 'Você já criou um reporte idêntico nos últimos 5 minutos',
          reporte: existente,
        });
      }

      // Regra 3.3.3 — Renovação por reconfirmação (outro usuário)
      if (existente.usuario_id !== autor.id) {
        const novaExpiracao = calcularExpiracao(dto.tipo, agora);
        const expiracaoEstendida = new Date(
          Math.max(
            new Date(existente.data_hora_expiracao).getTime(),
            novaExpiracao.getTime(),
          ),
        );

        const pesoAutor = this.reputacaoService.getPeso(autor.reputacao);

        if (this.confirmacaoRepo) {
          const jaConfirmou = await this.confirmacaoRepo.findOne({
            where: { reporte_id: existente.id, usuario_id: autor.id },
          });
          if (!jaConfirmou) {
            const confirmacao = this.confirmacaoRepo.create({
              reporte_id: existente.id,
              usuario_id: autor.id,
              tipo: TipoConfirmacao.CONFIRMAR,
              peso: pesoAutor,
              data_hora: agora,
            });
            await this.confirmacaoRepo.save(confirmacao);
          }
        }

        const renovado = await this.reporteRepo.save(
          Object.assign({} as Reporte, existente, {
            data_hora_expiracao: expiracaoEstendida,
          }),
        );

        if (dto.tipo === TipoReporte.TREM && tremResolvido && estacaoAlvo) {
          await this.registrarAvistamentoTrem(
            tremResolvido,
            estacaoAlvo,
            dto,
            agora,
          );
        }

        await this.statusService?.invalidarAlvo?.(renovado);
        this.emitirAtualizacaoMapa('reporte_confirmado');
        return renovado;
      }
    }

    // Regra 3.2.3 — Cooldown após refutação (< 15 min com confiança <= 0 força peso 0.5)
    const quinzeMinAtras = new Date(agora.getTime() - COOLDOWN_REFUTACAO_MS);
    const ultimoRefutado = await this.reporteRepo.findOne({
      where: {
        usuario_id: autor.id,
        ativo: false,
        confianca: LessThanOrEqual(0),
        data_hora_criacao: MoreThan(quinzeMinAtras),
      },
      order: { data_hora_criacao: 'DESC' },
    });

    const emCooldownRefutacao =
      ultimoRefutado != null &&
      ultimoRefutado.ativo === false &&
      ultimoRefutado.confianca <= 0 &&
      agora.getTime() - new Date(ultimoRefutado.data_hora_criacao).getTime() <
      COOLDOWN_REFUTACAO_MS;

    const pesoEfetivo = emCooldownRefutacao
      ? PESO_SUSPEITO
      : this.reputacaoService.getPeso(autor.reputacao);

    // Regra 3.2.5 — Verificação de localização soft (≤ 2 km da estação ou da linha)
    const distanciaMetros = await this.calcularDistanciaAlvoMetros(
      dto,
      estacaoAlvo,
    );

    // Regra 3.2.4 — Confiança inicial calculada pelo backend
    const confianca = calcularConfiancaInicialComPeso(
      pesoEfetivo,
      distanciaMetros,
    );

    // Garante cumprimento estrito da check constraint reporte_alvo_unico
    const reporte = this.reporteRepo.create({
      tipo: dto.tipo,
      usuario_id: autor.id,
      estacao_id:
        dto.tipo === TipoReporte.ESTACAO || dto.tipo === TipoReporte.TREM
          ? (dto.estacao_id ?? null)
          : null,
      linha_id: dto.tipo === TipoReporte.LINHA ? (dto.linha_id ?? null) : null,
      trem_id: dto.tipo === TipoReporte.TREM ? tremId : null,
      status_estacao:
        dto.tipo === TipoReporte.ESTACAO ? (dto.status_estacao ?? null) : null,
      status_linha:
        dto.tipo === TipoReporte.LINHA ? (dto.status_linha ?? null) : null,
      status_trem:
        dto.tipo === TipoReporte.TREM ? (dto.status_trem ?? null) : null,
      data_hora_criacao: agora,
      data_hora_expiracao: calcularExpiracao(dto.tipo, agora),
      confianca,
      ativo: true,
      reputacao_aplicada: false,
    });

    const salvo = await this.reporteRepo.save(reporte);

    // Atualiza posição e horário do avistamento após validação anti-duplicata
    if (dto.tipo === TipoReporte.TREM && tremResolvido && estacaoAlvo) {
      await this.registrarAvistamentoTrem(
        tremResolvido,
        estacaoAlvo,
        dto,
        agora,
      );
    }

    await this.statusService?.invalidarAlvo?.(salvo);
    this.emitirAtualizacaoMapa(
      dto.tipo === TipoReporte.TREM ? 'trem_avistado' : 'reporte_criado',
    );
    return salvo;
  }

  async findAll(alvo?: string, id?: string): Promise<Reporte[]> {
    const agora = new Date();
    const where: FindOptionsWhere<Reporte> = {
      ativo: true,
      data_hora_expiracao: MoreThan(agora),
    };

    if (alvo && id) {
      const alvoNormalizado = alvo.toUpperCase();
      if (alvoNormalizado === TipoReporte.ESTACAO) {
        where.tipo = TipoReporte.ESTACAO;
        where.estacao_id = Number(id);
      } else if (alvoNormalizado === TipoReporte.LINHA) {
        where.tipo = TipoReporte.LINHA;
        where.linha_id = Number(id);
      } else if (alvoNormalizado === TipoReporte.TREM) {
        where.tipo = TipoReporte.TREM;
        where.trem_id = id;
      }
    }

    return this.reporteRepo.find({
      where,
      order: { data_hora_criacao: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Reporte> {
    const reporte = await this.reporteRepo.findOne({
      where: { id },
      relations: { confirmacoes: true },
    });
    if (!reporte) {
      throw new NotFoundException(`Reporte #${id} não encontrado`);
    }
    return reporte;
  }

  async update(
    id: string,
    updateReporteDto: UpdateReporteDto,
    autor: Usuario,
  ): Promise<Reporte> {
    const reporte = await this.findOne(id);

    if (reporte.usuario_id !== autor.id) {
      throw new ForbiddenException(
        'Você só pode editar reportes criados por você',
      );
    }

    if (!reporte.ativo) {
      throw new BadRequestException(
        'Não é possível editar um reporte já encerrado ou expirado',
      );
    }

    const { status_estacao, status_linha, status_trem } = updateReporteDto;
    if (
      status_estacao === undefined &&
      status_linha === undefined &&
      status_trem === undefined
    ) {
      throw new BadRequestException(
        'Informe o novo status para atualizar o reporte',
      );
    }

    if (reporte.tipo === TipoReporte.ESTACAO) {
      if (status_linha !== undefined || status_trem !== undefined) {
        throw new BadRequestException(
          'Reporte de estação aceita apenas status_estacao',
        );
      }
      reporte.status_estacao = status_estacao!;
    } else if (reporte.tipo === TipoReporte.LINHA) {
      if (status_estacao !== undefined || status_trem !== undefined) {
        throw new BadRequestException(
          'Reporte de linha aceita apenas status_linha',
        );
      }
      reporte.status_linha = status_linha!;
    } else if (reporte.tipo === TipoReporte.TREM) {
      if (status_estacao !== undefined || status_linha !== undefined) {
        throw new BadRequestException(
          'Reporte de trem aceita apenas status_trem',
        );
      }
      reporte.status_trem = status_trem!;
    }

    const salvo = await this.reporteRepo.save(reporte);
    await this.statusService?.invalidarAlvo?.(salvo);
    this.emitirAtualizacaoMapa('reporte_criado');
    return salvo;
  }

  async remove(id: string, autor: Usuario): Promise<void> {
    const reporte = await this.findOne(id);

    if (reporte.usuario_id !== autor.id) {
      throw new ForbiddenException(
        'Você só pode excluir reportes criados por você',
      );
    }

    await this.reporteRepo.remove(reporte);
    await this.statusService?.invalidarAlvo?.(reporte);
    this.emitirAtualizacaoMapa('reporte_criado');
  }

  private async calcularDistanciaAlvoMetros(
    dto: CreateReporteDto,
    estacaoAlvo: Estacao | null,
  ): Promise<number | null> {
    if (dto.latitude == null || dto.longitude == null) {
      return null;
    }

    if (estacaoAlvo) {
      return haversineMetros(
        { lat: dto.latitude, lng: dto.longitude },
        {
          lat: Number(estacaoAlvo.latitude),
          lng: Number(estacaoAlvo.longitude),
        },
      );
    }

    if (dto.tipo === TipoReporte.LINHA && dto.linha_id != null) {
      const estacoesLinha = await this.estacaoRepo.find({
        where: { linha_id: dto.linha_id },
      });
      if (estacoesLinha.length > 0) {
        return Math.min(
          ...estacoesLinha.map((est) =>
            haversineMetros(
              { lat: dto.latitude!, lng: dto.longitude! },
              { lat: Number(est.latitude), lng: Number(est.longitude) },
            ),
          ),
        );
      }
    }

    return null;
  }

  private async registrarAvistamentoTrem(
    trem: Trem,
    estacaoAlvo: Estacao,
    dto: CreateReporteDto,
    agora: Date,
  ): Promise<void> {
    if (!this.tremRepo) return;

    const offsetMs = (dto.offset_minutos ?? 0) * 60_000;
    const horarioAvistamento = new Date(agora.getTime() - offsetMs);

    await this.tremRepo.save(
      Object.assign({} as Trem, trem, {
        estacao_atual_id: estacaoAlvo.id,
        latitude: estacaoAlvo.latitude,
        longitude: estacaoAlvo.longitude,
        ultimo_avistamento_em: horarioAvistamento,
      }),
    );
  }

  private emitirAtualizacaoMapa(
    origem: NonNullable<MapaStreamPayload['origem']>,
  ): void {
    this.eventEmitter?.emit('mapa.atualizado', {
      tipo: 'mapa_atualizado',
      origem,
      timestamp: new Date().toISOString(),
    } satisfies MapaStreamPayload);
  }

  private buildWhereMesmoAlvoEStatus(
    dto: CreateReporteDto,
    agora: Date,
    tremId: string | null,
  ): FindOptionsWhere<Reporte> {
    const base: FindOptionsWhere<Reporte> = {
      tipo: dto.tipo,
      ativo: true,
      data_hora_expiracao: MoreThan(agora),
    };

    if (dto.tipo === TipoReporte.ESTACAO) {
      return {
        ...base,
        estacao_id: dto.estacao_id,
        status_estacao: dto.status_estacao,
      };
    }

    if (dto.tipo === TipoReporte.LINHA) {
      return {
        ...base,
        linha_id: dto.linha_id,
        status_linha: dto.status_linha,
      };
    }

    return {
      ...base,
      trem_id: tremId ?? undefined,
      status_trem: dto.status_trem,
    };
  }
}
