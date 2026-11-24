import { Injectable } from '@nestjs/common';

interface Entrada {
  valor: unknown;
  expiraEm: number;
}

type CacheStore = Map<string, Entrada>;

const storesAtivos = new Set<CacheStore>();

@Injectable()
export class CacheService {
  private store: CacheStore = new Map<string, Entrada>();

  constructor() {
    storesAtivos.add(this.store);
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
}
