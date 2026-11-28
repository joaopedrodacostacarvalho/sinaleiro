import { Logger } from '@nestjs/common';
import { In, LessThanOrEqual } from 'typeorm';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from 'vitest';
import { TipoReporte } from '@sinaleiro/types/enums';

import { ReportesExpiracaoService } from './reportes-expiracao.service.js';
import { makeReporte } from '../../test/fixtures.js';

describe('ReportesExpiracaoService', () => {
  let service: ReportesExpiracaoService;
  let reporteRepo: {
    find: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let statusService: {
    invalidarAlvo: ReturnType<typeof vi.fn>;
  };
  let eventEmitter: {
    emit: ReturnType<typeof vi.fn>;
  };
  let errorSpy: MockInstance;

  beforeEach(() => {
    reporteRepo = {
      find: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({ affected: 0 }),
    };
    statusService = {
      invalidarAlvo: vi.fn().mockResolvedValue(undefined),
    };
    eventEmitter = {
      emit: vi.fn(),
    };

    errorSpy = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    service = new ReportesExpiracaoService(
      reporteRepo as any,
      statusService as any,
      eventEmitter as any,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('encerrarExpirados()', () => {
    it('retorna 0 e não executa update, invalidação ou SSE quando não há reportes vencidos', async () => {
      const agora = new Date('2026-11-28T15:00:00.000Z');
      reporteRepo.find.mockResolvedValueOnce([]);

      const total = await service.encerrarExpirados(agora);

      expect(total).toBe(0);
      expect(reporteRepo.find).toHaveBeenCalledWith({
        where: {
          ativo: true,
          data_hora_expiracao: LessThanOrEqual(agora),
        },
        select: {
          id: true,
          tipo: true,
          estacao_id: true,
          linha_id: true,
          trem_id: true,
        },
      });
      expect(reporteRepo.update).not.toHaveBeenCalled();
      expect(statusService.invalidarAlvo).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('encerra reportes vencidos marcando apenas ativo=false sem zerar confiança', async () => {
      const agora = new Date('2026-11-28T15:00:00.000Z');
      const vencidos = [
        makeReporte({
          id: 'rep-estacao-1',
          tipo: TipoReporte.ESTACAO,
          estacao_id: 10,
          confianca: 20,
          ativo: true,
          data_hora_expiracao: new Date('2026-11-28T14:59:00.000Z'),
        }),
        makeReporte({
          id: 'rep-trem-1',
          tipo: TipoReporte.TREM,
          estacao_id: 10,
          trem_id: 'trem-uuid-1',
          confianca: 15,
          ativo: true,
          data_hora_expiracao: new Date('2026-11-28T15:00:00.000Z'),
        }),
      ];
      reporteRepo.find.mockResolvedValueOnce(vencidos);

      const total = await service.encerrarExpirados(agora);

      expect(total).toBe(2);
      expect(reporteRepo.update).toHaveBeenCalledTimes(1);

      const [criterio, payloadUpdate] = reporteRepo.update.mock.calls[0];
      expect(criterio).toEqual({
        id: In(['rep-estacao-1', 'rep-trem-1']),
        ativo: true,
      });
      expect(payloadUpdate).toEqual({ ativo: false });
      expect(payloadUpdate).not.toHaveProperty('confianca');
    });

    it('invalida o cache de cada alvo encerrado e emite evento SSE mapa.atualizado', async () => {
      const agora = new Date('2026-11-28T15:05:00.000Z');
      const repEstacao = makeReporte({
        id: 'rep-1',
        tipo: TipoReporte.ESTACAO,
        estacao_id: 4,
      });
      const repLinha = makeReporte({
        id: 'rep-2',
        tipo: TipoReporte.LINHA,
        estacao_id: null,
        linha_id: 1,
      });
      const repTrem = makeReporte({
        id: 'rep-3',
        tipo: TipoReporte.TREM,
        estacao_id: 4,
        trem_id: 'trem-9',
      });

      reporteRepo.find.mockResolvedValueOnce([repEstacao, repLinha, repTrem]);

      await service.encerrarExpirados(agora);

      expect(statusService.invalidarAlvo).toHaveBeenCalledTimes(3);
      expect(statusService.invalidarAlvo).toHaveBeenNthCalledWith(1, repEstacao);
      expect(statusService.invalidarAlvo).toHaveBeenNthCalledWith(2, repLinha);
      expect(statusService.invalidarAlvo).toHaveBeenNthCalledWith(3, repTrem);

      expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
      expect(eventEmitter.emit).toHaveBeenCalledWith('mapa.atualizado', {
        tipo: 'mapa_atualizado',
        timestamp: agora.toISOString(),
      });
    });

    it('bloqueia execuções concorrentes via lock de reentrância e libera após finalizar', async () => {
      let resolverBusca!: (valor: unknown[]) => void;
      reporteRepo.find.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolverBusca = resolve;
          }),
      );

      const primeiraExecucao = service.encerrarExpirados();
      const segundaExecucaoConcorrente = await service.encerrarExpirados();

      expect(segundaExecucaoConcorrente).toBe(0);
      expect(reporteRepo.find).toHaveBeenCalledTimes(1);

      resolverBusca([makeReporte({ id: 'rep-lock-1' })]);
      await expect(primeiraExecucao).resolves.toBe(1);

      reporteRepo.find.mockResolvedValueOnce([]);
      await expect(service.encerrarExpirados()).resolves.toBe(0);
      expect(reporteRepo.find).toHaveBeenCalledTimes(2);
    });

    it('captura erros do banco, registra log e libera o lock para execuções futuras', async () => {
      reporteRepo.find.mockRejectedValueOnce(new Error('Falha de conexão PG'));

      const resultado = await service.encerrarExpirados();

      expect(resultado).toBe(0);
      expect(errorSpy).toHaveBeenCalledWith(
        'Falha ao encerrar reportes expirados',
        expect.any(Error),
      );
      expect(eventEmitter.emit).not.toHaveBeenCalled();

      reporteRepo.find.mockResolvedValueOnce([makeReporte({ id: 'rep-ok' })]);
      await expect(service.encerrarExpirados()).resolves.toBe(1);
    });
  });

  describe('ciclo de vida (onModuleInit / onModuleDestroy)', () => {
    const envOriginal = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = envOriginal;
    });

    it('não inicia o timer automático quando NODE_ENV === "test"', async () => {
      vi.useFakeTimers();
      process.env.NODE_ENV = 'test';

      service.onModuleInit();
      await vi.advanceTimersByTimeAsync(60_000);

      expect(reporteRepo.find).not.toHaveBeenCalled();
    });

    it('agenda varredura a cada 30 segundos fora do ambiente de teste e limpa no destroy', async () => {
      vi.useFakeTimers();
      process.env.NODE_ENV = 'production';

      service.onModuleInit();
      await vi.advanceTimersByTimeAsync(30_000);
      expect(reporteRepo.find).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(30_000);
      expect(reporteRepo.find).toHaveBeenCalledTimes(2);

      service.onModuleDestroy();
      await vi.advanceTimersByTimeAsync(60_000);
      expect(reporteRepo.find).toHaveBeenCalledTimes(2);
    });
  });
});
