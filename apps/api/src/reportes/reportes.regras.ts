import { BadRequestException } from '@nestjs/common';
import {
  Sentido,
  StatusEstacao,
  StatusLinha,
  StatusTrem,
  TipoReporte,
} from '@sinaleiro/types/enums';
import { getPeso } from '../reputacao/reputacao.regras.js';

const MINUTOS_EXPIRACAO: Record<TipoReporte, number> = {
  [TipoReporte.ESTACAO]: 30,
  [TipoReporte.LINHA]: 30,
  [TipoReporte.TREM]: 5,
};

const JANELA_DUPLICATA_MS = 5 * 60_000;
const RAIO_REPORTE_METROS = 2_000;
const FATOR_CONFIANCA_SEM_GPS = 0.5;

export function calcularExpiracao(tipo: TipoReporte, agora: Date = new Date()): Date {
  return new Date(agora.getTime() + MINUTOS_EXPIRACAO[tipo] * 60_000);
}

export function isDuplicata(
  reporte: { data_hora_criacao: Date },
  agora: Date,
): boolean {
  return agora.getTime() - reporte.data_hora_criacao.getTime() < JANELA_DUPLICATA_MS;
}

export function calcularConfiancaInicialComPeso(
  peso: number,
  distanciaMetros: number | null,
): number {
  if (distanciaMetros === null) {
    return Math.round(peso * 10 * FATOR_CONFIANCA_SEM_GPS);
  }
  if (distanciaMetros > RAIO_REPORTE_METROS) return 0;
  return Math.round(peso * 10);
}

export function calcularConfiancaInicial(
  usuario: { reputacao: number },
  distanciaMetros: number | null,
): number {
  return calcularConfiancaInicialComPeso(getPeso(usuario.reputacao), distanciaMetros);
}

export interface AlvoReporte {
  tipo: TipoReporte;
  estacao_id?: number;
  linha_id?: number;
  sentido?: Sentido;
  id_vagao?: string;
  status_estacao?: StatusEstacao;
  status_linha?: StatusLinha;
  status_trem?: StatusTrem;
}

export function assertAlvoCoerente(dto: AlvoReporte): void {
  const p = {
    estacao_id: dto.estacao_id != null,
    linha_id: dto.linha_id != null,
    sentido: dto.sentido != null,
    id_vagao: dto.id_vagao != null,
    status_estacao: dto.status_estacao != null,
    status_linha: dto.status_linha != null,
    status_trem: dto.status_trem != null,
  };

  if (dto.tipo === TipoReporte.ESTACAO) {
    if (!p.estacao_id || !p.status_estacao) {
      throw new BadRequestException('Reporte de estação exige estacao_id e status_estacao');
    }
    if (p.linha_id || p.sentido || p.id_vagao || p.status_linha || p.status_trem) {
      throw new BadRequestException('Reporte de estação não aceita campos de linha/trem');
    }
  }

  if (dto.tipo === TipoReporte.LINHA) {
    if (!p.linha_id || !p.status_linha) {
      throw new BadRequestException('Reporte de linha exige linha_id e status_linha');
    }
    if (p.estacao_id || p.sentido || p.id_vagao || p.status_estacao || p.status_trem) {
      throw new BadRequestException('Reporte de linha não aceita campos de estação/trem');
    }
  }

  if (dto.tipo === TipoReporte.TREM) {
    if (!p.linha_id || !p.sentido || !p.estacao_id || !p.status_trem) {
      throw new BadRequestException(
        'Reporte de trem exige linha_id, sentido, estacao_id (local do avistamento) e status_trem',
      );
    }
    if (p.status_estacao || p.status_linha) {
      throw new BadRequestException(
        'Reporte de trem não aceita status_estacao/status_linha',
      );
    }
    if (p.id_vagao && dto.id_vagao!.trim().length === 0) {
      throw new BadRequestException('id_vagao não pode ser vazio');
    }
  }
}
