import { useEffect, useState } from 'react';
import type { EstacaoProxima } from '../api/types';
import { fetchEstacoesProximas } from '../api/estacoes';

interface FetchEstacoesState {
  resolvedKey: string | null;
  proximas: EstacaoProxima[];
  error: string | null;
}

export function useEstacoesProximas(
  coords: { lat: number; lng: number } | null,
): { proximas: EstacaoProxima[]; loading: boolean; error: string | null } {
  const [state, setState] = useState<FetchEstacoesState>({
    resolvedKey: null,
    proximas: [],
    error: null,
  });

  const lat = coords?.lat;
  const lng = coords?.lng;
  const coordsKey = lat != null && lng != null ? `${lat},${lng}` : null;

  useEffect(() => {
    if (lat == null || lng == null || coordsKey === null) return;

    let cancelado = false;

    fetchEstacoesProximas(lat, lng, 3)
      .then((lista) => {
        if (!cancelado) {
          setState({ resolvedKey: coordsKey, proximas: lista, error: null });
        }
      })
      .catch((e: unknown) => {
        if (!cancelado) {
          const isAbort = e instanceof Error && e.name === 'AbortError';
          if (!isAbort) {
            const msg =
              e instanceof Error ? e.message : 'Erro ao buscar estações';
            setState({ resolvedKey: coordsKey, proximas: [], error: msg });
          }
        }
      });

    return () => {
      cancelado = true;
    };
  }, [lat, lng, coordsKey]);

  if (!coordsKey) {
    return { proximas: [], loading: false, error: null };
  }

  const carregando = state.resolvedKey !== coordsKey;
  return {
    proximas: carregando ? [] : state.proximas,
    loading: carregando,
    error: carregando ? null : state.error,
  };
}
