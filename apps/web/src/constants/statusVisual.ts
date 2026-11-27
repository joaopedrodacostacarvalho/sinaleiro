import { StatusEstacao, StatusLinha, StatusTrem } from '../api/types';

export type StatusIconKey =
  | 'normal'
  | 'atencao'
  | 'paralisada'
  | 'lotada'
  | 'fechada'
  | 'atraso'
  | 'parado'
  | 'ar_condicionado'
  | 'avariado';

export interface StatusVisualConfig {
  label: string;
  shortLabel: string;
  iconKey: StatusIconKey;
  color: string;
  bgColor: string;
  borderColor: string;
}

export const VISUAL_STATUS_ESTACAO: Record<StatusEstacao, StatusVisualConfig> = {
  [StatusEstacao.NORMAL]: {
    label: 'Normal',
    shortLabel: 'Normal',
    iconKey: 'normal',
    color: '#15803d',
    bgColor: '#f0fdf4',
    borderColor: '#86efac',
  },
  [StatusEstacao.ATENCAO]: {
    label: 'Atenção',
    shortLabel: 'Atenção',
    iconKey: 'atencao',
    color: '#a16207',
    bgColor: '#fefce8',
    borderColor: '#fde047',
  },
  [StatusEstacao.PARALISADA]: {
    label: 'Paralisada',
    shortLabel: 'Paralisada',
    iconKey: 'paralisada',
    color: '#b91c1c',
    bgColor: '#fef2f2',
    borderColor: '#fca5a5',
  },
  [StatusEstacao.LOTADA]: {
    label: 'Lotada',
    shortLabel: 'Lotada',
    iconKey: 'lotada',
    color: '#c2410c',
    bgColor: '#fff7ed',
    borderColor: '#fdba74',
  },
  [StatusEstacao.FECHADA]: {
    label: 'Fechada',
    shortLabel: 'Fechada',
    iconKey: 'fechada',
    color: '#374151',
    bgColor: '#f3f4f6',
    borderColor: '#d1d5db',
  },
};

export const VISUAL_STATUS_LINHA: Record<StatusLinha, StatusVisualConfig> = {
  [StatusLinha.NORMAL]: {
    label: 'Operação normal',
    shortLabel: 'Normal',
    iconKey: 'normal',
    color: '#15803d',
    bgColor: '#f0fdf4',
    borderColor: '#86efac',
  },
  [StatusLinha.ATENCAO]: {
    label: 'Velocidade reduzida / Atenção',
    shortLabel: 'Atenção',
    iconKey: 'atencao',
    color: '#a16207',
    bgColor: '#fefce8',
    borderColor: '#fde047',
  },
  [StatusLinha.PARALISADA]: {
    label: 'Linha paralisada',
    shortLabel: 'Paralisada',
    iconKey: 'paralisada',
    color: '#b91c1c',
    bgColor: '#fef2f2',
    borderColor: '#fca5a5',
  },
};

export const VISUAL_STATUS_TREM: Record<StatusTrem, StatusVisualConfig> = {
  [StatusTrem.NORMAL]: {
    label: 'Normal',
    shortLabel: 'Normal',
    iconKey: 'normal',
    color: '#15803d',
    bgColor: '#f0fdf4',
    borderColor: '#86efac',
  },
  [StatusTrem.ATRASO]: {
    label: 'Atraso',
    shortLabel: 'Atraso',
    iconKey: 'atraso',
    color: '#a16207',
    bgColor: '#fefce8',
    borderColor: '#fde047',
  },
  [StatusTrem.PARADO]: {
    label: 'Parado na via',
    shortLabel: 'Parado',
    iconKey: 'parado',
    color: '#b91c1c',
    bgColor: '#fef2f2',
    borderColor: '#fca5a5',
  },
  [StatusTrem.LOTADO]: {
    label: 'Lotado',
    shortLabel: 'Lotado',
    iconKey: 'lotada',
    color: '#c2410c',
    bgColor: '#fff7ed',
    borderColor: '#fdba74',
  },
  [StatusTrem.AR_CONDICIONADO_QUEBRADO]: {
    label: 'Ar-condicionado quebrado',
    shortLabel: 'Sem A/C',
    iconKey: 'ar_condicionado',
    color: '#0369a1',
    bgColor: '#f0f9ff',
    borderColor: '#7dd3fc',
  },
  [StatusTrem.AVARIADO]: {
    label: 'Avariado / Recolhido',
    shortLabel: 'Avariado',
    iconKey: 'avariado',
    color: '#7e22ce',
    bgColor: '#faf5ff',
    borderColor: '#d8b4fe',
  },
};

export const CORES_LINHA_METROREC: Record<string, string> = {
  'Centro-1': '#dc2626',
  'Centro-2': '#f97316',
  Sul: '#2563eb',
};

function extrairChaveStatus(raw: unknown, fallback: string): string {
  if (typeof raw === 'string' && raw.trim()) {
    return raw.trim().toLowerCase();
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const candidato = obj.status ?? obj.valor ?? obj.nome;
    if (typeof candidato === 'string' && candidato.trim()) {
      return candidato.trim().toLowerCase();
    }
  }
  return fallback;
}

export function getVisualEstacao(status?: unknown): StatusVisualConfig {
  const key = extrairChaveStatus(status, StatusEstacao.NORMAL) as StatusEstacao;
  return VISUAL_STATUS_ESTACAO[key] ?? VISUAL_STATUS_ESTACAO[StatusEstacao.NORMAL];
}

export function getVisualLinha(status?: unknown): StatusVisualConfig {
  const key = extrairChaveStatus(status, StatusLinha.NORMAL) as StatusLinha;
  return VISUAL_STATUS_LINHA[key] ?? VISUAL_STATUS_LINHA[StatusLinha.NORMAL];
}

export function getVisualTrem(status?: unknown): StatusVisualConfig {
  const key = extrairChaveStatus(status, StatusTrem.NORMAL) as StatusTrem;
  return VISUAL_STATUS_TREM[key] ?? VISUAL_STATUS_TREM[StatusTrem.NORMAL];
}
