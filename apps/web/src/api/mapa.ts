import { apiFetch } from './client';
import type { StatusEstacao, StatusLinha, StatusTrem } from './types';

export interface EstacaoMapa {
  id: number;
  nome: string;
  latitude: number;
  longitude: number;
  ordem: number;
  status_efetivo: StatusEstacao;
  confianca_efetiva: number;
}

export interface TremMapa {
  id: string;
  id_vagao: string | null;
  linha_id: number;
  sentido: string;
  status_efetivo: StatusTrem;
  confianca_efetiva: number;
  ultima_atualizacao: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface LinhaMapa {
  id: number;
  nome: string;
  cor: string;
  status_efetivo: StatusLinha;
  sentidos: string[];
  estacoes: EstacaoMapa[];
  trens: TremMapa[];
}

export interface MapaResponse {
  linhas: LinhaMapa[];
  atualizado_em: string;
}

export interface PerfilPassageiro {
  usuario: {
    id: string;
    nome: string;
    email: string;
    reputacao: number;
  };
  peso: number;
}

export async function fetchMapa(): Promise<MapaResponse> {
  const raw = await apiFetch<Record<string, unknown>>('/mapa');

  const rawLinhas = Array.isArray(raw?.linhas) ? (raw.linhas as LinhaMapa[]) : [];
  const rawEstacoes = Array.isArray(raw?.estacoes)
    ? (raw.estacoes as (EstacaoMapa & { linha_id?: number })[])
    : [];
  const rawTrens = Array.isArray(raw?.trens) ? (raw.trens as TremMapa[]) : [];

  const linhasNormalizadas: LinhaMapa[] = rawLinhas.map((linha) => {
    const estacoesDaLinha = (
      Array.isArray(linha.estacoes)
        ? linha.estacoes
        : rawEstacoes.filter((e) => e.linha_id === linha.id)
    ).map((est) => {
      const statusObj =
        est.status_efetivo && typeof est.status_efetivo === 'object'
          ? (est.status_efetivo as Record<string, unknown>)
          : null;

      return {
        ...est,
        confianca_efetiva:
          typeof est.confianca_efetiva === 'number'
            ? est.confianca_efetiva
            : typeof statusObj?.confianca === 'number'
              ? statusObj.confianca
              : 0,
      };
    });

    const trensDaLinha = Array.isArray(linha.trens)
      ? linha.trens
      : rawTrens.filter((t) => t.linha_id === linha.id);

    return {
      ...linha,
      sentidos: Array.isArray(linha.sentidos) ? linha.sentidos : [],
      estacoes: estacoesDaLinha,
      trens: trensDaLinha,
    };
  });

  return {
    linhas: linhasNormalizadas,
    atualizado_em:
      typeof raw?.atualizado_em === 'string'
        ? raw.atualizado_em
        : new Date().toISOString(),
  };
}

export function syncPerfilPassageiro(): Promise<PerfilPassageiro> {
  return apiFetch<PerfilPassageiro>('/auth/sync', { method: 'POST' });
}
