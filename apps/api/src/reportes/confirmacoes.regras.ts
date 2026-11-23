import {
  EventoReputacao,
  TipoConfirmacao,
  TipoReporte,
} from '@sinaleiro/types/enums';

export type DecisaoReporte = 'CONFIRMADO' | 'REFUTADO' | 'PENDENTE';

export interface LimiaresDecisao {
  confirmado: number;
  refutado: number;
}

export interface ConfirmacaoPonderada {
  usuario_id: string;
  tipo: TipoConfirmacao;
  peso?: number;
}

export interface ResultadoDecisao {
  decisao: DecisaoReporte;
  wConfirm: number;
  wDiscord: number;
}

export interface EfeitoReputacaoItem {
  usuarioId: string;
  evento: EventoReputacao;
}

const LIMIARES_POR_TIPO: Record<TipoReporte, LimiaresDecisao> = {
  [TipoReporte.ESTACAO]: { confirmado: 2.0, refutado: 1.5 },
  [TipoReporte.LINHA]: { confirmado: 2.0, refutado: 1.5 },
  [TipoReporte.TREM]: { confirmado: 1.5, refutado: 1.0 },
};

export function limiaresPorTipo(tipo: TipoReporte): LimiaresDecisao {
  return LIMIARES_POR_TIPO[tipo];
}

export function decidirReporte(
  reporte: { tipo: TipoReporte },
  confirmacoes: ConfirmacaoPonderada[],
): ResultadoDecisao {
  const wConfirm = confirmacoes
    .filter((c) => c.tipo === TipoConfirmacao.CONFIRMAR)
    .reduce((acc, c) => acc + (c.peso ?? 1.0), 0);

  const wDiscord = confirmacoes
    .filter((c) => c.tipo === TipoConfirmacao.DISCORDAR)
    .reduce((acc, c) => acc + (c.peso ?? 1.0), 0);

  const limiares = limiaresPorTipo(reporte.tipo);

  let decisao: DecisaoReporte = 'PENDENTE';
  if (wDiscord >= wConfirm + limiares.refutado) {
    decisao = 'REFUTADO';
  } else if (wConfirm >= limiares.confirmado) {
    decisao = 'CONFIRMADO';
  }

  return { decisao, wConfirm, wDiscord };
}

export function efeitoReputacao(
  reporte: { usuario_id: string },
  decisao: DecisaoReporte,
  confirmacoes: Array<{ usuario_id: string; tipo: TipoConfirmacao }> = [],
): EfeitoReputacaoItem[] {
  if (decisao === 'PENDENTE') {
    return [];
  }

  if (decisao === 'CONFIRMADO') {
    const efeitos: EfeitoReputacaoItem[] = [
      {
        usuarioId: reporte.usuario_id,
        evento: EventoReputacao.REPORTE_CONFIRMADO,
      },
    ];

    for (const c of confirmacoes) {
      if (c.tipo === TipoConfirmacao.DISCORDAR) {
        efeitos.push({
          usuarioId: c.usuario_id,
          evento: EventoReputacao.DISCORDOU_REPORTE_CONFIRMADO,
        });
      }
    }

    return efeitos;
  }

  const efeitos: EfeitoReputacaoItem[] = [
    {
      usuarioId: reporte.usuario_id,
      evento: EventoReputacao.REPORTE_REFUTADO,
    },
  ];

  for (const c of confirmacoes) {
    if (c.tipo === TipoConfirmacao.CONFIRMAR) {
      efeitos.push({
        usuarioId: c.usuario_id,
        evento: EventoReputacao.CONFIRMOU_REPORTE_REFUTADO,
      });
    }
  }

  return efeitos;
}
