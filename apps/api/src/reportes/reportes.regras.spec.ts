import { describe, it, expect } from 'vitest';
import {
  calcularExpiracao, assertAlvoCoerente, calcularConfiancaInicial, isDuplicata,
} from './reportes.regras.js';
import { StatusEstacao, StatusLinha, StatusTrem, TipoReporte } from '@sinaleiro/types/enums';
import { makeReporte, makeUsuario } from '../../test/fixtures.js';

describe('calcularExpiracao() — Regras 3.3.2', () => {
  const agora = new Date('2026-01-01T12:00:00Z');

  it('ESTACAO expira em 30 min', () => {
    const exp = calcularExpiracao(TipoReporte.ESTACAO, agora);
    expect(exp.getTime() - agora.getTime()).toBe(30 * 60_000);
  });

  it('LINHA expira em 30 min', () => {
    const exp = calcularExpiracao(TipoReporte.LINHA, agora);
    expect(exp.getTime() - agora.getTime()).toBe(30 * 60_000);
  });

  it('TREM expira em 5 min (não 10)', () => {
    const exp = calcularExpiracao(TipoReporte.TREM, agora);
    expect(exp.getTime() - agora.getTime()).toBe(5 * 60_000);
  });
});

describe('assertAlvoCoerente() — Regras 3.1', () => {
  it('ESTACAO exige estacao_id e status_estacao', () => {
    expect(() => assertAlvoCoerente({
      tipo: TipoReporte.ESTACAO, estacao_id: 1, status_estacao: StatusEstacao.LOTADA,
    })).not.toThrow();
    expect(() => assertAlvoCoerente({
      tipo: TipoReporte.ESTACAO, status_estacao: StatusEstacao.LOTADA,
    })).toThrow();
    expect(() => assertAlvoCoerente({
      tipo: TipoReporte.ESTACAO, estacao_id: 1,
    })).toThrow();
  });

  it('ESTACAO proíbe campos de linha/trem', () => {
    expect(() => assertAlvoCoerente({
      tipo: TipoReporte.ESTACAO, estacao_id: 1, status_estacao: StatusEstacao.LOTADA,
      linha_id: 1,
    })).toThrow(/não aceita campos de linha/i);
  });

  it('LINHA exige linha_id e status_linha', () => {
    expect(() => assertAlvoCoerente({
      tipo: TipoReporte.LINHA, linha_id: 1, status_linha: StatusLinha.PARALISADA,
    })).not.toThrow();
    expect(() => assertAlvoCoerente({
      tipo: TipoReporte.LINHA, status_linha: StatusLinha.PARALISADA,
    })).toThrow();
  });

  it('TREM exige trem_id, estacao_id e status_trem', () => {
    expect(() => assertAlvoCoerente({
      tipo: TipoReporte.TREM, trem_id: 't-1', estacao_id: 1, status_trem: StatusTrem.LOTADO,
    })).not.toThrow();
    expect(() => assertAlvoCoerente({
      tipo: TipoReporte.TREM, estacao_id: 1, status_trem: StatusTrem.LOTADO,
    })).toThrow();
  });
});

describe('calcularConfiancaInicial() — Regras 3.2.4 / 3.2.5', () => {
  it('usa o peso do autor como confiança inicial', () => {
    expect(calcularConfiancaInicial(makeUsuario({ reputacao: 100 }), 50)).toBe(30);
    expect(calcularConfiancaInicial(makeUsuario({ reputacao: 0 }), 100)).toBe(10);
  });

  it('zera confiança se usuário está a >2km da estação (Regra 3.2.5)', () => {
    expect(calcularConfiancaInicial(makeUsuario({ reputacao: 100 }), 3_000)).toBe(0);
  });

  it('mantém peso se usuário está a ≤2km', () => {
    expect(calcularConfiancaInicial(makeUsuario({ reputacao: 100 }), 1_999)).toBe(30);
  });

  it('sem localização (null) mantém o peso', () => {
    expect(calcularConfiancaInicial(makeUsuario({ reputacao: 100 }), null)).toBe(30);
  });
});

describe('isDuplicata() — Regra 3.2.1', () => {
  it('detecta mesmo alvo e status dentro de 5 min', () => {
    const existente = makeReporte({ data_hora_criacao: new Date(Date.now() - 60_000) });
    expect(isDuplicata(existente, new Date())).toBe(true);
  });

  it('não é duplicata se já passou de 5 min', () => {
    const existente = makeReporte({ data_hora_criacao: new Date(Date.now() - 6 * 60_000) });
    expect(isDuplicata(existente, new Date())).toBe(false);
  });
});
