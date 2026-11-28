import { Injectable, OnModuleDestroy } from '@nestjs/common';

interface Entrada {
  valor: unknown;
  expiraEm: number;
}

type CacheStore = Map<string, Entrada>;

const storesAtivos = new Set<CacheStore>();
const INTERVALO_LIMPEZA_MS = 60_000;

@Injectable()
export class CacheService implements OnModuleDestroy {
  private store: CacheStore = new Map<string, Entrada>();
  private readonly cleanupTimer: NodeJS.Timeout;

  constructor() {
    storesAtivos.add(this.store);
    this.cleanupTimer = setInterval(() => this.expurgarExpirados(), INTERVALO_LIMPEZA_MS);
    this.cleanupTimer.unref();
  }

  async get<T = unknown>(chave: string): Promise<T | null> {
    const entrada = this.store.get(chave);
    if (!entrada) return null;
    if (entrada.expiraEm <= Date.now()) {
      this.store.delete(chave);
      return null;
    }
    return entrada.valor as T;
  }

  async set(chave: string, valor: unknown, ttlMs: number): Promise<void> {
    this.store.set(chave, { valor, expiraEm: Date.now() + ttlMs });
  }

  async del(chave: string): Promise<void> {
    this.store.delete(chave);
  }

  async clear(): Promise<void> {
    for (const store of storesAtivos) {
      store.clear();
    }
  }

  onModuleDestroy(): void {
    clearInterval(this.cleanupTimer);
    this.store.clear();
    storesAtivos.delete(this.store);
  }

  private expurgarExpirados(): void {
    const agora = Date.now();
    for (const [chave, entrada] of this.store.entries()) {
      if (entrada.expiraEm <= agora) {
        this.store.delete(chave);
      }
    }
  }
}
