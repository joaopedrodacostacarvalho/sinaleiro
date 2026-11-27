import { useEffect, useState } from "react";
import type { EstacaoProxima } from "../api/types";
import { fetchEstacoesProximas } from "../api/estacoes";

export function useEstacoesProximas(
  coords: { lat: number, lng: number } | null
): { proximas: EstacaoProxima[]; loading: boolean; error: string | null } {
  const [proximas, setProximas] = useState<EstacaoProxima[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!coords) return;

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchEstacoesProximas(coords.lat, coords.lng, 3)
      .then(setProximas)
      .catch((e) => {
        if (e.name !== 'AbortError') {
          setError(e.message ?? 'Erro ao buscar estações');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });
  }, [coords]);

  return { proximas, loading, error };
}
