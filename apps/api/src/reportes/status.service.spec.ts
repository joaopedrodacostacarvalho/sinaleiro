import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusService } from './status.service.js';
import {
  StatusEstacao,
  StatusLinha,
  StatusTrem,
  TipoReporte,
} from '@sinaleiro/types/enums';
import { makeEstacao, makeReporte } from '../../test/fixtures.js';

interface MapaTesteResultado {
  atualizado_em: Date;
  linhas: Array<{ id: number; nome: string; status_efetivo: unknown }>;
  estacoes: Array<{ id: number; nome: string; status_efetivo: unknown }>;
  trens: Array<{ id: string; status_efetivo: unknown }>;
}

describe('StatusService.getStatusEstacao()', () => {
  let service: StatusService;
  let reporteRepo: any;
  let estacaoRepo: any;
  let cache: any;

  beforeEach(() => {
    reporteRepo = { find: vi.fn().mockResolvedValue([]) };
    estacaoRepo = { find: vi.fn().mockResolvedValue([]) };
    cache = { get: vi.fn().mockResolvedValue(null), set: vi.fn(), del: vi.fn() };
    service = new StatusService(reporteRepo, estacaoRepo, cache);
  });

  it('retorna NORMAL com confianca 0 se nenhum reporte', async () => {
    const r = await service.getStatusEstacao(1);
    expect(r).toEqual({ status: StatusEstacao.NORMAL, confianca: 0 });
  });

  it('retorna status com maior soma de confiança e limita em 100', async () => {
    reporteRepo.find.mockResolvedValueOnce([
      makeReporte({ status_estacao: StatusEstacao.LOTADA, confianca: 20 }),
      makeReporte({ status_estacao: StatusEstacao.LOTADA, confianca: 15 }),
      makeReporte({ status_estacao: StatusEstacao.ATENCAO, confianca: 10 }),
    ]);
    const r = await service.getStatusEstacao(1);
    expect(r.status).toBe(StatusEstacao.LOTADA);
    expect(r.confianca).toBe(35);

    reporteRepo.find.mockResolvedValueOnce([
      makeReporte({ status_estacao: StatusEstacao.PARALISADA, confianca: 70 }),
      makeReporte({ status_estacao: StatusEstacao.PARALISADA, confianca: 60 }),
    ]);
    const saturado = await service.getStatusEstacao(1);
    expect(saturado).toEqual({ status: StatusEstacao.PARALISADA, confianca: 100 });
  });

  it('NORMAL se maior soma < 1.5 (Regra 5.1)', async () => {
    reporteRepo.find.mockResolvedValue([
      makeReporte({ status_estacao: StatusEstacao.LOTADA, confianca: 10 }),
    ]);
    const r = await service.getStatusEstacao(1);
    expect(r.status).toBe(StatusEstacao.NORMAL);
  });

  it('empate resolve para status mais grave (Regra 5.1.1)', async () => {
    reporteRepo.find.mockResolvedValue([
      makeReporte({ status_estacao: StatusEstacao.LOTADA, confianca: 20 }),
      makeReporte({ status_estacao: StatusEstacao.ATENCAO, confianca: 20 }),
    ]);
    const r = await service.getStatusEstacao(1);
    expect(r.status).toBe(StatusEstacao.LOTADA);
  });

  it('empate entre PARALISADA e FECHADA prefere PARALISADA', async () => {
    reporteRepo.find.mockResolvedValue([
      makeReporte({ status_estacao: StatusEstacao.FECHADA, confianca: 20 }),
      makeReporte({ status_estacao: StatusEstacao.PARALISADA, confianca: 20 }),
    ]);
    const r = await service.getStatusEstacao(1);
    expect(r.status).toBe(StatusEstacao.PARALISADA);
  });

  it('ignora reportes inativos ou com data_hora_expiracao vencida', async () => {
    reporteRepo.find.mockResolvedValue([
      makeReporte({
        status_estacao: StatusEstacao.PARALISADA,
        confianca: 100,
        ativo: false,
      }),
      makeReporte({
        status_estacao: StatusEstacao.FECHADA,
        confianca: 80,
        ativo: true,
        data_hora_expiracao: new Date(Date.now() - 1_000),
      }),
    ]);
    const r = await service.getStatusEstacao(1);
    expect(r).toEqual({ status: StatusEstacao.NORMAL, confianca: 0 });
  });

  it('cacheia resultado por 30s (Regra 5.4.1)', async () => {
    await service.getStatusEstacao(1);
    expect(cache.set).toHaveBeenCalledWith(
      'status:estacao:1',
      expect.anything(),
      30_000,
    );
  });

  it('usa cache quando disponível', async () => {
    cache.get.mockResolvedValue({ status: StatusEstacao.LOTADA, confianca: 50 });
    const r = await service.getStatusEstacao(1);
    expect(r.status).toBe(StatusEstacao.LOTADA);
    expect(reporteRepo.find).not.toHaveBeenCalled();
  });
});

describe('StatusService.getStatusLinha()', () => {
  let service: StatusService;
  let reporteRepo: any;
  let estacaoRepo: any;
  let cache: any;

  beforeEach(() => {
    reporteRepo = { find: vi.fn().mockResolvedValue([]) };
    estacaoRepo = { find: vi.fn().mockResolvedValue([]) };
    cache = { get: vi.fn().mockResolvedValue(null), set: vi.fn(), del: vi.fn() };
    service = new StatusService(reporteRepo, estacaoRepo, cache);
  });

  it('usa reportes de LINHA explícitos se existirem e resolve empate por gravidade', async () => {
    reporteRepo.find.mockResolvedValueOnce([
      makeReporte({
        tipo: TipoReporte.LINHA,
        status_linha: StatusLinha.ATENCAO,
        confianca: 30,
      }),
      makeReporte({
        tipo: TipoReporte.LINHA,
        status_linha: StatusLinha.PARALISADA,
        confianca: 30,
      }),
    ]);
    const r = await service.getStatusLinha(1);
    expect(r).toEqual({ status: StatusLinha.PARALISADA, confianca: 30 });
  });

  it('PARALISADA quando ≥2 estações PARALISADA (Regra 5.2)', async () => {
    reporteRepo.find
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        makeReporte({ estacao_id: 1, status_estacao: StatusEstacao.PARALISADA, confianca: 50 }),
        makeReporte({ estacao_id: 2, status_estacao: StatusEstacao.PARALISADA, confianca: 70 }),
      ]);
    const r = await service.getStatusLinha(1);
    expect(r).toEqual({ status: StatusLinha.PARALISADA, confianca: 60 });
  });

  it('ATENCAO quando ≥1 PARALISADA ou ≥2 estações críticas (ATENCAO, FECHADA ou LOTADA)', async () => {
    reporteRepo.find
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        makeReporte({ estacao_id: 1, status_estacao: StatusEstacao.PARALISADA, confianca: 50 }),
      ]);
    const porUmaParalisada = await service.getStatusLinha(1);
    expect(porUmaParalisada.status).toBe(StatusLinha.ATENCAO);

    reporteRepo.find
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        makeReporte({ estacao_id: 1, status_estacao: StatusEstacao.FECHADA, confianca: 40 }),
        makeReporte({ estacao_id: 2, status_estacao: StatusEstacao.LOTADA, confianca: 20 }),
      ]);
    const porFechadaELotada = await service.getStatusLinha(1);
    expect(porFechadaELotada).toEqual({ status: StatusLinha.ATENCAO, confianca: 30 });
  });

  it('NORMAL se apenas estações NORMAL', async () => {
    reporteRepo.find
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        makeReporte({ estacao_id: 1, status_estacao: StatusEstacao.NORMAL, confianca: 50 }),
      ]);
    const r = await service.getStatusLinha(1);
    expect(r).toEqual({ status: StatusLinha.NORMAL, confianca: 0 });
  });

  it('derivação ignora estações com confianca < 20 (Regra 5.2.1)', async () => {
    reporteRepo.find
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        makeReporte({ estacao_id: 1, status_estacao: StatusEstacao.PARALISADA, confianca: 10 }),
        makeReporte({ estacao_id: 2, status_estacao: StatusEstacao.PARALISADA, confianca: 10 }),
      ]);
    const r = await service.getStatusLinha(1);
    expect(r).toEqual({ status: StatusLinha.NORMAL, confianca: 0 });
  });
});

describe('StatusService.getStatusTrem()', () => {
  let service: StatusService;
  let reporteRepo: any;
  let estacaoRepo: any;
  let cache: any;

  beforeEach(() => {
    reporteRepo = { find: vi.fn().mockResolvedValue([]) };
    estacaoRepo = { find: vi.fn() };
    cache = { get: vi.fn().mockResolvedValue(null), set: vi.fn(), del: vi.fn() };
    service = new StatusService(reporteRepo, estacaoRepo, cache);
  });

  it('retorna null e grava sentinela vazio no cache se nenhum reporte (Regra 5.3.1)', async () => {
    expect(await service.getStatusTrem('t-1')).toBeNull();
    expect(cache.set).toHaveBeenCalledWith('status:trem:t-1', { vazio: true }, 30_000);

    cache.get.mockResolvedValueOnce({ vazio: true });
    expect(await service.getStatusTrem('t-1')).toBeNull();
    expect(reporteRepo.find).toHaveBeenCalledTimes(1);
  });

  it('considera apenas os 3 reportes mais recentes e ignora o 4º mais antigo (Regra 5.3)', async () => {
    const agora = Date.now();
    reporteRepo.find.mockResolvedValue([
      makeReporte({ status_trem: StatusTrem.NORMAL, confianca: 5, data_hora_criacao: new Date(agora - 1_000) }),
      makeReporte({ status_trem: StatusTrem.LOTADO, confianca: 5, data_hora_criacao: new Date(agora - 2_000) }),
      makeReporte({ status_trem: StatusTrem.ATRASO, confianca: 5, data_hora_criacao: new Date(agora - 3_000) }),
      // 4º mais antigo: mesmo com confiança alta, fica fora da janela dos 3 mais recentes
      makeReporte({ status_trem: StatusTrem.LOTADO, confianca: 30, data_hora_criacao: new Date(agora - 4_000) }),
    ]);

    const r = await service.getStatusTrem('t-1');
    expect(r).toBeNull();
  });

  it('usa status do mais recente com confianca ≥ 10', async () => {
    reporteRepo.find.mockResolvedValue([
      makeReporte({ status_trem: StatusTrem.ATRASO, confianca: 20, data_hora_criacao: new Date(Date.now() - 1000) }),
      makeReporte({ status_trem: StatusTrem.LOTADO, confianca: 5, data_hora_criacao: new Date() }),
    ]);
    const r = await service.getStatusTrem('t-1');
    expect(r?.status).toBe(StatusTrem.ATRASO);
  });
});

describe('StatusService.getMapa() e invalidarAlvo()', () => {
  let service: StatusService;
  let reporteRepo: any;
  let estacaoRepo: any;
  let linhaRepo: any;
  let tremRepo: any;
  let cache: any;

  beforeEach(() => {
    reporteRepo = { find: vi.fn().mockResolvedValue([]) };
    estacaoRepo = {
      find: vi.fn().mockResolvedValue([]),
      findOne: vi.fn().mockResolvedValue(null),
    };
    linhaRepo = { find: vi.fn().mockResolvedValue([]) };
    tremRepo = { find: vi.fn().mockResolvedValue([]) };
    cache = { get: vi.fn().mockResolvedValue(null), set: vi.fn(), del: vi.fn() };

    service = new StatusService(
      reporteRepo,
      estacaoRepo,
      cache,
      linhaRepo,
      tremRepo,
    );
  });

  it('agrega estações, linhas (explícita e derivada) e filtra trens inativos > 20 min', async () => {
    const agora = Date.now();
    estacaoRepo.find.mockResolvedValue([
      makeEstacao({ id: 1, linha_id: 1, nome: 'Recife' }),
      makeEstacao({ id: 2, linha_id: 2, nome: 'Imbiribeira' }),
    ]);
    linhaRepo.find.mockResolvedValue([
      { id: 1, nome: 'Linha Centro' },
      { id: 2, nome: 'Linha Sul' },
    ]);
    tremRepo.find.mockResolvedValue([
      { id: 'trem-ativo', linha_id: 1, id_vagao: 'TUE 101' },
      { id: 'trem-inativo', linha_id: 1, id_vagao: 'TUE 202' },
    ]);

    reporteRepo.find.mockResolvedValue([
      makeReporte({
        tipo: TipoReporte.ESTACAO,
        estacao_id: 1,
        status_estacao: StatusEstacao.PARALISADA,
        confianca: 30,
      }),
      makeReporte({
        tipo: TipoReporte.LINHA,
        estacao_id: null,
        linha_id: 2,
        status_linha: StatusLinha.PARALISADA,
        confianca: 25,
      }),
      makeReporte({
        tipo: TipoReporte.TREM,
        estacao_id: 1,
        trem_id: 'trem-ativo',
        status_trem: StatusTrem.LOTADO,
        confianca: 20,
        data_hora_criacao: new Date(agora - 5 * 60_000),
      }),
      makeReporte({
        tipo: TipoReporte.TREM,
        estacao_id: 1,
        trem_id: 'trem-inativo',
        status_trem: StatusTrem.ATRASO,
        confianca: 20,
        data_hora_criacao: new Date(agora - 25 * 60_000),
      }),
    ]);

    const mapa = (await service.getMapa()) as MapaTesteResultado;

    expect(mapa.estacoes[0].status_efetivo).toEqual({
      status: StatusEstacao.PARALISADA,
      confianca: 30,
    });
    expect(mapa.linhas[0].status_efetivo).toEqual({
      status: StatusLinha.ATENCAO,
      confianca: 30,
    });
    expect(mapa.linhas[1].status_efetivo).toEqual({
      status: StatusLinha.PARALISADA,
      confianca: 25,
    });
    expect(mapa.trens).toHaveLength(1);
    expect(mapa.trens[0].id).toBe('trem-ativo');
    expect(cache.set).toHaveBeenCalledWith('mapa:geral', mapa, 30_000);
  });

  it('invalidarAlvo invalida estação e linha pai para ESTACAO, mas apenas trem para TREM', async () => {
    estacaoRepo.findOne.mockResolvedValueOnce(makeEstacao({ id: 4, linha_id: 1 }));

    await service.invalidarAlvo({
      tipo: TipoReporte.ESTACAO,
      estacao_id: 4,
    });

    expect(cache.del).toHaveBeenCalledWith('mapa:geral');
    expect(cache.del).toHaveBeenCalledWith('status:estacao:4');
    expect(cache.del).toHaveBeenCalledWith('status:linha:1');

    cache.del.mockClear();
    estacaoRepo.findOne.mockClear();

    await service.invalidarAlvo({
      tipo: TipoReporte.TREM,
      estacao_id: 4,
      trem_id: 'trem-99',
    });

    expect(cache.del).toHaveBeenCalledTimes(2);
    expect(cache.del).toHaveBeenCalledWith('mapa:geral');
    expect(cache.del).toHaveBeenCalledWith('status:trem:trem-99');
    expect(estacaoRepo.findOne).not.toHaveBeenCalled();
  });
});
