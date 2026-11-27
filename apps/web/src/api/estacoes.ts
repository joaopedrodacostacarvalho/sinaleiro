import { apiFetch } from "./client";
import type { EstacaoProxima } from "./types";

export async function fetchEstacoesProximas(
  lat: number,
  lng: number,
  limite = 3,
): Promise<EstacaoProxima[]> {
  return apiFetch<EstacaoProxima[]>(
    `/estacoes/proximas?lat=${lat}&lng=${lng}&limite=${limite}`,
  );
}

