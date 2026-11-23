export enum Sentido {
  RECIFE = 'RECIFE',                   // sentido "em direção à estação central"
  CAMARAGIBE = 'CAMARAGIBE',           // terminal da linha Centro-1
  JABOATAO = 'JABOATAO',               // terminal da linha Centro-2
  CAJUEIRO_SECO = 'CAJUEIRO_SECO',     // terminal da linha Sul
  CABO = 'CABO',                       // terminal da VLT Ramal Cabo
  SOTAVE = 'SOTAVE',                   // terminal da VLT Ramal Curado
}

export enum TipoReporte {
  ESTACAO = 'ESTACAO',
  LINHA = 'LINHA',
  TREM = 'TREM',
}

export enum StatusEstacao {
  NORMAL = 'NORMAL',
  ATENCAO = 'ATENCAO',
  PARALISADA = 'PARALISADA',
  LOTADA = 'LOTADA',
  FECHADA = 'FECHADA',
}

export enum StatusLinha {
  NORMAL = 'NORMAL',
  ATENCAO = 'ATENCAO',
  PARALISADA = 'PARALISADA',
}

export enum StatusTrem {
  NORMAL = 'NORMAL',
  LOTADO = 'LOTADO',
  ATRASO = 'ATRASO',
  PARADO = 'PARADO',
  AR_CONDICIONADO_QUEBRADO = 'AR_CONDICIONADO_QUEBRADO',
  AVARIADO = 'AVARIADO',
}

export enum TipoConfirmacao {
  CONFIRMAR = 'CONFIRMAR',
  DISCORDAR = 'DISCORDAR',
}

export enum EventoReputacao {
  REPORTE_CONFIRMADO = 'REPORTE_CONFIRMADO',           // +3
  REPORTE_REFUTADO = 'REPORTE_REFUTADO',               // -5
  CONFIRMOU_REPORTE_REFUTADO = 'CONFIRMOU_REPORTE_REFUTADO', // -1
  DISCORDOU_REPORTE_CONFIRMADO = 'DISCORDOU_REPORTE_CONFIRMADO', // -2
}
