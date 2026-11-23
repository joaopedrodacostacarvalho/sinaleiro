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
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, MoreThan, Repository } from 'typeorm';
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

    // Regra 7.1 — Heurística de matching de trem
    let tremId: string | null = null;
    if (dto.tipo === TipoReporte.TREM) {
      if (!this.trensService) {
        throw new BadRequestException('TrensService não disponível');
      }
      const trem = await this.trensService.resolverTrem(
        dto.linha_id!,
        dto.sentido!,
        dto.id_vagao,
        autor,
      );
      tremId = trem.id;
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
          message:
            'Você já criou um reporte idêntico nos últimos 5 minutos',
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

        await this.statusService?.invalidarAlvo?.(renovado);
        return renovado;
      }
    }

    // Regra 3.2.3 — Cooldown após refutação (< 15 min força peso 0.5)
    const quinzeMinAtras = new Date(agora.getTime() - COOLDOWN_REFUTACAO_MS);
    const ultimoRefutado = await this.reporteRepo.findOne({
      where: {
        usuario_id: autor.id,
        ativo: false,
        data_hora_criacao: MoreThan(quinzeMinAtras),
      },
      order: { data_hora_criacao: 'DESC' },
    });

    const emCooldownRefutacao =
      ultimoRefutado != null &&
      ultimoRefutado.ativo === false &&
      agora.getTime() - new Date(ultimoRefutado.data_hora_criacao).getTime() <
      COOLDOWN_REFUTACAO_MS;

    const pesoEfetivo = emCooldownRefutacao
      ? PESO_SUSPEITO
      : this.reputacaoService.getPeso(autor.reputacao);

    // Regra 3.2.5 — Verificação de localização soft (≤ 2 km da estação)
    let distanciaMetros: number | null = null;
    if (
      dto.latitude != null &&
      dto.longitude != null &&
      dto.estacao_id != null
    ) {
      const estacao = await this.estacaoRepo.findOne({
        where: { id: dto.estacao_id },
      });
      if (estacao) {
        distanciaMetros = haversineMetros(
          { lat: dto.latitude, lng: dto.longitude },
          { lat: Number(estacao.latitude), lng: Number(estacao.longitude) },
        );
      }
    }

    // Regra 3.2.4 — Confiança inicial calculada pelo backend
    const confianca = calcularConfiancaInicialComPeso(
      pesoEfetivo,
      distanciaMetros,
    );

    const reporte = this.reporteRepo.create({
      tipo: dto.tipo,
      usuario_id: autor.id,
      estacao_id: dto.estacao_id ?? null,
      linha_id: dto.tipo === TipoReporte.LINHA ? (dto.linha_id ?? null) : null,
      trem_id: tremId,
      status_estacao: dto.status_estacao ?? null,
      status_linha: dto.status_linha ?? null,
      status_trem: dto.status_trem ?? null,
      data_hora_criacao: agora,
      data_hora_expiracao: calcularExpiracao(dto.tipo, agora),
      confianca,
      ativo: true,
      reputacao_aplicada: false,
    });

    const salvo = await this.reporteRepo.save(reporte);
    await this.statusService?.invalidarAlvo?.(salvo);
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

  async update(id: string, updateReporteDto: UpdateReporteDto): Promise<Reporte> {
    const reporte = await this.findOne(id);
    Object.assign(reporte, updateReporteDto);
    const salvo = await this.reporteRepo.save(reporte);
    await this.statusService?.invalidarAlvo?.(salvo);
    return salvo;
  }

  async remove(id: string): Promise<void> {
    const reporte = await this.findOne(id);
    await this.reporteRepo.remove(reporte);
    await this.statusService?.invalidarAlvo?.(reporte);
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
