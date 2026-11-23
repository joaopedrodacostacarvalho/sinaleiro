import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { TrensService } from './trens.service.js';
import { Sentido } from '@sinaleiro/types/enums';
import { makeReporte, makeUsuario } from '../../test/fixtures.js';

describe('TrensService.resolverTrem() — Regra 7.1', () => {
  let service: TrensService;
  let tremRepo: any;
  let reporteRepo: any;

  beforeEach(() => {
    tremRepo = {
      find: vi.fn().mockResolvedValue([]),
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn((d) => ({ id: 'novo-trem', ...d })),
      save: vi.fn(async (e) => e),
    };
    reporteRepo = {
      findOne: vi.fn().mockResolvedValue(null),
      find: vi.fn().mockResolvedValue([]),
    };
    service = new TrensService(tremRepo, reporteRepo);
  });

  it('usa id_vagao quando preenchido (match exato)', async () => {
    const trem = { id: 't-1', id_vagao: 'TUE 101', linha_id: 1, sentido: Sentido.RECIFE };
    tremRepo.findOne.mockResolvedValue(trem);
    const r = await service.resolverTrem(1, Sentido.RECIFE, 'TUE 101', makeUsuario({ reputacao: 0 }));
    expect(r.id).toBe('t-1');
  });

  it('retorna único candidato se só há 1', async () => {
    tremRepo.find.mockResolvedValue([
      { id: 't-1', linha_id: 1, sentido: Sentido.RECIFE },
    ]);
    const r = await service.resolverTrem(1, Sentido.RECIFE, null, makeUsuario({ reputacao: 50 }));
    expect(r.id).toBe('t-1');
  });

  it('escolhe o com último reporte mais antigo (round-robin)', async () => {
    tremRepo.find.mockResolvedValue([
      { id: 't-1', linha_id: 1, sentido: Sentido.RECIFE },
      { id: 't-2', linha_id: 1, sentido: Sentido.RECIFE },
    ]);
    // t-1 tem reporte recente, t-2 está sem reporte → deve escolher t-2
    reporteRepo.find.mockImplementation(async (opts: any) => {
      if (opts?.where?.trem_id === 't-1') return [makeReporte({ data_hora_criacao: new Date() })];
      return [];
    });
    const r = await service.resolverTrem(1, Sentido.RECIFE, null, makeUsuario({ reputacao: 50 }));
    expect(r.id).toBe('t-2');
  });

  it('cria trem novo se nenhum candidato e autor tem reputação ≥ 10 (Regra 7.2.2)', async () => {
    tremRepo.find.mockResolvedValue([]);
    const r = await service.resolverTrem(1, Sentido.RECIFE, null, makeUsuario({ reputacao: 10 }));
    expect(r.id).toBe('novo-trem');
    expect(tremRepo.save).toHaveBeenCalled();
  });

  it('403 se precisa criar trem e reputação < 10 (Regra 7.2.2)', async () => {
    tremRepo.find.mockResolvedValue([]);
    await expect(service.resolverTrem(1, Sentido.RECIFE, null, makeUsuario({ reputacao: 5 })))
      .rejects.toThrow(ForbiddenException);
  });
});

describe('TrensService.listarAtivos() — Regra 7.2.1', () => {
  let service: TrensService;
  let tremRepo: any;
  let reporteRepo: any;

  beforeEach(() => {
    tremRepo = { find: vi.fn().mockResolvedValue([]) };
    reporteRepo = { find: vi.fn().mockResolvedValue([]) };
    service = new TrensService(tremRepo, reporteRepo);
  });

  it('exclui trens sem reportes há > 20min', async () => {
    reporteRepo.find.mockResolvedValue([
      // t-1 tem reporte recente
      { trem_id: 't-1', data_hora_criacao: new Date() },
      // t-2 só tem reportes antigos
      { trem_id: 't-2', data_hora_criacao: new Date(Date.now() - 25 * 60_000) },
    ]);
    const r = await service.listarAtivos();
    expect(r.map((t: any) => t.trem_id)).toEqual(['t-1']);
  });
});
