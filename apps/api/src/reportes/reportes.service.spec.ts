import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpStatus,
} from '@nestjs/common';
import { ReportesService } from './reportes.service.js';
import {
  Sentido,
  StatusEstacao,
  StatusTrem,
  TipoReporte,
} from '@sinaleiro/types/enums';
import { makeEstacao, makeReporte, makeUsuario } from '../../test/fixtures.js';

describe('ReportesService.create()', () => {
  let service: ReportesService;
  let reporteRepo: any;
  let estacaoRepo: any;
  let reputacaoService: any;
  let trensService: any;

  beforeEach(() => {
    reporteRepo = {
      findOne: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn((data) => ({ ...data })),
      save: vi.fn(async (e) => ({ id: 'novo-id', ...e })),
    };
    estacaoRepo = { findOne: vi.fn() };
    reputacaoService = { getPeso: vi.fn().mockReturnValue(1.0) };
    trensService = {
      resolverTrem: vi.fn().mockResolvedValue({
        id: 't-resolvido',
        linha_id: 1,
        sentido: Sentido.RECIFE,
        id_vagao: null,
      }),
    };
    service = new ReportesService(
      reporteRepo,
      estacaoRepo,
      reputacaoService,
      undefined,
      undefined,
      trensService,
    );
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
      )).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
      });
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
      await service.create(
        { tipo: TipoReporte.ESTACAO, estacao_id: 1, status_estacao: StatusEstacao.NORMAL } as any,
        makeUsuario({ reputacao: 60 }),
      );
      expect(reporteRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ confianca: 20 }), // 2.0 × 10
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

  // ---- Regra 3.3.2 & Regra 7.1 ----
  describe('expiração e matching de trem (Regra 7.1)', () => {
    it('TREM resolve trem via TrensService, salva linha_id=null e expira em 5 min', async () => {
      const antes = Date.now();
      const autor = makeUsuario({ reputacao: 20 });

      await service.create(
        {
          tipo: TipoReporte.TREM,
          linha_id: 1,
          sentido: Sentido.RECIFE,
          estacao_id: 1,
          id_vagao: 'TUE 101',
          status_trem: StatusTrem.NORMAL,
        },
        autor,
      );

      expect(trensService.resolverTrem).toHaveBeenCalledWith(
        1,
        Sentido.RECIFE,
        'TUE 101',
        autor,
      );

      const chamada = reporteRepo.save.mock.calls[0][0];
      expect(chamada.trem_id).toBe('t-resolvido');
      expect(chamada.linha_id).toBeNull();

      const delta = chamada.data_hora_expiracao.getTime() - antes;
      expect(delta).toBeGreaterThanOrEqual(5 * 60_000 - 1000);
      expect(delta).toBeLessThanOrEqual(5 * 60_000 + 1000);
    });
  });

  // ---- Regra 3.2.3 ----
  describe('cooldown pós-refutação', () => {
    it('força peso 0.5 se último reporte foi REFUTADO em <15min', async () => {
      reputacaoService.getPeso.mockReturnValue(3.0);
      reporteRepo.findOne
        .mockResolvedValueOnce(null) // duplicata
        .mockResolvedValueOnce(
          makeReporte({
            ativo: false,
            data_hora_criacao: new Date(Date.now() - 5 * 60_000),
          }),
        );

      await service.create(
        { tipo: TipoReporte.ESTACAO, estacao_id: 1, status_estacao: StatusEstacao.NORMAL } as any,
        makeUsuario({ reputacao: 100 }),
      );

      expect(reporteRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ confianca: 5 }), // 0.5 × 10
      );
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
      const salvo = reporteRepo.save.mock.calls[0][0];
      expect(salvo.data_hora_expiracao.getTime()).toBeGreaterThan(
        existente.data_hora_expiracao.getTime(),
      );
    });
  });

  // ---- Decisão do usuário: FECHADA bloqueia TREM ----
  describe('estação FECHADA bloqueia reporte de TREM', () => {
    it('403 se a estação de avistamento está FECHADA', async () => {
      estacaoRepo.findOne.mockResolvedValue(makeEstacao({ id: 1 }));
      (service as any).statusService = {
        getStatusEstacao: vi.fn().mockResolvedValue({
          status: StatusEstacao.FECHADA, confianca: 80,
        }),
      };

      await expect(service.create(
        {
          tipo: TipoReporte.TREM,
          linha_id: 1,
          sentido: Sentido.RECIFE,
          estacao_id: 1,
          status_trem: StatusTrem.NORMAL,
        },
        makeUsuario(),
      )).rejects.toThrow(ForbiddenException);
      expect(trensService.resolverTrem).not.toHaveBeenCalled();
    });

    it('permite reporte de TREM se estação está aberta', async () => {
      estacaoRepo.findOne.mockResolvedValue(makeEstacao({ id: 1 }));
      (service as any).statusService = {
        getStatusEstacao: vi.fn().mockResolvedValue({
          status: StatusEstacao.NORMAL, confianca: 0,
        }),
      };

      await expect(service.create(
        {
          tipo: TipoReporte.TREM,
          linha_id: 1,
          sentido: Sentido.RECIFE,
          estacao_id: 1,
          status_trem: StatusTrem.NORMAL,
        },
        makeUsuario(),
      )).resolves.toBeDefined();
    });
  });
});
