/**
 * Cache de idempotência para emissão de NFS-e.
 *
 * Impede o envio duplicado de DPS ao ADN. Armazena o idDps como chave
 * e o resultado da emissão como valor, com TTL de 1 hora.
 */

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hora

interface CachedEmission {
  result: unknown;
  cachedAt: number;
}

class IdempotencyCache {
  private cache = new Map<string, CachedEmission>();
  private ttlMs: number;

  constructor(ttlMs: number = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  /**
   * Retorna o resultado cacheado se o idDps já foi emitido, ou undefined.
   */
  get(idDps: string): unknown | undefined {
    const entry = this.cache.get(idDps);
    if (!entry) return undefined;

    if (Date.now() - entry.cachedAt > this.ttlMs) {
      this.cache.delete(idDps);
      return undefined;
    }

    return entry.result;
  }

  /**
   * Armazena o resultado de uma emissão bem-sucedida.
   */
  set(idDps: string, result: unknown): void {
    // Limpar entradas expiradas periodicamente (a cada 100 sets)
    if (this.cache.size > 0 && this.cache.size % 100 === 0) {
      this.cleanup();
    }

    this.cache.set(idDps, { result, cachedAt: Date.now() });
  }

  /**
   * Verifica se um idDps já está no cache (sem retornar o resultado).
   */
  has(idDps: string): boolean {
    return this.get(idDps) !== undefined;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now - entry.cachedAt > this.ttlMs) {
        this.cache.delete(key);
      }
    }
  }
}

export const emissionCache = new IdempotencyCache();
