export * from './enums.js';

export type OffsetMinutosAvistamento = 0 | 5 | 10 | 15;

export interface MapaStreamPayload {
  tipo: 'mapa_atualizado' | 'ping';
  origem?: 'reporte_criado' | 'reporte_confirmado' | 'trem_avistado';
  timestamp: string;
}

export type CategoriaEventoProduto =
  | 'uso'
  | 'web_vital'
  | 'erro_cliente'
  | 'viabilidade';

export interface EventoProdutoInput {
  nome: string;
  categoria: CategoriaEventoProduto;
  sessao_id?: string;
  propriedades?: Record<string, unknown>;
}
