import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, ForbiddenException, TooManyRequestsException, BadRequestException } from '@nestjs/common';
import { ReportesService } from './reportes.service.js';
import {
  StatusEstacao, StatusTrem, TipoReporte,
} from '@sinaleiro/types/enums';
import { makeEstacao, makeReporte, makeUsuario } from '../../test/fixtures.js';

describe('ReportesService.create()', () => {
  let service: ReportesService;
  let reporteRepo: any;
  let estacaoRepo: any;
  let reputacaoService: any;

  beforeEach(() => {
    reporteRepo = {
      findOne: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn((data) => ({ ...data })),
      save: vi.fn(async (e) => ({ id: 'novo-id', ...e })),
    };
    estacaoRepo = { findOne: vi.fn() };
    reputacaoService = { getPeso: vi.fn().mockReturnValue(1.0) };
    service = new ReportesService(reporteRepo, estacaoRepo, reputacaoService);
  });

  // ---- Regra 3.1 ----
  describe('validação de alvo', () => {
    it('rejeita ESTACAO sem status_estacao', async () => {
      await expect(service.create(
        { tipo: TipoReporte.ESTACAO, estacao_id: 1 } as any,
        makeUsuario(),
      )).rejects.toThrow(BadRequestException);
    });
  });

  // ---- Regra 3.2.1 ----
  describe('anti-duplicata (5 min)', () => {
    it('409 se mesmo alvo+status em <5min', async () => {
      reporteRepo.findOne.mockResolvedValue(makeReporte({
        usuario_id: 'user-1',
        data_hora_criacao: new Date(Date.now() - 60_000),
      }));
      await expect(service.create(
        { tipo: TipoReporte.ESTACAO, estacao_id: 1, status_estacao: StatusEstacao.NORMAL } as any,
        makeUsuario({ id: 'user-1' }),
      )).rejects.toThrow(ConflictException);
    });
  });

  // ---- Regra 3.2.2 ----
  describe('rate limit (10/hora)', () => {
    it('429 se já tem 10 reportes na última hora', async () => {
      reporteRepo.count.mockResolvedValue(10);
      await expect(service.create(
        { tipo: TipoReporte.ESTACAO, estacao_id: 1, status_estacao: StatusEstacao.NORMAL } as any,
        makeUsuario(),
      )).rejects.toThrow(TooManyRequestsException);
    });

    it('permite 10 reportes/hora', async () => {
      reporteRepo.count.mockResolvedValue(9);
      await expect(service.create(
        { tipo: TipoReporte.ESTACAO, estacao_id: 1, status_estacao: StatusEstacao.NORMAL } as any,
        makeUsuario(),
      )).resolves.toBeDefined();
    });
  });

  // ---- Regra 3.2.4 ----
  describe('confiança inicial', () => {
    it('usa o peso do autor', async () => {
      reputacaoService.getPeso.mockReturnValue(2.0);
      const r = await service.create(
        { tipo: TipoReporte.ESTACAO, estacao_id: 1, status_estacao: StatusEstacao.NORMAL } as any,
        makeUsuario({ reputacao: 60 }),
      );
      expect(reporteRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ confianca: 20 }),  // 2.0 × 10
      );
    });

    it('ignora confianca do DTO (removida no CreateReporteDto)', async () => {
      await service.create(
        {
          tipo: TipoReporte.ESTACAO, estacao_id: 1, status_estacao: StatusEstacao.NORMAL,
          confianca: 999,
        } as any,
        makeUsuario({ reputacao: 0 }),
      );
      expect(reporteRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ confianca: 10 }),
      );
    });
  });

  // ---- Regra 3.3.2 ----
  describe('expiração', () => {
    it('TREM expira em 5 min', async () => {
      const antes = Date.now();
      await service.create(
        { tipo: TipoReporte.TREM, trem_id: 't-1', estacao_id: 1, status_trem: StatusTrem.NORMAL } as any,
        makeUsuario(),
      );
      const chamada = reporteRepo.save.mock.calls[0][0];
      const delta = chamada.data_hora_expiracao.getTime() - antes;
      expect(delta).toBeGreaterThanOrEqual(5 * 60_000 - 1000);
      expect(delta).toBeLessThanOrEqual(5 * 60_000 + 1000);
    });
  });

  // ---- Regra 3.2.3 ----
  describe('cooldown pós-refutação', () => {
    it('força peso 0.5 se último reporte foi REFUTADO em <15min', async () => {
      reporteRepo.findOne
        .mockResolvedValueOnce(null) // duplicata
        .mockResolvedValueOnce(makeReporte({ ativo: false, data_hora_criacao: new Date(Date.now() - 5 * 60_000) }));
      // Implementação precisa expor essa verificação — mock do service interno
      // Nota: a assinatura do ReportesService deve aceitar o autor e checar
      // o último reporte do usuário quando necessário.
      // TODO: implementar — a regra é descrita por este teste.
    });
  });

  // ---- Regra 3.3.3 ----
  describe('renovação por reconfirmação', () => {
    it('reaproveita reporte existente do mesmo alvo+status e estende expiração', async () => {
      const existente = makeReporte({
        id: 'r-existente',
        ativo: true,
        data_hora_expiracao: new Date(Date.now() + 5 * 60_000),
        usuario_id: 'outro',
      });
      reporteRepo.findOne.mockResolvedValue(existente);

      await service.create(
        { tipo: TipoReporte.ESTACAO, estacao_id: 1, status_estacao: StatusEstacao.NORMAL } as any,
        makeUsuario({ id: 'user-2' }),
      );

      expect(reporteRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'r-existente' }),
      );
      // A expiração foi estendida
      const salvo = reporteRepo.save.mock.calls[0][0];
      expect(salvo.data_hora_expiracao.getTime()).toBeGreaterThan(existente.data_hora_expiracao.getTime());
    });
  });

  // ---- Decisão do usuário: FECHADA bloqueia TREM ----
  describe('estação FECHADA bloqueia reporte de TREM', () => {
    it('403 se a estação de avistamento está FECHADA', async () => {
      // Service deve consultar o status efetivo da estação antes de aceitar reporte de trem
      estacaoRepo.findOne.mockResolvedValue(makeEstacao({ id: 1 }));
      // mock do StatusService.getStatusEstacao → FECHADA
      (service as any).statusService = {
        getStatusEstacao: vi.fn().mockResolvedValue({
          status: StatusEstacao.FECHADA, confianca: 80,
        }),
      };

      await expect(service.create(
        { tipo: TipoReporte.TREM, trem_id: 't-1', estacao_id: 1, status_trem: StatusTrem.NORMAL } as any,
        makeUsuario(),
      )).rejects.toThrow(ForbiddenException);
    });

    it('permite reporte de TREM se estação está aberta', async () => {
      estacaoRepo.findOne.mockResolvedValue(makeEstacao({ id: 1 }));
      (service as any).statusService = {
        getStatusEstacao: vi.fn().mockResolvedValue({
          status: StatusEstacao.NORMAL, confianca: 0,
        }),
      };

      await expect(service.create(
        { tipo: TipoReporte.TREM, trem_id: 't-1', estacao_id: 1, status_trem: StatusTrem.NORMAL } as any,
        makeUsuario(),
      )).resolves.toBeDefined();
    });
  });
});
