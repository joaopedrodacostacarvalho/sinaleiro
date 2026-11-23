import { describe, it, expect } from 'vitest';
import {
  limiaresPorTipo, decidirReporte, efeitoReputacao,
} from './confirmacoes.regras.js';
import {
  StatusEstacao, TipoConfirmacao, TipoReporte, EventoReputacao,
} from '@sinaleiro/types/enums';
import { makeConfirmacao, makeReporte } from '../../test/fixtures.js';

describe('limiaresPorTipo() — Regra 4.2.2', () => {
  it.each([
    [TipoReporte.ESTACAO, 2.0, 1.5],
    [TipoReporte.LINHA, 2.0, 1.5],
    [TipoReporte.TREM, 1.5, 1.0],
  ])('%s → confirmado %f, refutado %f', (tipo, conf, ref) => {
    expect(limiaresPorTipo(tipo)).toEqual({ confirmado: conf, refutado: ref });
  });
});

describe('decidirReporte() — Regras 4.2.2 / 4.2.3 / 4.2.4', () => {
  const conf = (uid: string, w: number): any =>
    makeConfirmacao({ usuario_id: uid, tipo: TipoConfirmacao.CONFIRMAR, peso: w });
  const disc = (uid: string, w: number): any =>
    makeConfirmacao({ usuario_id: uid, tipo: TipoConfirmacao.DISCORDAR, peso: w });

  it('PENDENTE se não atinge nenhum limiar', () => {
    expect(decidirReporte(makeReporte({ tipo: TipoReporte.ESTACAO }), [conf('u2', 1.0)])
      .decisao).toBe('PENDENTE');
  });

  it('CONFIRMADO para ESTACAO quando W_confirm ≥ 2.0', () => {
    expect(decidirReporte(makeReporte({ tipo: TipoReporte.ESTACAO }), [conf('u2', 1.0), conf('u3', 1.0)])
      .decisao).toBe('CONFIRMADO');
  });

  it('REFUTADO para ESTACAO quando W_discord ≥ W_confirm + 1.5', () => {
    expect(decidirReporte(makeReporte({ tipo: TipoReporte.ESTACAO }), [
      conf('u2', 1.0), disc('u3', 1.5), disc('u4', 1.5),
    ]).decisao).toBe('REFUTADO');
  });

  it('CONFIRMADO para TREM com limiar menor (1.5)', () => {
    expect(decidirReporte(makeReporte({ tipo: TipoReporte.TREM }), [conf('u2', 1.0), conf('u3', 1.0)])
      .decisao).toBe('CONFIRMADO');
  });

  it('nunca retorna CONFIRMADO e REFUTADO simultaneamente', () => {
    const d = decidirReporte(makeReporte({ tipo: TipoReporte.ESTACAO }), [
      conf('u2', 3.0), disc('u3', 0.5),
    ]);
    expect(d.decisao).toBe('CONFIRMADO');
  });
});

describe('efeitoReputacao() — Regras 2.2', () => {
  const reporte = makeReporte({ usuario_id: 'autor' });

  it('CONFIRMADO → +3 para o autor', () => {
    expect(efeitoReputacao(reporte, 'CONFIRMADO')).toEqual([
      { usuarioId: 'autor', evento: EventoReputacao.REPORTE_CONFIRMADO },
    ]);
  });

  it('REFUTADO → -5 para o autor, -1 para cada confirmador', () => {
    const confs = [
      makeConfirmacao({ usuario_id: 'u2', tipo: TipoConfirmacao.CONFIRMAR }),
      makeConfirmacao({ usuario_id: 'u3', tipo: TipoConfirmacao.DISCORDAR }),
      makeConfirmacao({ usuario_id: 'u4', tipo: TipoConfirmacao.CONFIRMAR }),
    ];
    const efeitos = efeitoReputacao(reporte, 'REFUTADO', confs);
    expect(efeitos).toContainEqual({ usuarioId: 'autor', evento: EventoReputacao.REPORTE_REFUTADO });
    expect(efeitos).toContainEqual({ usuarioId: 'u2', evento: EventoReputacao.CONFIRMOU_REPORTE_REFUTADO });
    expect(efeitos).toContainEqual({ usuarioId: 'u4', evento: EventoReputacao.CONFIRMOU_REPORTE_REFUTADO });
    expect(efeitos).not.toContainEqual(expect.objectContaining({ usuarioId: 'u3' }));
  });

  it('CONFIRMADO → -2 para cada discordanciador', () => {
    const confs = [
      makeConfirmacao({ usuario_id: 'u2', tipo: TipoConfirmacao.CONFIRMAR }),
      makeConfirmacao({ usuario_id: 'u3', tipo: TipoConfirmacao.DISCORDAR }),
    ];
    const efeitos = efeitoReputacao(reporte, 'CONFIRMADO', confs);
    expect(efeitos).toContainEqual({ usuarioId: 'u3', evento: EventoReputacao.DISCORDOU_REPORTE_CONFIRMADO });
  });
});
