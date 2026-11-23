export function getPeso(reputacao: number): number {
  if (reputacao < 0) return 0.5;
  if (reputacao < 20) return 1.0;
  if (reputacao < 50) return 1.5;
  if (reputacao < 100) return 2.0;
  return 3.0;
}

export const PISO_REPUTACAO = -50;
