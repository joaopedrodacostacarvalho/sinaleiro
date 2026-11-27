import { apiFetch } from "./client";
import type { CreateReportePayload, Reporte, TipoConfirmacao } from "./types";

export async function criarReporte(
  payload: CreateReportePayload,
): Promise<Reporte> {
  return apiFetch<Reporte>(
    '/reportes', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function confirmarReporte(
  reporteId: string,
  tipo: TipoConfirmacao,
  coords?: { latitude: number, longitude: number },
): Promise<unknown> {
  return apiFetch(`/reportes/${reporteId}/confirmacoes`, {
    method: 'POST',
    body: JSON.stringify({ tipo, ...coords })
  });
}

export async function fetchReportesAtivos(
  alvo?: 'estacao' | 'linha' | 'trem',
  id?: string | number,
): Promise<Reporte[]> {
  const query = alvo && id ? `?alvo=${alvo}&id=${id}` : '';
  return apiFetch<Reporte[]>(`/reportes${query}`);
}
