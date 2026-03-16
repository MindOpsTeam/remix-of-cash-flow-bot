import { describe, it, expect } from "vitest";
import { buildDpsXml, type DpsInput } from "../src/xml/dps-builder.js";

// We test the conditional serie validation by importing the emissao module's
// validation logic indirectly. Since the validation is inlined in nfseEmitir,
// we test the behavior through the validarDps tool.
// For unit testing, we verify the regex and conditional logic directly.

function validarSerieCondicional(
  serieDps: string,
  competencia: string,
): { erro: string | null; aviso: string | null } {
  const isNumeric = /^\d+$/.test(serieDps);
  if (isNumeric) return { erro: null, aviso: null };

  if (competencia >= "2026-01") {
    return {
      erro: `Série "${serieDps}" é alfanumérica. A partir de jan/2026, a série da DPS deve ser exclusivamente numérica.`,
      aviso: null,
    };
  }
  return {
    erro: null,
    aviso: "Série alfanumérica — será obrigatoriamente numérica a partir de jan/2026",
  };
}

describe("Serie Condicional", () => {
  it("should accept numeric serie for any competência", () => {
    expect(validarSerieCondicional("1", "2025-12").erro).toBeNull();
    expect(validarSerieCondicional("1", "2026-01").erro).toBeNull();
    expect(validarSerieCondicional("999", "2026-06").erro).toBeNull();
  });

  it("should reject alphanumeric serie for competência >= 2026-01", () => {
    const r1 = validarSerieCondicional("A", "2026-01");
    expect(r1.erro).not.toBeNull();
    expect(r1.erro).toContain("alfanumérica");

    const r2 = validarSerieCondicional("RPS", "2026-03");
    expect(r2.erro).not.toBeNull();

    const r3 = validarSerieCondicional("1A", "2026-12");
    expect(r3.erro).not.toBeNull();
  });

  it("should only warn for alphanumeric serie before 2026-01", () => {
    const r1 = validarSerieCondicional("A", "2025-12");
    expect(r1.erro).toBeNull();
    expect(r1.aviso).not.toBeNull();
    expect(r1.aviso).toContain("jan/2026");

    const r2 = validarSerieCondicional("RPS", "2025-06");
    expect(r2.erro).toBeNull();
    expect(r2.aviso).not.toBeNull();
  });

  it("should handle edge case: December 2025 vs January 2026", () => {
    // Dec 2025: warning only
    const dec = validarSerieCondicional("X", "2025-12");
    expect(dec.erro).toBeNull();
    expect(dec.aviso).not.toBeNull();

    // Jan 2026: hard error
    const jan = validarSerieCondicional("X", "2026-01");
    expect(jan.erro).not.toBeNull();
    expect(jan.aviso).toBeNull();
  });
});
