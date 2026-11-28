import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfirmacoesService } from './confirmacoes.service.js';
import { TipoConfirmacao, TipoReporte } from '@sinaleiro/types/enums';
import {
  makeConfirmacao,
  makeEstacao,
  makeReporte,
  makeUsuario,
} from '../../test/fixtures.js';

describe('ConfirmacoesService.confirmar()', () => {
  let service: ConfirmacoesService;
  let reporteRepo: any;
  let confirmacaoRepo: any;
  let estacaoRepo: any;
  let reputacaoService: any;
  let statusService: any;

  beforeEach(() => {
    reporteRepo = {
      findOne: vi.fn(),
      save: vi.fn(async (e) => e),
    };
    confirmacaoRepo = {
      findOne: vi.fn().mockResolvedValue(null),
      find: vi.fn().mockResolvedValue([]),
      create: vi.fn((d) => ({ ...d })),
      save: vi.fn(async (e) => e),
    };
    estacaoRepo = {
      findOne: vi.fn().mockResolvedValue(makeEstacao({ id: 1 })),
    };
    reputacaoService = {
      getPeso: vi.fn().mockReturnValue(1.0),
      aplicarEvento: vi.fn(),
    };
    statusService = {};
    service = new ConfirmacoesService(
      reporteRepo,
      confirmacaoRepo,
      estacaoRepo,
      reputacaoService,
      statusService,
    );
  });

  // ---- Regra 4.1.1 ----
  it('403 se o autor tenta confirmar o próprio reporte', async () => {
    reporteRepo.findOne.mockResolvedValue(
      makeReporte({ usuario_id: 'autor' }),
    );
    await expect(
      service.confirmar(
        'reporte-1',
        TipoConfirmacao.CONFIRMAR,
        makeUsuario({ id: 'autor' }),
        null,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  // ---- Regra 4.1.2 ----
  it('409 se usuário já confirmou este reporte', async () => {
    reporteRepo.findOne.mockResolvedValue(
      makeReporte({ usuario_id: 'autor' }),
    );
    confirmacaoRepo.findOne.mockResolvedValue(
      makeConfirmacao({ usuario_id: 'user-2' }),
    );
    await expect(
      service.confirmar(
        'reporte-1',
        TipoConfirmacao.CONFIRMAR,
        makeUsuario({ id: 'user-2' }),
        null,
      ),
    ).rejects.toThrow(ConflictException);
  });

  // ---- Regra 4.1.3 ----
  it('400 se reporte já expirou', async () => {
    reporteRepo.findOne.mockResolvedValue(
      makeReporte({
        usuario_id: 'autor',
        data_hora_expiracao: new Date(Date.now() - 60_000),
      }),
    );
    await expect(
      service.confirmar(
        'reporte-1',
        TipoConfirmacao.CONFIRMAR,
        makeUsuario({ id: 'user-2' }),
        null,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  // ---- Regra 4.1.4 ----
  it('400 se usuário está longe do alvo (ESTACAO, >2km)', async () => {
    reporteRepo.findOne.mockResolvedValue(
      makeReporte({
        tipo: TipoReporte.ESTACAO,
        usuario_id: 'autor',
        estacao_id: 1,
      }),
    );
    await expect(
      service.confirmar(
        'reporte-1',
        TipoConfirmacao.CONFIRMAR,
        makeUsuario({ id: 'user-2' }),
        { lat: -8.15, lng: -35.0 },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('permite confirmação de ESTACAO dentro de ≤2km', async () => {
    reporteRepo.findOne.mockResolvedValue(
      makeReporte({
        tipo: TipoReporte.ESTACAO,
        usuario_id: 'autor',
        estacao_id: 1,
      }),
    );
    await expect(
      service.confirmar(
        'reporte-1',
        TipoConfirmacao.CONFIRMAR,
        makeUsuario({ id: 'user-2' }),
        { lat: -8.068, lng: -34.885 },
      ),
    ).resolves.toBeDefined();
  });

  it('permite confirmação de LINHA sem geolocalização', async () => {
    reporteRepo.findOne.mockResolvedValue(
      makeReporte({
        tipo: TipoReporte.LINHA,
        usuario_id: 'autor',
        linha_id: 1,
      }),
    );
    await expect(
      service.confirmar(
        'reporte-1',
        TipoConfirmacao.CONFIRMAR,
        makeUsuario({ id: 'user-2' }),
        null,
      ),
    ).resolves.toBeDefined();
  });

  // ---- Regras 4.2.3 / 4.2.4: efeitos ----
  it('aplica +3 ao autor quando CONFIRMADO', async () => {
    reporteRepo.findOne.mockResolvedValue(
      makeReporte({
        id: 'r1',
        tipo: TipoReporte.ESTACAO,
        usuario_id: 'autor',
      }),
    );
    confirmacaoRepo.find.mockResolvedValue([
      makeConfirmacao({ usuario_id: 'u2', tipo: TipoConfirmacao.CONFIRMAR }),
      makeConfirmacao({ usuario_id: 'u3', tipo: TipoConfirmacao.CONFIRMAR }),
    ]);
    await service.confirmar(
      'r1',
      TipoConfirmacao.CONFIRMAR,
      makeUsuario({ id: 'user-2' }),
      null,
    );
    expect(reputacaoService.aplicarEvento).toHaveBeenCalledWith(
      'autor',
      expect.stringMatching(/REPORTE_CONFIRMADO/),
    );
  });

  it('aplica -5 ao autor e -1 aos confirmadores quando REFUTADO', async () => {
    reporteRepo.findOne.mockResolvedValue(
      makeReporte({
        id: 'r1',
        tipo: TipoReporte.ESTACAO,
        usuario_id: 'autor',
      }),
    );
    confirmacaoRepo.find.mockResolvedValue([
      makeConfirmacao({ usuario_id: 'u2', tipo: TipoConfirmacao.CONFIRMAR }),
      makeConfirmacao({ usuario_id: 'u3', tipo: TipoConfirmacao.DISCORDAR }),
      makeConfirmacao({ usuario_id: 'u4', tipo: TipoConfirmacao.DISCORDAR }),
    ]);
    await service.confirmar(
      'r1',
      TipoConfirmacao.DISCORDAR,
      makeUsuario({ id: 'user-2' }),
      null,
    );
    expect(reputacaoService.aplicarEvento).toHaveBeenCalledWith(
      'autor',
      expect.stringMatching(/REFUTADO/),
    );
    expect(reputacaoService.aplicarEvento).toHaveBeenCalledWith(
      'u2',
      expect.stringMatching(/CONFIRMOU_REPORTE_REFUTADO/),
    );
  });

  it('marca reporte como inativo e zera confiança quando REFUTADO', async () => {
    reporteRepo.findOne.mockResolvedValue(
      makeReporte({
        id: 'r1',
        ativo: true,
        confianca: 20,
        tipo: TipoReporte.ESTACAO,
        usuario_id: 'autor',
      }),
    );
    confirmacaoRepo.find.mockResolvedValue([
      makeConfirmacao({ usuario_id: 'u2', tipo: TipoConfirmacao.DISCORDAR }),
      makeConfirmacao({ usuario_id: 'u3', tipo: TipoConfirmacao.DISCORDAR }),
    ]);
    await service.confirmar(
      'r1',
      TipoConfirmacao.DISCORDAR,
      makeUsuario({ id: 'user-2' }),
      null,
    );
    expect(reporteRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ ativo: false, confianca: 0 }),
    );
  });

  it('não aplica efeito duplicado (uma vez só)', async () => {
    const reporte = makeReporte({
      tipo: TipoReporte.ESTACAO,
      usuario_id: 'autor',
    });
    reporte.confianca = 50;
    reporteRepo.findOne.mockResolvedValue(reporte);
    confirmacaoRepo.find.mockResolvedValue([
      makeConfirmacao({ usuario_id: 'u2', tipo: TipoConfirmacao.CONFIRMAR }),
      makeConfirmacao({ usuario_id: 'u3', tipo: TipoConfirmacao.CONFIRMAR }),
    ]);
    await service.confirmar(
      'r1',
      TipoConfirmacao.CONFIRMAR,
      makeUsuario({ id: 'user-2' }),
      null,
    );
    expect(reputacaoService.aplicarEvento).not.toHaveBeenCalled();
  });
});
