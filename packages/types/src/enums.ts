export enum Sentido {
  IDA = 'IDA',
  VOLTA = 'VOLTA',
}

export enum TipoReporte {
  ESTACAO = 'ESTACAO',
  LINHA = 'LINHA',
  TREM = 'TREM',
}

export enum StatusEstacao {
  NORMAL = 'NORMAL',
  LOTADA = 'LOTADA',
  FECHADA = 'FECHADA',
}

export enum StatusLinha {
  OPERACAO_NORMAL = 'OPERACAO_NORMAL',
  VELOCIDADE_REDUZIDA = 'VELOCIDADE_REDUZIDA',
  PARALISADA = 'PARALISADA',
}

export enum StatusTrem {
  NORMAL = 'NORMAL',
  LOTADO = 'LOTADO',
  AR_CONDICIONADO_QUEBRADO = 'AR_CONDICIONADO_QUEBRADO',
  AVARIADO = 'AVARIADO',
}
