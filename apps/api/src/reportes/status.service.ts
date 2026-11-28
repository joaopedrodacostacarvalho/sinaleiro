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

type CacheTremEntrada = StatusTremResultado | { vazio: true };

const TTL_STATUS_MS = 30_000;
const LIMIAR_SOMA_MINIMA = 15; // equivalente a 1.5 na escala de pesos (×10)
const MIN_CONFIANCA_DERIVACAO_LINHA = 20;
const MIN_CONFIANCA_TREM = 10;
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

    const resultado = this.derivarStatusLinhaDeEstacoes(ativosEstacoes);
    await this.cache.set(cacheKey, resultado, TTL_STATUS_MS);
    return resultado;
  }

  async getStatusTrem(tremId: string): Promise<StatusTremResultado | null> {
    const cacheKey = `status:trem:${tremId}`;
    const cached = await this.cache.get<CacheTremEntrada>(cacheKey);
    if (cached !== null) {
      return 'vazio' in cached ? null : cached;
    }

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

    const resultado = this.agregarStatusTrem(this.filtrarAtivos(reportes, agora));

    if (!resultado) {
      await this.cache.set(cacheKey, { vazio: true }, TTL_STATUS_MS);
      return null;
    }

    await this.cache.set(cacheKey, resultado, TTL_STATUS_MS);
    return resultado;
  }

  async getMapa() {
    const cacheKey = 'mapa:geral';
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const agora = new Date();
    const [estacoes, linhas, trens, reportesAtivos] = await Promise.all([
      this.estacaoRepo.find(),
      this.linhaRepo ? this.linhaRepo.find() : Promise.resolve([]),
      this.tremRepo ? this.tremRepo.find() : Promise.resolve([]),
      this.reporteRepo.find({
        where: {
          ativo: true,
          data_hora_expiracao: MoreThan(agora),
        },
        order: { data_hora_criacao: 'DESC' },
      }),
    ]);

    const ativos = this.filtrarAtivos(reportesAtivos, agora);

    const porEstacao = new Map<
      number,
      Array<Reporte & { status_estacao: StatusEstacao }>
    >();
    const porLinha = new Map<
      number,
      Array<Reporte & { status_linha: StatusLinha }>
    >();
    const porTrem = new Map<string, Reporte[]>();

    for (const r of ativos) {
      if (
        r.tipo === TipoReporte.ESTACAO &&
        r.estacao_id != null &&
        r.status_estacao != null
      ) {
        const lista = porEstacao.get(r.estacao_id) ?? [];
        lista.push(r as Reporte & { status_estacao: StatusEstacao });
        porEstacao.set(r.estacao_id, lista);
      } else if (
        r.tipo === TipoReporte.LINHA &&
        r.linha_id != null &&
        r.status_linha != null
      ) {
        const lista = porLinha.get(r.linha_id) ?? [];
        lista.push(r as Reporte & { status_linha: StatusLinha });
        porLinha.set(r.linha_id, lista);
      } else if (r.tipo === TipoReporte.TREM && r.trem_id != null) {
        const lista = porTrem.get(r.trem_id) ?? [];
        lista.push(r);
        porTrem.set(r.trem_id, lista);
      }
    }

    const estacoesComStatus = estacoes.map((estacao) =>
      Object.assign({}, estacao, {
        status_efetivo: this.agregarStatusEstacao(
          porEstacao.get(estacao.id) ?? [],
        ),
      }),
    );

    const linhasComStatus = linhas.map((linha) => {
      const explicitos = porLinha.get(linha.id) ?? [];
      if (explicitos.length > 0) {
        return Object.assign({}, linha, {
          status_efetivo: this.agregarStatusLinha(explicitos),
        });
      }

      const estacoesDaLinha = estacoes
        .filter((e) => e.linha_id === linha.id)
        .flatMap((e) => porEstacao.get(e.id) ?? []);

      return Object.assign({}, linha, {
        status_efetivo: this.derivarStatusLinhaDeEstacoes(estacoesDaLinha),
      });
    });

    // Regra 7.2.1 — Trem sem reportes há > 20 minutos é considerado inativo no mapa
    const limiteInatividade = new Date(agora.getTime() - JANELA_TREM_ATIVO_MS);
    const trensAtivos = trens
      .map((trem) => {
        const statusTrem = this.agregarStatusTrem(porTrem.get(trem.id) ?? []);
        if (
          !statusTrem ||
          new Date(statusTrem.atualizado_em) <= limiteInatividade
        ) {
          return null;
        }
        return Object.assign({}, trem, {
          status_efetivo: statusTrem,
        });
      })
      .filter((t) => t !== null);

    const payload = {
      atualizado_em: agora,
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

    if (alvo.tipo === TipoReporte.TREM) {
      if (alvo.trem_id != null) {
        await this.cache.del(`status:trem:${alvo.trem_id}`);
      }
      return;
    }

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

  private derivarStatusLinhaDeEstacoes(
    ativosEstacoes: Array<Reporte & { status_estacao: StatusEstacao }>,
  ): StatusLinhaResultado {
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
        qtdAtencao += 1;
        somaConfiancaCritica += statusEfetivo.confianca;
        countCritica += 1;
      }
    }

    if (qtdParalisadas >= 2) {
      return {
        status: StatusLinha.PARALISADA,
        confianca: Math.min(100, Math.round(somaConfiancaCritica / countCritica)),
      };
    }

    if (qtdParalisadas >= 1 || qtdAtencao >= 2) {
      return {
        status: StatusLinha.ATENCAO,
        confianca: Math.min(100, Math.round(somaConfiancaCritica / countCritica)),
      };
    }

    return { status: StatusLinha.NORMAL, confianca: 0 };
  }

  private agregarStatusTrem(reportes: Reporte[]): StatusTremResultado | null {
    const tresMaisRecentes = [...reportes]
      .sort(
        (a, b) =>
          new Date(b.data_hora_criacao).getTime() -
          new Date(a.data_hora_criacao).getTime(),
      )
      .slice(0, 3);

    const valido = tresMaisRecentes.find(
      (r): r is Reporte & { status_trem: StatusTrem } =>
        r.status_trem != null && r.confianca >= MIN_CONFIANCA_TREM,
    );

    if (!valido) {
      return null;
    }

    return {
      status: valido.status_trem,
      confianca: valido.confianca,
      estacao_id: valido.estacao_id,
      atualizado_em: valido.data_hora_criacao,
    };
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
