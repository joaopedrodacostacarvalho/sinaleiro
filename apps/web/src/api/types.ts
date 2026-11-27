import {
  StatusEstacao,
  StatusLinha,
  StatusTrem,
  TipoConfirmacao,
  TipoReporte,
} from '@sinaleiro/types/enums';

export {
  StatusEstacao,
  StatusLinha,
  StatusTrem,
  TipoConfirmacao,
  TipoReporte,
};

export interface Estacao {
  id: number;
  nome: string;
  latitude: number;
  longitude: number;
  linha_id: number;
}

export interface EstacaoProxima {
  estacao: Estacao;
  distancia_metros: number;
  na_estacao: boolean;
  fora_de_alcance: boolean;
}

export interface Reporte {
  id: string;
  tipo: TipoReporte;
  usuario_id: string;
  estacao_id: number | null;
  linha_id: number | null;
  trem_id: string | null;
  status_estacao: StatusEstacao | null;
  status_linha: StatusLinha | null;
  status_trem: StatusTrem | null;
  data_hora_criacao: string;
  data_hora_expiracao: string;
  confianca: number;
  ativo: boolean;
}

export interface CreateReportePayload {
  tipo: TipoReporte;
  estacao_id?: number;
  linha_id?: number;
  sentido?: string;
  id_vagao?: string;
  status_estacao?: StatusEstacao;
  status_linha?: StatusLinha;
  status_trem?: StatusTrem;
  latitude?: number;
  longitude?: number;
}
