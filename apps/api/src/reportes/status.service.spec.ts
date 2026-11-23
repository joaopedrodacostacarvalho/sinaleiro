import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusService } from './status.service.js';
import {
  StatusEstacao, StatusLinha, StatusTrem, TipoReporte,
} from '@sinaleiro/types/enums';
import { makeReporte } from '../../test/fixtures.js';

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

  it('retorna status com maior soma de confiança', async () => {
    reporteRepo.find.mockResolvedValue([
      makeReporte({ status_estacao: StatusEstacao.LOTADA, confianca: 20 }),
      makeReporte({ status_estacao: StatusEstacao.LOTADA, confianca: 15 }),
      makeReporte({ status_estacao: StatusEstacao.ATENCAO, confianca: 10 }),
    ]);
    const r = await service.getStatusEstacao(1);
    expect(r.status).toBe(StatusEstacao.LOTADA);
    expect(r.confianca).toBe(35); // min(100, 3.5×10)
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
    expect(r.status).toBe(StatusEstacao.LOTADA);  // LOTADA > ATENCAO
  });

  it('empate entre PARALISADA e FECHADA prefere PARALISADA', async () => {
    reporteRepo.find.mockResolvedValue([
      makeReporte({ status_estacao: StatusEstacao.FECHADA, confianca: 20 }),
      makeReporte({ status_estacao: StatusEstacao.PARALISADA, confianca: 20 }),
    ]);
    const r = await service.getStatusEstacao(1);
    expect(r.status).toBe(StatusEstacao.PARALISADA);
  });

  it('ignora reportes expirados', async () => {
    reporteRepo.find.mockResolvedValue([
      makeReporte({ status_estacao: StatusEstacao.PARALISADA, confianca: 100, ativo: false }),
    ]);
    const r = await service.getStatusEstacao(1);
    expect(r.status).toBe(StatusEstacao.NORMAL);
  });

  it('cacheia resultado por 30s (Regra 5.4.1)', async () => {
    await service.getStatusEstacao(1);
    expect(cache.set).toHaveBeenCalledWith(
      expect.stringContaining('estacao:1'), expect.anything(), 30_000,
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

  it('usa reportes de LINHA explícitos se existirem', async () => {
    reporteRepo.find
      .mockResolvedValueOnce([  // reportes de LINHA
        makeReporte({ tipo: TipoReporte.LINHA, status_linha: StatusLinha.PARALISADA, confianca: 30 }),
      ]);
    const r = await service.getStatusLinha(1);
    expect(r.status).toBe(StatusLinha.PARALISADA);
  });

  it('PARALISADA quando ≥2 estações PARALISADA (Regra 5.2)', async () => {
    reporteRepo.find
      .mockResolvedValueOnce([]) // sem reportes de linha
      .mockResolvedValueOnce([
        makeReporte({ estacao_id: 1, status_estacao: StatusEstacao.PARALISADA, confianca: 50 }),
        makeReporte({ estacao_id: 2, status_estacao: StatusEstacao.PARALISADA, confianca: 50 }),
      ]);
    const r = await service.getStatusLinha(1);
    expect(r.status).toBe(StatusLinha.PARALISADA);
  });

  it('ATENCAO quando ≥1 PARALISADA ou ≥2 ATENCAO', async () => {
    reporteRepo.find
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        makeReporte({ estacao_id: 1, status_estacao: StatusEstacao.PARALISADA, confianca: 50 }),
      ]);
    const r = await service.getStatusLinha(1);
    expect(r.status).toBe(StatusLinha.ATENCAO);
  });

  it('NORMAL se apenas estações NORMAL', async () => {
    reporteRepo.find
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        makeReporte({ estacao_id: 1, status_estacao: StatusEstacao.NORMAL, confianca: 50 }),
      ]);
    const r = await service.getStatusLinha(1);
    expect(r.status).toBe(StatusLinha.NORMAL);
  });

  it('derivação ignora estações com confianca < 20 (Regra 5.2.1)', async () => {
    reporteRepo.find
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        makeReporte({ estacao_id: 1, status_estacao: StatusEstacao.PARALISADA, confianca: 10 }),
        makeReporte({ estacao_id: 2, status_estacao: StatusEstacao.PARALISADA, confianca: 10 }),
      ]);
    const r = await service.getStatusLinha(1);
    expect(r.status).toBe(StatusLinha.NORMAL);
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

  it('retorna null se nenhum reporte (Regra 5.3.1)', async () => {
    expect(await service.getStatusTrem('t-1')).toBeNull();
  });

  it('usa apenas os 3 mais recentes (Regra 5.3)', async () => {
    reporteRepo.find.mockResolvedValue([
      makeReporte({ status_trem: StatusTrem.LOTADO, confianca: 20, data_hora_criacao: new Date() }),
    ]);
    const r = await service.getStatusTrem('t-1');
    expect(r?.status).toBe(StatusTrem.LOTADO);
  });

  it('usa status do mais recente com confianca ≥ 10', async () => {
    reporteRepo.find.mockResolvedValue([
      makeReporte({ status_trem: StatusTrem.ATRASO, confianca: 20, data_hora_criacao: new Date(Date.now() - 1000) }),
      makeReporte({ status_trem: StatusTrem.LOTADO, confianca: 5, data_hora_criacao: new Date() }),
    ]);
    const r = await service.getStatusTrem('t-1');
    expect(r?.status).toBe(StatusTrem.ATRASO); // ignora confianca < 10
  });
});
