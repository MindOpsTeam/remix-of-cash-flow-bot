import { describe, it, expect } from "vitest";
import { REDUCOES_IVA, reducaoPorKey, reducaoLabel } from "@/lib/reforma-rates";

describe("REDUCOES_IVA", () => {
  it("cobre integral, 60%, 30% e zero", () => {
    expect(REDUCOES_IVA.map((r) => r.key)).toEqual(["integral", "reduzido60", "reduzido30", "zero"]);
  });
  it("reducaoPorKey retorna a fração correta", () => {
    expect(reducaoPorKey("integral")).toBe(0);
    expect(reducaoPorKey("reduzido60")).toBe(0.6);
    expect(reducaoPorKey("reduzido30")).toBe(0.3);
    expect(reducaoPorKey("zero")).toBe(1);
  });
  it("chave desconhecida cai em integral (0)", () => {
    expect(reducaoPorKey("xpto")).toBe(0);
  });
  it("reducaoLabel devolve rótulo legível", () => {
    expect(reducaoLabel("reduzido60")).toBe("Redução 60%");
    expect(reducaoLabel("xpto")).toBe("Tributação integral");
  });
});
