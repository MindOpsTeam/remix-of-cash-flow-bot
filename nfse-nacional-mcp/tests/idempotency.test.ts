import { describe, it, expect, beforeEach } from "vitest";
import { emissionCache } from "../src/cache/idempotency-cache.js";

describe("IdempotencyCache", () => {
  // The emissionCache is a singleton, so we test it directly.
  // In a real scenario, we'd want to reset it between tests.
  const testIdDps = `DPS_TEST_${Date.now()}`;

  it("should return undefined for unknown idDps", () => {
    expect(emissionCache.get("UNKNOWN_ID")).toBeUndefined();
  });

  it("should return cached result after set", () => {
    const result = { chaveAcesso: "ABC123", numero: "1" };
    emissionCache.set(testIdDps, result);

    const cached = emissionCache.get(testIdDps);
    expect(cached).toEqual(result);
  });

  it("should report has() correctly", () => {
    const id = `DPS_HAS_${Date.now()}`;
    expect(emissionCache.has(id)).toBe(false);

    emissionCache.set(id, { test: true });
    expect(emissionCache.has(id)).toBe(true);
  });

  it("should not POST twice for same idDps (integration simulation)", () => {
    // Simulates what nfseEmitir does:
    // 1. Check cache → miss → call ADN → cache result
    // 2. Check cache → hit → return cached, skip ADN call

    const idDps = `DPS_IDEM_${Date.now()}`;
    let adnCallCount = 0;

    // Simulated emission flow
    function simulateEmission(id: string): unknown {
      const cached = emissionCache.get(id);
      if (cached) return { ...cached as Record<string, unknown>, idempotente: true };

      // "Call ADN"
      adnCallCount++;
      const result = { chaveAcesso: "CHAVE_" + id, numero: "42" };

      emissionCache.set(id, result);
      return result;
    }

    // First call: should hit ADN
    const r1 = simulateEmission(idDps) as Record<string, unknown>;
    expect(adnCallCount).toBe(1);
    expect(r1.chaveAcesso).toBe("CHAVE_" + idDps);
    expect(r1.idempotente).toBeUndefined();

    // Second call: should NOT hit ADN
    const r2 = simulateEmission(idDps) as Record<string, unknown>;
    expect(adnCallCount).toBe(1); // Still 1 — no second call
    expect(r2.chaveAcesso).toBe("CHAVE_" + idDps);
    expect(r2.idempotente).toBe(true);
  });
});
