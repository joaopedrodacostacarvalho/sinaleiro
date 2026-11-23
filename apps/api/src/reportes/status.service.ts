import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThan, Repository } from 'typeorm';
import {
  StatusEstacao,
  StatusLinha,
  StatusTrem,
  TipoReporte,
} from '@sinaleiro/types/enums';

import { Reporte } from './entities/reporte.entity.js';
import { Estacao } from '../estacoes/entities/estacao.entity.js';
import { Linha } from '../linhas/entities/linha.entity.js';
import { Trem } from '../trens/entities/trem.entity.js';
import { CacheService } from '../common/cache/cache.service.js';

export interface StatusEstacaoResultado {
  status: StatusEstacao;
  confianca: number;
}

export interface StatusLinhaResultado {
  status: StatusLinha;
  confianca: number;
}

export interface StatusTremResultado {
  status: StatusTrem;
  confianca: number;
  estacao_id: number | null;
  atualizado_em: Date;
}

const TTL_STATUS_MS = 30_000;
const LIMIAR_SOMA_MINIMA = 15; // equivalente a 1.5 na escala de pesos (×10)
const MIN_CONFIANCA_DERIVACAO_LINHA = 20;
const JANELA_TREM_ATIVO_MS = 20 * 60_000;

const GRAVIDADE_ESTACAO: Record<StatusEstacao, number> = {
  [StatusEstacao.PARALISADA]: 5,
  [StatusEstacao.FECHADA]: 4,
  [StatusEstacao.LOTADA]: 3,
  [StatusEstacao.ATENCAO]: 2,
  [StatusEstacao.NORMAL]: 1,
};

const GRAVIDADE_LINHA: Record<StatusLinha, number> = {
  [StatusLinha.PARALISADA]: 3,
  [StatusLinha.ATENCAO]: 2,
  [StatusLinha.NORMAL]: 1,
};

@Injectable()
export class StatusService {
  constructor(
    @InjectRepository(Reporte)
    private readonly reporteRepo: Repository<Reporte>,
    @InjectRepository(Estacao)
    private readonly estacaoRepo: Repository<Estacao>,
    private readonly cache: CacheService,
    @Optional()
    @InjectRepository(Linha)
    private readonly linhaRepo?: Repository<Linha>,
    @Optional()
    @InjectRepository(Trem)
    private readonly tremRepo?: Repository<Trem>,
  ) { }

  async getStatusEstacao(estacaoId: number): Promise<StatusEstacaoResultado> {
    const cacheKey = `status:estacao:${estacaoId}`;
    const cached = await this.cache.get<StatusEstacaoResultado>(cacheKey);
    if (cached) return cached;

    const agora = new Date();
    const reportes = await this.reporteRepo.find({
      where: {
        tipo: TipoReporte.ESTACAO,
        estacao_id: estacaoId,
        ativo: true,
        data_hora_expiracao: MoreThan(agora),
      },
    });

    const ativos = this.filtrarAtivos(reportes, agora).filter(
      (r): r is Reporte & { status_estacao: StatusEstacao } =>
        r.status_estacao != null,
    );

    const resultado = this.agregarStatusEstacao(ativos);
    await this.cache.set(cacheKey, resultado, TTL_STATUS_MS);
    return resultado;
  }

  async getStatusLinha(linhaId: number): Promise<StatusLinhaResultado> {
    const cacheKey = `status:linha:${linhaId}`;
    const cached = await this.cache.get<StatusLinhaResultado>(cacheKey);
    if (cached) return cached;

    const agora = new Date();

    // 1. Reportes explícitos de LINHA têm prioridade (Regra 5.2)
    const reportesLinha = await this.reporteRepo.find({
      where: {
        tipo: TipoReporte.LINHA,
        linha_id: linhaId,
        ativo: true,
        data_hora_expiracao: MoreThan(agora),
      },
    });

    const ativosLinha = this.filtrarAtivos(reportesLinha, agora).filter(
      (r): r is Reporte & { status_linha: StatusLinha } =>
        r.status_linha != null,
    );

    if (ativosLinha.length > 0) {
      const resultado = this.agregarStatusLinha(ativosLinha);
      await this.cache.set(cacheKey, resultado, TTL_STATUS_MS);
      return resultado;
    }

    // 2. Derivação a partir das estações da linha (Regras 5.2 e 5.2.1)
    const estacoes = await this.estacaoRepo.find({
      where: { linha_id: linhaId },
    });

    const reportesEstacoes =
      estacoes.length > 0
        ? await this.reporteRepo.find({
          where: {
            tipo: TipoReporte.ESTACAO,
            estacao_id: In(estacoes.map((e) => e.id)),
            ativo: true,
            data_hora_expiracao: MoreThan(agora),
          },
        })
        : await this.reporteRepo.find({
          where: {
            tipo: TipoReporte.ESTACAO,
            ativo: true,
            data_hora_expiracao: MoreThan(agora),
            estacao: { linha_id: linhaId },
          },
        });

    const ativosEstacoes = this.filtrarAtivos(reportesEstacoes, agora).filter(
      (r): r is Reporte & { status_estacao: StatusEstacao } =>
        r.status_estacao != null,
    );

    const porEstacao = new Map<
      number,
      Array<Reporte & { status_estacao: StatusEstacao }>
    >();
    for (const r of ativosEstacoes) {
      if (r.estacao_id == null) continue;
      const lista = porEstacao.get(r.estacao_id) ?? [];
      lista.push(r);
      porEstacao.set(r.estacao_id, lista);
    }

    let qtdParalisadas = 0;
    let qtdAtencao = 0;
    let somaConfiancaCritica = 0;
    let countCritica = 0;

    for (const reps of porEstacao.values()) {
      const statusEfetivo = this.agregarStatusEstacao(reps);
      // Regra 5.2.1 — Ignora estações com confiança < 20
      if (statusEfetivo.confianca < MIN_CONFIANCA_DERIVACAO_LINHA) {
        continue;
      }

      if (statusEfetivo.status === StatusEstacao.PARALISADA) {
        qtdParalisadas += 1;
        somaConfiancaCritica += statusEfetivo.confianca;
        countCritica += 1;
      } else if (
        statusEfetivo.status === StatusEstacao.ATENCAO ||
        statusEfetivo.status === StatusEstacao.FECHADA ||
        statusEfetivo.status === StatusEstacao.LOTADA
      ) {
        if (statusEfetivo.status === StatusEstacao.ATENCAO) {
          qtdAtencao += 1;
          somaConfiancaCritica += statusEfetivo.confianca;
          countCritica += 1;
        }
      }
    }

    let resultado: StatusLinhaResultado;
    if (qtdParalisadas >= 2) {
      resultado = {
        status: StatusLinha.PARALISADA,
        confianca: Math.min(100, Math.round(somaConfiancaCritica / countCritica)),
      };
    } else if (qtdParalisadas >= 1 || qtdAtencao >= 2) {
      resultado = {
        status: StatusLinha.ATENCAO,
        confianca: Math.min(100, Math.round(somaConfiancaCritica / countCritica)),
      };
    } else {
      resultado = { status: StatusLinha.NORMAL, confianca: 0 };
    }

    await this.cache.set(cacheKey, resultado, TTL_STATUS_MS);
    return resultado;
  }

  async getStatusTrem(tremId: string): Promise<StatusTremResultado | null> {
    const cacheKey = `status:trem:${tremId}`;
    const cached = await this.cache.get<StatusTremResultado | null>(cacheKey);
    if (cached !== null) return cached;

    const agora = new Date();
    const reportes = await this.reporteRepo.find({
      where: {
        tipo: TipoReporte.TREM,
        trem_id: tremId,
        ativo: true,
        data_hora_expiracao: MoreThan(agora),
      },
      order: { data_hora_criacao: 'DESC' },
      take: 3,
    });

    // Regra 5.3 — Apenas os 3 reportes mais recentes; status do mais recente com confianca >= 10
    const tresMaisRecentes = this.filtrarAtivos(reportes, agora)
      .sort(
        (a, b) =>
          new Date(b.data_hora_criacao).getTime() -
          new Date(a.data_hora_criacao).getTime(),
      )
      .slice(0, 3);

    const valido = tresMaisRecentes.find(
      (r): r is Reporte & { status_trem: StatusTrem } =>
        r.status_trem != null && r.confianca >= 10,
    );

    if (!valido) {
      return null;
    }

    const resultado: StatusTremResultado = {
      status: valido.status_trem,
      confianca: valido.confianca,
      estacao_id: valido.estacao_id,
      atualizado_em: valido.data_hora_criacao,
    };

    await this.cache.set(cacheKey, resultado, TTL_STATUS_MS);
    return resultado;
  }

  async getMapa() {
    const cacheKey = 'mapa:geral';
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const [estacoes, linhas, trens] = await Promise.all([
      this.estacaoRepo.find(),
      this.linhaRepo ? this.linhaRepo.find() : Promise.resolve([]),
      this.tremRepo ? this.tremRepo.find() : Promise.resolve([]),
    ]);

    const estacoesComStatus = await Promise.all(
      estacoes.map(async (estacao) => ({
        ...estacao,
        status_efetivo: await this.getStatusEstacao(estacao.id),
      })),
    );

    const linhasComStatus = await Promise.all(
      linhas.map(async (linha) => ({
        ...linha,
        status_efetivo: await this.getStatusLinha(linha.id),
      })),
    );

    // Regra 7.2.1 — Trem sem reportes há > 20 minutos é considerado inativo no mapa
    const limiteInatividade = new Date(Date.now() - JANELA_TREM_ATIVO_MS);
    const trensAtivos = (
      await Promise.all(
        trens.map(async (trem) => {
          const statusTrem = await this.getStatusTrem(trem.id);
          if (
            !statusTrem ||
            new Date(statusTrem.atualizado_em) <= limiteInatividade
          ) {
            return null;
          }
          return {
            ...trem,
            status_efetivo: statusTrem,
          };
        }),
      )
    ).filter((t) => t !== null);

    const payload = {
      atualizado_em: new Date(),
      linhas: linhasComStatus,
      estacoes: estacoesComStatus,
      trens: trensAtivos,
    };

    await this.cache.set(cacheKey, payload, TTL_STATUS_MS);
    return payload;
  }

  async invalidarAlvo(alvo: {
    tipo?: TipoReporte;
    estacao_id?: number | null;
    linha_id?: number | null;
    trem_id?: string | null;
  }): Promise<void> {
    await this.cache.del('mapa:geral');

    if (alvo.estacao_id != null) {
      await this.cache.del(`status:estacao:${alvo.estacao_id}`);
      const estacao = await this.estacaoRepo.findOne({
        where: { id: alvo.estacao_id },
      });
      if (estacao?.linha_id != null) {
        await this.cache.del(`status:linha:${estacao.linha_id}`);
      }
    }

    if (alvo.linha_id != null) {
      await this.cache.del(`status:linha:${alvo.linha_id}`);
    }

    if (alvo.trem_id != null) {
      await this.cache.del(`status:trem:${alvo.trem_id}`);
    }
  }

  private filtrarAtivos(reportes: Reporte[], agora: Date): Reporte[] {
    return reportes.filter(
      (r) =>
        r.ativo !== false &&
        (!r.data_hora_expiracao ||
          new Date(r.data_hora_expiracao).getTime() > agora.getTime()),
    );
  }

  private agregarStatusEstacao(
    reportes: Array<Reporte & { status_estacao: StatusEstacao }>,
  ): StatusEstacaoResultado {
    if (reportes.length === 0) {
      return { status: StatusEstacao.NORMAL, confianca: 0 };
    }

    const somas = new Map<StatusEstacao, number>();
    for (const r of reportes) {
      somas.set(
        r.status_estacao,
        (somas.get(r.status_estacao) ?? 0) + r.confianca,
      );
    }

    let melhorStatus = StatusEstacao.NORMAL;
    let maiorSoma = -1;

    for (const [status, soma] of somas.entries()) {
      if (
        soma > maiorSoma ||
        (soma === maiorSoma &&
          GRAVIDADE_ESTACAO[status] > GRAVIDADE_ESTACAO[melhorStatus])
      ) {
        melhorStatus = status;
        maiorSoma = soma;
      }
    }

    if (maiorSoma < LIMIAR_SOMA_MINIMA) {
      return { status: StatusEstacao.NORMAL, confianca: 0 };
    }

    return {
      status: melhorStatus,
      confianca: Math.min(100, Math.round(maiorSoma)),
    };
  }

  private agregarStatusLinha(
    reportes: Array<Reporte & { status_linha: StatusLinha }>,
  ): StatusLinhaResultado {
    if (reportes.length === 0) {
      return { status: StatusLinha.NORMAL, confianca: 0 };
    }

    const somas = new Map<StatusLinha, number>();
    for (const r of reportes) {
      somas.set(r.status_linha, (somas.get(r.status_linha) ?? 0) + r.confianca);
    }

    let melhorStatus = StatusLinha.NORMAL;
    let maiorSoma = -1;

    for (const [status, soma] of somas.entries()) {
      if (
        soma > maiorSoma ||
        (soma === maiorSoma &&
          GRAVIDADE_LINHA[status] > GRAVIDADE_LINHA[melhorStatus])
      ) {
        melhorStatus = status;
        maiorSoma = soma;
      }
    }

    if (maiorSoma < LIMIAR_SOMA_MINIMA) {
      return { status: StatusLinha.NORMAL, confianca: 0 };
    }

    return {
      status: melhorStatus,
      confianca: Math.min(100, Math.round(maiorSoma)),
    };
  }
}
