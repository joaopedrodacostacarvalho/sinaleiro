import {
  StatusEstacao, StatusLinha, StatusTrem, TipoReporte, TipoConfirmacao,
} from '@sinaleiro/types/enums';

export function makeUsuario(overrides: Record<string, unknown> = {}): any {
  return {
    id: 'user-1',
    firebase_uid: 'fb-1',
    google_id: null,
    nome: 'Test User',
    email: 'test@example.com',
    reputacao: 0,
    data_cadastro: new Date(),
    reportes: [],
    confirmacoes: [],
    ...overrides,
  };
}

export function makeEstacao(overrides: Record<string, unknown> = {}): any {
  return {
    id: 1,
    nome: 'Recife',
    latitude: -8.067794,
    longitude: -34.885139,
    linha_id: 1,
    ...overrides,
  };
}

export function makeLinha(overrides: Record<string, unknown> = {}): any {
  return { id: 1, nome: 'Centro', cor: '#E31C23', ...overrides };
}

export function makeReporte(overrides: Record<string, unknown> = {}): any {
  return {
    id: 'reporte-1',
    tipo: TipoReporte.ESTACAO,
    usuario_id: 'user-1',
    trem_id: null,
    estacao_id: 1,
    linha_id: null,
    status_estacao: StatusEstacao.NORMAL,
    status_linha: null,
    status_trem: null,
    data_hora_criacao: new Date(),
    data_hora_expiracao: new Date(Date.now() + 30 * 60 * 1000),
    confianca: 10,
    ativo: true,
    ...overrides,
  };
}

export function makeConfirmacao(overrides: Record<string, unknown> = {}): any {
  return {
    id: 'confirmacao-1',
    reporte_id: 'reporte-1',
    usuario_id: 'user-2',
    tipo: TipoConfirmacao.CONFIRMAR,
    data_hora: new Date(),
    ...overrides,
  };
}

export function mockRepo<T>(): any {
  return {
    find: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue(null),
    findOneBy: vi.fn().mockResolvedValue(null),
    create: vi.fn((data: any) => ({ ...data })),
    save: vi.fn(async (e: any) => e),
    count: vi.fn().mockResolvedValue(0),
    update: vi.fn(),
    delete: vi.fn(),
    createQueryBuilder: vi.fn(),
  };
}
