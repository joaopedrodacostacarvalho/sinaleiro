import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EstacoesService } from './estacoes.service.js';
import { makeEstacao } from '../../test/fixtures.js';

describe('EstacoesService.getProximas()', () => {
  let service: EstacoesService;
  let estacaoRepo: any;

  beforeEach(() => {
    estacaoRepo = {
      find: vi.fn().mockResolvedValue([
        makeEstacao({ id: 1, nome: 'Recife', latitude: -8.067794, longitude: -34.885139 }),
        makeEstacao({ id: 2, nome: 'Joana Bezerra', latitude: -8.073611, longitude: -34.896389 }),
        makeEstacao({ id: 3, nome: 'Afogados', latitude: -8.077222, longitude: -34.909444 }),
        makeEstacao({ id: 4, nome: 'Jaboatão', latitude: -8.111944, longitude: -35.022778 }),
      ]),
    };
    service = new EstacoesService(estacaoRepo);
  });

  it('retorna as 3 mais próximas em ordem', async () => {
    const r = await service.getProximas(-8.0680, -34.8850); // perto de Recife
    expect(r.map(x => x.estacao.id)).toEqual([1, 2, 3]);
    expect(r[0].distancia_metros).toBeLessThan(100);
    expect(r[0].distancia_metros).toBeLessThan(r[1].distancia_metros);
  });

  it('inclui distância em metros', async () => {
    const r = await service.getProximas(-8.0680, -34.8850);
    expect(typeof r[0].distancia_metros).toBe('number');
    expect(r[0].distancia_metros).toBeGreaterThan(0);
  });

  it('flag na_estacao=true se mais próxima ≤ 300m (Regra 6.4)', async () => {
    const r = await service.getProximas(-8.067794, -34.885139);
    expect(r[0].na_estacao).toBe(true);
    expect(r[0].fora_de_alcance).toBe(false);
  });

  it('flag fora_de_alcance=true se mais próxima > 1.5km (Regra 6.3)', async () => {
    // ponto no meio do oceano
    const r = await service.getProximas(-8.0, -34.7);
    expect(r[0].fora_de_alcance).toBe(true);
  });

  it('respeita limite customizado', async () => {
    const r = await service.getProximas(-8.0680, -34.8850, 1);
    expect(r).toHaveLength(1);
  });

  it('limite padrão é 3', async () => {
    const r = await service.getProximas(-8.0680, -34.8850);
    expect(r).toHaveLength(3);
  });
});
