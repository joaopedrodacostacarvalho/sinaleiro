import { describe, it, expect } from 'vitest';
import { haversineMetros } from './haversine.js';

describe('haversineMetros', () => {
  it('retorna 0 para a mesma coordenada', () => {
    expect(haversineMetros(
      { lat: -8.067794, lng: -34.885139 },
      { lat: -8.067794, lng: -34.885139 },
    )).toBe(0);
  });

  it('calcula distância entre Recife e Joana Bezerra (~1.3 km)', () => {
    // Aproximação de acordo com dados reais do Metrorec
    const d = haversineMetros(
      { lat: -8.067794, lng: -34.885139 },  // Recife
      { lat: -8.073611, lng: -34.896389 },  // Joana Bezerra
    );
    expect(d).toBeGreaterThan(1100);
    expect(d).toBeLessThan(1500);
  });

  it('é simétrico', () => {
    const a = { lat: -8.05, lng: -34.9 };
    const b = { lat: -8.10, lng: -35.0 };
    expect(haversineMetros(a, b)).toBeCloseTo(haversineMetros(b, a), 6);
  });

  it('retorna valor em metros (não km)', () => {
    const d = haversineMetros(
      { lat: -8.067794, lng: -34.885139 },
      { lat: -8.023889, lng: -35.030833 },  // Recife → Camaragibe
    );
    expect(d).toBeGreaterThan(10_000);
  });
});
