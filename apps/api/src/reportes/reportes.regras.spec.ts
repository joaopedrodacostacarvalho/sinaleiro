import { describe, it, expect } from 'vitest';
import {
  calcularExpiracao,
  assertAlvoCoerente,
  calcularConfiancaInicial,
  calcularConfiancaInicialComPeso,
  isDuplicata,
} from './reportes.regras.js';
import {
  Sentido,
  StatusEstacao,
  StatusLinha,
  StatusTrem,
  TipoReporte,
} from '@sinaleiro/types/enums';
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

describe('assertAlvoCoerente() — Regras 3.1 / 7.1', () => {
  it('ESTACAO exige estacao_id e status_estacao', () => {
    expect(() =>
      assertAlvoCoerente({
        tipo: TipoReporte.ESTACAO,
        estacao_id: 1,
        status_estacao: StatusEstacao.LOTADA,
      }),
    ).not.toThrow();
    expect(() =>
      assertAlvoCoerente({
        tipo: TipoReporte.ESTACAO,
        status_estacao: StatusEstacao.LOTADA,
      }),
    ).toThrow();
    expect(() =>
      assertAlvoCoerente({
        tipo: TipoReporte.ESTACAO,
        estacao_id: 1,
      }),
    ).toThrow();
  });

  it('ESTACAO proíbe campos de linha/trem', () => {
    expect(() =>
      assertAlvoCoerente({
        tipo: TipoReporte.ESTACAO,
        estacao_id: 1,
        status_estacao: StatusEstacao.LOTADA,
        linha_id: 1,
      }),
    ).toThrow(/não aceita campos de linha/i);
  });

  it('LINHA exige linha_id e status_linha e proíbe campos de estação/trem', () => {
    expect(() =>
      assertAlvoCoerente({
        tipo: TipoReporte.LINHA,
        linha_id: 1,
        status_linha: StatusLinha.PARALISADA,
      }),
    ).not.toThrow();
    expect(() =>
      assertAlvoCoerente({
        tipo: TipoReporte.LINHA,
        status_linha: StatusLinha.PARALISADA,
      }),
    ).toThrow();
    expect(() =>
      assertAlvoCoerente({
        tipo: TipoReporte.LINHA,
        linha_id: 1,
        status_linha: StatusLinha.PARALISADA,
        estacao_id: 1,
      }),
    ).toThrow(/não aceita campos de estação/i);
  });

  it('TREM exige linha_id, sentido, estacao_id e status_trem (e aceita id_vagao opcional não vazio)', () => {
    expect(() =>
      assertAlvoCoerente({
        tipo: TipoReporte.TREM,
        linha_id: 1,
        sentido: Sentido.RECIFE,
        estacao_id: 1,
        status_trem: StatusTrem.LOTADO,
      }),
    ).not.toThrow();

    expect(() =>
      assertAlvoCoerente({
        tipo: TipoReporte.TREM,
        linha_id: 1,
        sentido: Sentido.RECIFE,
        estacao_id: 1,
        id_vagao: 'TUE 101',
        status_trem: StatusTrem.LOTADO,
      }),
    ).not.toThrow();

    expect(() =>
      assertAlvoCoerente({
        tipo: TipoReporte.TREM,
        estacao_id: 1,
        status_trem: StatusTrem.LOTADO,
      }),
    ).toThrow();
  });

  it('TREM rejeita id_vagao vazio ou apenas espaços e status de estação/linha', () => {
    expect(() =>
      assertAlvoCoerente({
        tipo: TipoReporte.TREM,
        linha_id: 1,
        sentido: Sentido.RECIFE,
        estacao_id: 1,
        id_vagao: '',
        status_trem: StatusTrem.LOTADO,
      }),
    ).toThrow(/id_vagao não pode ser vazio/i);

    expect(() =>
      assertAlvoCoerente({
        tipo: TipoReporte.TREM,
        linha_id: 1,
        sentido: Sentido.RECIFE,
        estacao_id: 1,
        id_vagao: '   ',
        status_trem: StatusTrem.LOTADO,
      }),
    ).toThrow(/id_vagao não pode ser vazio/i);

    expect(() =>
      assertAlvoCoerente({
        tipo: TipoReporte.TREM,
        linha_id: 1,
        sentido: Sentido.RECIFE,
        estacao_id: 1,
        status_trem: StatusTrem.LOTADO,
        status_estacao: StatusEstacao.LOTADA,
      }),
    ).toThrow(/não aceita status_estacao/i);
  });
});

describe('calcularConfiancaInicial() — Regras 3.2.4 / 3.2.5', () => {
  it('usa o peso integral do autor quando está dentro do raio de 2 km', () => {
    expect(calcularConfiancaInicial(makeUsuario({ reputacao: 100 }), 50)).toBe(30);
    expect(calcularConfiancaInicial(makeUsuario({ reputacao: 0 }), 100)).toBe(10);
  });

  it('zera confiança se usuário está a >2km da estação (Regra 3.2.5)', () => {
    expect(calcularConfiancaInicial(makeUsuario({ reputacao: 100 }), 3_000)).toBe(0);
  });

  it('mantém peso na fronteira exata de 2.000 m', () => {
    expect(calcularConfiancaInicial(makeUsuario({ reputacao: 100 }), 2_000)).toBe(30);
    expect(calcularConfiancaInicial(makeUsuario({ reputacao: 100 }), 2_001)).toBe(0);
  });

  it('sem localização (null) aplica fator redutor de 0.5 com arredondamento', () => {
    expect(calcularConfiancaInicial(makeUsuario({ reputacao: 100 }), null)).toBe(15);
    expect(calcularConfiancaInicial(makeUsuario({ reputacao: 0 }), null)).toBe(5);
    expect(calcularConfiancaInicialComPeso(1.5, null)).toBe(8);
  });
});

describe('isDuplicata() — Regra 3.2.1', () => {
  it('detecta mesmo alvo e status dentro de 5 min', () => {
    const agora = new Date('2026-01-01T12:05:00Z');
    const existente = makeReporte({
      data_hora_criacao: new Date('2026-01-01T12:04:00Z'),
    });
    expect(isDuplicata(existente, agora)).toBe(true);
  });

  it('não é duplicata ao atingir exatamente 5 min ou mais', () => {
    const agora = new Date('2026-01-01T12:05:00Z');
    const noLimite = makeReporte({
      data_hora_criacao: new Date('2026-01-01T12:00:00Z'),
    });
    const aposLimite = makeReporte({
      data_hora_criacao: new Date('2026-01-01T11:59:00Z'),
    });
    expect(isDuplicata(noLimite, agora)).toBe(false);
    expect(isDuplicata(aposLimite, agora)).toBe(false);
  });
});
