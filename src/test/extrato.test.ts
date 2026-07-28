import { describe, it, expect } from "vitest";
import { lerExtrato } from "@/lib/extrato";

describe("leitura de extrato colado", () => {
  it("lê o formato de app de banco, com data curta e sinal", () => {
    const r = lerExtrato(
      `05/07  PIX ENVIADO FORNECEDOR ABC   -1.240,00
06/07  TED RECEBIDA CLIENTE XYZ      3.500,00`,
      2026,
    );
    expect(r.linhas).toHaveLength(2);
    expect(r.linhas[0]).toMatchObject({ data: "2026-07-05", valor: 1240, tipo: "expense" });
    expect(r.linhas[0].descricao).toContain("FORNECEDOR ABC");
    expect(r.linhas[1]).toMatchObject({ data: "2026-07-06", valor: 3500, tipo: "revenue" });
  });

  it("lê data completa, data ISO e mês por extenso", () => {
    const r = lerExtrato(
      `05/07/2026 ALUGUEL ESCRITORIO -3.200,00
2026-07-08;ENERGIA ELETRICA;-540,90
10 jul PAGAMENTO CLIENTE 900,00`,
      2026,
    );
    expect(r.linhas.map((l) => l.data)).toEqual(["2026-07-05", "2026-07-08", "2026-07-10"]);
  });

  it("entende parêntese, sufixo D e R$ como saída", () => {
    const r = lerExtrato(
      `05/07 TARIFA BANCARIA (35,00)
06/07 COMPRA CARTAO R$ 120,50 D
07/07 SAQUE 200,00-`,
      2026,
    );
    expect(r.linhas).toHaveLength(3);
    expect(r.linhas.every((l) => l.tipo === "expense")).toBe(true);
    expect(r.linhas.map((l) => l.valor)).toEqual([35, 120.5, 200]);
  });

  it("usa o verbo do extrato quando não há sinal nenhum", () => {
    const r = lerExtrato(
      `05/07 PAGAMENTO DE BOLETO 400,00
06/07 DEPOSITO EM CONTA 700,00`,
      2026,
    );
    expect(r.linhas[0].tipo).toBe("expense");
    expect(r.linhas[1].tipo).toBe("revenue");
  });

  it("quando há valor e saldo na mesma linha, pega o movimento e não o saldo", () => {
    const r = lerExtrato("05/07 PIX RECEBIDO JOAO 1.500,00 12.300,45", 2026);
    expect(r.linhas[0].valor).toBe(1500);
  });

  it("descarta cabeçalho, rodapé e linha sem valor", () => {
    const r = lerExtrato(
      `Extrato de conta corrente
Período: 01/07/2026 a 31/07/2026
Saldo anterior 10.000,00
05/07 PIX ENVIADO ABC -100,00
Agência 1234 Conta 56789`,
      2026,
    );
    expect(r.linhas).toHaveLength(1);
    expect(r.ignoradas.length).toBeGreaterThanOrEqual(3);
  });

  it("aceita colagem de planilha separada por tabulação", () => {
    const r = lerExtrato("05/07/2026\tVENDA BALCAO\t2.000,00\n06/07/2026\tFOLHA\t-5.000,00", 2026);
    expect(r.linhas).toHaveLength(2);
    expect(r.linhas[0].descricao).toBe("VENDA BALCAO");
    expect(r.linhas[1].tipo).toBe("expense");
  });

  it("soma entradas e saídas para o usuário conferir antes de confirmar", () => {
    const r = lerExtrato(
      `05/07 RECEBIDO A 1.000,00
06/07 RECEBIDO B 500,00
07/07 PAGO C -300,00`,
      2026,
    );
    expect(r.totalEntradas).toBe(1500);
    expect(r.totalSaidas).toBe(300);
  });

  it("não inventa lançamento a partir de texto solto", () => {
    const r = lerExtrato("bom dia, segue o extrato\nqualquer coisa me chama", 2026);
    expect(r.linhas).toHaveLength(0);
  });
});
