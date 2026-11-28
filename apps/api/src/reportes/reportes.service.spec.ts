import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ReportesService } from './reportes.service.js';
import {
  Sentido,
  StatusEstacao,
  StatusLinha,
  StatusTrem,
  TipoConfirmacao,
  TipoReporte,
} from '@sinaleiro/types/enums';
import { makeEstacao, makeReporte, makeUsuario } from '../../test/fixtures.js';

describe('ReportesService.create()', () => {
  let service: ReportesService;
  let reporteRepo: any;
  let estacaoRepo: any;
  let reputacaoService: any;
  let statusService: any;
  let confirmacaoRepo: any;
  let trensService: any;
  let tremRepo: any;
  let eventEmitter: any;

  beforeEach(() => {
    reporteRepo = {
      findOne: vi.fn().mockResolvedValue(null),
      find: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn((data) => ({ ...data })),
      save: vi.fn(async (e) => ({ id: 'novo-id', ...e })),
      remove: vi.fn(async (e) => e),
    };
    estacaoRepo = {
      findOne: vi.fn().mockResolvedValue(
        makeEstacao({
          id: 1,
          linha_id: 1,
          latitude: -8.0744,
          longitude: -34.8964,
        }),
      ),
      find: vi.fn().mockResolvedValue([]),
    };
    reputacaoService = { getPeso: vi.fn().mockReturnValue(1.0) };
    statusService = {
      getStatusEstacao: vi.fn().mockResolvedValue({
        status: StatusEstacao.NORMAL,
        confianca: 0,
      }),
      invalidarAlvo: vi.fn().mockResolvedValue(undefined),
    };
    confirmacaoRepo = {
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn((data) => ({ ...data })),
      save: vi.fn(async (e) => ({ id: 'conf-id', ...e })),
    };
    trensService = {
      resolverTrem: vi.fn().mockResolvedValue({
        id: 't-resolvido',
        linha_id: 1,
        sentido: Sentido.RECIFE,
        id_vagao: null,
      }),
    };
    tremRepo = {
      save: vi.fn(async (e) => e),
    };
    eventEmitter = {
      emit: vi.fn(),
    };

    service = new ReportesService(
      reporteRepo,
      estacaoRepo,
      reputacaoService,
      statusService,
      confirmacaoRepo,
      trensService,
      tremRepo,
      eventEmitter,
    );
  });

  // ---- Regra 3.1 ----
  describe('validação de alvo e existência de estação', () => {
    it('rejeita ESTACAO sem status_estacao', async () => {
      await expect(
        service.create(
          { tipo: TipoReporte.ESTACAO, estacao_id: 1 } as any,
          makeUsuario(),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejeita TREM com id_vagao contendo apenas espaços', async () => {
      await expect(
        service.create(
          {
            tipo: TipoReporte.TREM,
            linha_id: 1,
            sentido: Sentido.RECIFE,
            estacao_id: 1,
            id_vagao: '   ',
            status_trem: StatusTrem.NORMAL,
          },
          makeUsuario(),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('lança 404 quando estacao_id não existe no banco', async () => {
      estacaoRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.create(
          {
            tipo: TipoReporte.ESTACAO,
            estacao_id: 999,
            status_estacao: StatusEstacao.NORMAL,
          } as any,
          makeUsuario(),
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejeita TREM quando a estação informada pertence a outra linha', async () => {
      estacaoRepo.findOne.mockResolvedValueOnce(
        makeEstacao({ id: 20, linha_id: 2 }),
      );

      await expect(
        service.create(
          {
            tipo: TipoReporte.TREM,
            linha_id: 1,
            sentido: Sentido.RECIFE,
            estacao_id: 20,
            status_trem: StatusTrem.NORMAL,
          },
          makeUsuario(),
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ---- Regra 3.2.1 ----
  describe('anti-duplicata (5 min)', () => {
    it('409 se mesmo alvo+status em <5min', async () => {
      reporteRepo.findOne.mockResolvedValue(
        makeReporte({
          usuario_id: 'user-1',
          data_hora_criacao: new Date(Date.now() - 60_000),
        }),
      );
      await expect(
        service.create(
          {
            tipo: TipoReporte.ESTACAO,
            estacao_id: 1,
            status_estacao: StatusEstacao.NORMAL,
          } as any,
          makeUsuario({ id: 'user-1' }),
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('permite novo reporte do mesmo autor após janela de 5 min', async () => {
      reporteRepo.findOne
        .mockResolvedValueOnce(
          makeReporte({
            usuario_id: 'user-1',
            data_hora_criacao: new Date(Date.now() - 6 * 60_000),
            data_hora_expiracao: new Date(Date.now() + 24 * 60_000),
          }),
        )
        .mockResolvedValueOnce(null); // cooldown

      await expect(
        service.create(
          {
            tipo: TipoReporte.ESTACAO,
            estacao_id: 1,
            status_estacao: StatusEstacao.NORMAL,
          } as any,
          makeUsuario({ id: 'user-1' }),
        ),
      ).resolves.toBeDefined();
    });
  });

  // ---- Regra 3.2.2 ----
  describe('rate limit (10/hora)', () => {
    it('429 se já tem 10 reportes na última hora', async () => {
      reporteRepo.count.mockResolvedValue(10);
      await expect(
        service.create(
          {
            tipo: TipoReporte.ESTACAO,
            estacao_id: 1,
            status_estacao: StatusEstacao.NORMAL,
          } as any,
          makeUsuario(),
        ),
      ).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
      });
    });

    it('permite 10 reportes/hora', async () => {
      reporteRepo.count.mockResolvedValue(9);
      await expect(
        service.create(
          {
            tipo: TipoReporte.ESTACAO,
            estacao_id: 1,
            status_estacao: StatusEstacao.NORMAL,
          } as any,
          makeUsuario(),
        ),
      ).resolves.toBeDefined();
    });
  });

  // ---- Regra 3.2.4 & 3.2.5 ----
  describe('confiança inicial e verificação de GPS (estação e linha)', () => {
    it('usa o peso integral do autor quando GPS está dentro do raio de 2.000 m', async () => {
      reputacaoService.getPeso.mockReturnValue(2.0);
      await service.create(
        {
          tipo: TipoReporte.ESTACAO,
          estacao_id: 1,
          status_estacao: StatusEstacao.NORMAL,
          latitude: -8.0744,
          longitude: -34.8964,
        } as any,
        makeUsuario({ reputacao: 60 }),
      );
      expect(reporteRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ confianca: 20 }), // 2.0 × 10
      );
    });

    it('aplica fator 0.5 na confiança quando GPS não é informado', async () => {
      reputacaoService.getPeso.mockReturnValue(2.0);
      await service.create(
        {
          tipo: TipoReporte.ESTACAO,
          estacao_id: 1,
          status_estacao: StatusEstacao.NORMAL,
        } as any,
        makeUsuario({ reputacao: 60 }),
      );
      expect(reporteRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ confianca: 10 }), // round(2.0 × 10 × 0.5)
      );
    });

    it('ignora confianca do DTO (removida no CreateReporteDto)', async () => {
      await service.create(
        {
          tipo: TipoReporte.ESTACAO,
          estacao_id: 1,
          status_estacao: StatusEstacao.NORMAL,
          confianca: 999,
        } as any,
        makeUsuario({ reputacao: 0 }),
      );
      expect(reporteRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ confianca: 5 }), // round(1.0 × 10 × 0.5) sem GPS
      );
    });

    it('zera confiança em ESTACAO quando GPS está a > 2.000 m', async () => {
      reputacaoService.getPeso.mockReturnValue(2.0);
      await service.create(
        {
          tipo: TipoReporte.ESTACAO,
          estacao_id: 1,
          status_estacao: StatusEstacao.LOTADA,
          latitude: -8.13,
          longitude: -34.92,
        } as any,
        makeUsuario(),
      );

      expect(reporteRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ confianca: 0 }),
      );
    });

    it('calcula menor distância até estações da linha em reporte de LINHA com GPS', async () => {
      reputacaoService.getPeso.mockReturnValue(1.5);
      estacaoRepo.find.mockResolvedValueOnce([
        makeEstacao({
          id: 21,
          linha_id: 2,
          latitude: -8.1186,
          longitude: -34.9094,
        }),
        makeEstacao({
          id: 22,
          linha_id: 2,
          latitude: -8.0964,
          longitude: -34.9142,
        }),
      ]);

      // Próximo à estação 22 (~140 m)
      await service.create(
        {
          tipo: TipoReporte.LINHA,
          linha_id: 2,
          status_linha: StatusLinha.ATENCAO,
          latitude: -8.0975,
          longitude: -34.9148,
        } as any,
        makeUsuario(),
      );

      expect(estacaoRepo.find).toHaveBeenCalledWith({ where: { linha_id: 2 } });
      expect(reporteRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          confianca: 15,
          estacao_id: null,
          trem_id: null,
        }),
      );
    });

    it('aplica fator 0.5 em reporte de LINHA sem GPS', async () => {
      reputacaoService.getPeso.mockReturnValue(1.4);

      await service.create(
        {
          tipo: TipoReporte.LINHA,
          linha_id: 2,
          status_linha: StatusLinha.ATENCAO,
        } as any,
        makeUsuario(),
      );

      expect(reporteRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ confianca: 7 }), // round(1.4 × 10 × 0.5)
      );
    });

    it('zera confiança em reporte de LINHA quando todas as estações da linha estão a > 2.000 m', async () => {
      reputacaoService.getPeso.mockReturnValue(1.5);
      estacaoRepo.find.mockResolvedValueOnce([
        makeEstacao({
          id: 21,
          linha_id: 2,
          latitude: -8.1186,
          longitude: -34.9094,
        }),
      ]);

      await service.create(
        {
          tipo: TipoReporte.LINHA,
          linha_id: 2,
          status_linha: StatusLinha.PARALISADA,
          latitude: -8.01,
          longitude: -34.85,
        } as any,
        makeUsuario(),
      );

      expect(reporteRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ confianca: 0 }),
      );
    });
  });

  // ---- Regra 3.3.2 & Regra 7.1 ----
  describe('expiração, normalização e matching de trem (Regra 7.1)', () => {
    it('TREM normaliza id_vagao, resolve trem via TrensService, salva linha_id=null e expira em 5 min', async () => {
      const antes = Date.now();
      const autor = makeUsuario({ reputacao: 20 });

      await service.create(
        {
          tipo: TipoReporte.TREM,
          linha_id: 1,
          sentido: Sentido.RECIFE,
          estacao_id: 1,
          id_vagao: '  TUE 101  ',
          status_trem: StatusTrem.NORMAL,
          offset_minutos: 5,
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

      expect(tremRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 't-resolvido',
          estacao_atual_id: 1,
        }),
      );
      const tremSalvo = tremRepo.save.mock.calls[0][0];
      const deltaAvistamento = antes - tremSalvo.ultimo_avistamento_em.getTime();
      expect(deltaAvistamento).toBeGreaterThanOrEqual(5 * 60_000 - 1000);
      expect(deltaAvistamento).toBeLessThanOrEqual(5 * 60_000 + 1000);
    });

    it('não sobrescreve posição do trem quando o reporte é bloqueado por duplicata (409)', async () => {
      reporteRepo.findOne.mockResolvedValueOnce(
        makeReporte({
          tipo: TipoReporte.TREM,
          usuario_id: 'user-1',
          trem_id: 't-resolvido',
          data_hora_criacao: new Date(Date.now() - 30_000),
          data_hora_expiracao: new Date(Date.now() + 4 * 60_000),
        }),
      );

      await expect(
        service.create(
          {
            tipo: TipoReporte.TREM,
            linha_id: 1,
            sentido: Sentido.RECIFE,
            estacao_id: 1,
            status_trem: StatusTrem.NORMAL,
          },
          makeUsuario({ id: 'user-1' }),
        ),
      ).rejects.toThrow(ConflictException);

      expect(tremRepo.save).not.toHaveBeenCalled();
    });
  });

  // ---- Regra 3.2.3 ----
  describe('cooldown pós-refutação', () => {
    it('força peso 0.5 se último reporte foi REFUTADO (ativo=false e confianca<=0) em <15min', async () => {
      reputacaoService.getPeso.mockReturnValue(3.0);
      reporteRepo.findOne
        .mockResolvedValueOnce(null) // duplicata
        .mockResolvedValueOnce(
          makeReporte({
            ativo: false,
            confianca: 0,
            data_hora_criacao: new Date(Date.now() - 5 * 60_000),
          }),
        );

      await service.create(
        {
          tipo: TipoReporte.ESTACAO,
          estacao_id: 1,
          status_estacao: StatusEstacao.NORMAL,
          latitude: -8.0744,
          longitude: -34.8964,
        } as any,
        makeUsuario({ reputacao: 100 }),
      );

      expect(reporteRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ confianca: 5 }), // 0.5 × 10 com GPS válido
      );
    });

    it('aplica peso 0.5 acumulado com fator 0.5 quando em cooldown e sem GPS', async () => {
      reputacaoService.getPeso.mockReturnValue(3.0);
      reporteRepo.findOne
        .mockResolvedValueOnce(null) // duplicata
        .mockResolvedValueOnce(
          makeReporte({
            ativo: false,
            confianca: 0,
            data_hora_criacao: new Date(Date.now() - 5 * 60_000),
          }),
        );

      await service.create(
        {
          tipo: TipoReporte.ESTACAO,
          estacao_id: 1,
          status_estacao: StatusEstacao.NORMAL,
        } as any,
        makeUsuario({ reputacao: 100 }),
      );

      expect(reporteRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ confianca: 3 }), // round(0.5 × 10 × 0.5)
      );
    });

    it('não aplica penalidade quando não há reporte com confianca <= 0 nos últimos 15 min', async () => {
      reputacaoService.getPeso.mockReturnValue(3.0);
      reporteRepo.findOne
        .mockResolvedValueOnce(null) // duplicata
        .mockResolvedValueOnce(null); // nenhum refutado

      await service.create(
        {
          tipo: TipoReporte.ESTACAO,
          estacao_id: 1,
          status_estacao: StatusEstacao.NORMAL,
          latitude: -8.0744,
          longitude: -34.8964,
        } as any,
        makeUsuario({ reputacao: 100 }),
      );

      expect(reporteRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ confianca: 30 }), // 3.0 × 10
      );
    });
  });

  // ---- Regra 3.3.3 ----
  describe('renovação por reconfirmação', () => {
    it('reaproveita reporte existente do mesmo alvo+status, registra confirmação e estende expiração', async () => {
      reputacaoService.getPeso.mockReturnValue(1.5);
      const existente = makeReporte({
        id: 'r-existente',
        ativo: true,
        data_hora_expiracao: new Date(Date.now() + 5 * 60_000),
        usuario_id: 'outro',
      });
      reporteRepo.findOne.mockResolvedValue(existente);

      await service.create(
        {
          tipo: TipoReporte.ESTACAO,
          estacao_id: 1,
          status_estacao: StatusEstacao.NORMAL,
        } as any,
        makeUsuario({ id: 'user-2', reputacao: 50 }),
      );

      expect(confirmacaoRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          reporte_id: 'r-existente',
          usuario_id: 'user-2',
          tipo: TipoConfirmacao.CONFIRMAR,
          peso: 1.5,
        }),
      );
      expect(confirmacaoRepo.save).toHaveBeenCalledTimes(1);

      expect(reporteRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'r-existente' }),
      );
      const salvo = reporteRepo.save.mock.calls[0][0];
      expect(salvo.data_hora_expiracao.getTime()).toBeGreaterThan(
        existente.data_hora_expiracao.getTime(),
      );
      expect(statusService.invalidarAlvo).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'mapa.atualizado',
        expect.objectContaining({ origem: 'reporte_confirmado' }),
      );
    });
  });

  // ---- Decisão do usuário: FECHADA bloqueia TREM ----
  describe('estação FECHADA bloqueia reporte de TREM', () => {
    it('403 se a estação de avistamento está FECHADA', async () => {
      estacaoRepo.findOne.mockResolvedValue(makeEstacao({ id: 1 }));
      statusService.getStatusEstacao.mockResolvedValue({
        status: StatusEstacao.FECHADA,
        confianca: 80,
      });

      await expect(
        service.create(
          {
            tipo: TipoReporte.TREM,
            linha_id: 1,
            sentido: Sentido.RECIFE,
            estacao_id: 1,
            status_trem: StatusTrem.NORMAL,
          },
          makeUsuario(),
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(trensService.resolverTrem).not.toHaveBeenCalled();
    });

    it('permite reporte de TREM se estação está aberta', async () => {
      estacaoRepo.findOne.mockResolvedValue(makeEstacao({ id: 1 }));
      statusService.getStatusEstacao.mockResolvedValue({
        status: StatusEstacao.NORMAL,
        confianca: 0,
      });

      await expect(
        service.create(
          {
            tipo: TipoReporte.TREM,
            linha_id: 1,
            sentido: Sentido.RECIFE,
            estacao_id: 1,
            status_trem: StatusTrem.NORMAL,
          },
          makeUsuario(),
        ),
      ).resolves.toBeDefined();
    });
  });
  describe('autoria em update() e remove()', () => {
    it('bloqueia update com 403 se o usuário não for o autor do reporte', async () => {
      reporteRepo.findOne.mockResolvedValueOnce(
        makeReporte({ id: 'rep-1', usuario_id: 'autor-original', ativo: true }),
      );

      await expect(
        service.update(
          'rep-1',
          { status_estacao: StatusEstacao.LOTADA },
          makeUsuario({ id: 'outro-usuario' }),
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(reporteRepo.save).not.toHaveBeenCalled();
    });

    it('permite que o próprio autor atualize o status de um reporte ativo', async () => {
      reporteRepo.findOne.mockResolvedValueOnce(
        makeReporte({
          id: 'rep-1',
          tipo: TipoReporte.ESTACAO,
          usuario_id: 'autor-original',
          status_estacao: StatusEstacao.NORMAL,
          ativo: true,
        }),
      );

      const atualizado = await service.update(
        'rep-1',
        { status_estacao: StatusEstacao.LOTADA },
        makeUsuario({ id: 'autor-original' }),
      );

      expect(atualizado.status_estacao).toBe(StatusEstacao.LOTADA);
      expect(reporteRepo.save).toHaveBeenCalledTimes(1);
    });

    it('bloqueia remove com 403 se o usuário não for o autor do reporte', async () => {
      reporteRepo.findOne.mockResolvedValueOnce(
        makeReporte({ id: 'rep-1', usuario_id: 'autor-original' }),
      );

      await expect(
        service.remove('rep-1', makeUsuario({ id: 'outro-usuario' })),
      ).rejects.toThrow(ForbiddenException);
      expect(reporteRepo.remove).not.toHaveBeenCalled();
    });
  });
});
