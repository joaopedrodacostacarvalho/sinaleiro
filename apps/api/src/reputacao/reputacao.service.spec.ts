import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReputacaoService } from './reputacao.service.js';
import { EventoReputacao } from '@sinaleiro/types/enums';
import { makeUsuario } from '../../test/fixtures.js';

describe('ReputacaoService', () => {
  let service: ReputacaoService;
  let usuarioRepo: any;

  beforeEach(() => {
    usuarioRepo = {
      findOne: vi.fn(),
      save: vi.fn(async (e) => e),
    };
    service = new ReputacaoService(usuarioRepo);
  });

  describe('getPeso() — função de degrau (Regra 2.1.1)', () => {
    it.each([
      [-10, 0.5], [-1, 0.5],
      [0, 1.0], [19, 1.0],
      [20, 1.5], [49, 1.5],
      [50, 2.0], [99, 2.0],
      [100, 3.0], [500, 3.0],
    ])('reputação %i → peso %f', (rep, peso) => {
      expect(service.getPeso(rep)).toBe(peso);
    });
  });

  describe('aplicarEvento()', () => {
    it('REPORTE_CONFIRMADO soma +3', async () => {
      usuarioRepo.findOne.mockResolvedValue(makeUsuario({ reputacao: 10 }));
      const r = await service.aplicarEvento('user-1', EventoReputacao.REPORTE_CONFIRMADO);
      expect(r.reputacao).toBe(13);
      expect(usuarioRepo.save).toHaveBeenCalledOnce();
    });

    it('REPORTE_REFUTADO subtrai -5', async () => {
      usuarioRepo.findOne.mockResolvedValue(makeUsuario({ reputacao: 10 }));
      const r = await service.aplicarEvento('user-1', EventoReputacao.REPORTE_REFUTADO);
      expect(r.reputacao).toBe(5);
    });

    it('CONFIRMOU_REPORTE_REFUTADO subtrai -1', async () => {
      usuarioRepo.findOne.mockResolvedValue(makeUsuario({ reputacao: 5 }));
      const r = await service.aplicarEvento('user-1', EventoReputacao.CONFIRMOU_REPORTE_REFUTADO);
      expect(r.reputacao).toBe(4);
    });

    it('DISCORDOU_REPORTE_CONFIRMADO subtrai -2', async () => {
      usuarioRepo.findOne.mockResolvedValue(makeUsuario({ reputacao: 5 }));
      const r = await service.aplicarEvento('user-1', EventoReputacao.DISCORDOU_REPORTE_CONFIRMADO);
      expect(r.reputacao).toBe(3);
    });

    it('aplica piso de -50 (Regra 2.1.2)', async () => {
      usuarioRepo.findOne.mockResolvedValue(makeUsuario({ reputacao: -48 }));
      const r = await service.aplicarEvento('user-1', EventoReputacao.REPORTE_REFUTADO);
      expect(r.reputacao).toBe(-50);  // -48 - 5 = -53 → piso -50
    });

    it('lança NotFoundException se usuário não existe', async () => {
      usuarioRepo.findOne.mockResolvedValue(null);
      await expect(
        service.aplicarEvento('nao-existe', EventoReputacao.REPORTE_CONFIRMADO),
      ).rejects.toThrow(/não encontrado/i);
    });
  });
});
