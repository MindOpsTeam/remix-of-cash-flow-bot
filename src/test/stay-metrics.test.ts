import { describe, it, expect } from "vitest";
import {
  calcularIndicadores,
  noitesNoPeriodo,
  noitesDisponiveis,
  agruparPor,
  mesPeriodo,
  type ReservaMetrica,
} from "@/lib/stay-metrics";

function reserva(over: Partial<ReservaMetrica> = {}): ReservaMetrica {
  return {
    unit_id: "u1",
    check_in: "2026-08-10",
    check_out: "2026-08-15",
    nights: 5,
    lodging_total: 1000,
    cleaning_fee: 120,
    extras_total: 80,
    gross_total: 1200,
    channel_commission: 180,
    payment_fee: 0,
    taxes: 0,
    cleaning_cost: 70,
    owner_payout: 164,
    net_total: 786,
    status: "confirmada",
    channel_id: "c1",
    ...over,
  };
}

describe("noitesNoPeriodo", () => {
  it("conta as noites entre check-in e check-out", () => {
    expect(noitesNoPeriodo(reserva(), { inicio: "2026-08-01", fim: "2026-08-31" })).toBe(5);
  });

  it("corta a reserva que atravessa a virada do mês", () => {
    const r = reserva({ check_in: "2026-08-29", check_out: "2026-09-03", nights: 5 });
    expect(noitesNoPeriodo(r, { inicio: "2026-08-01", fim: "2026-08-31" })).toBe(3);
    expect(noitesNoPeriodo(r, { inicio: "2026-09-01", fim: "2026-09-30" })).toBe(2);
  });

  it("ignora reserva fora do período", () => {
    expect(noitesNoPeriodo(reserva(), { inicio: "2026-09-01", fim: "2026-09-30" })).toBe(0);
  });
});

describe("noitesDisponiveis", () => {
  it("multiplica dias do período pelas unidades ativas", () => {
    expect(noitesDisponiveis({ inicio: "2026-08-01", fim: "2026-08-31" }, 4)).toBe(124);
  });
});

describe("calcularIndicadores", () => {
  const periodo = { inicio: "2026-08-01", fim: "2026-08-31" };

  it("separa diária, limpeza e extras e calcula ADR, RevPAR e ocupação", () => {
    const i = calcularIndicadores([reserva()], periodo, 1);
    expect(i.receitaHospedagem).toBe(1000);
    expect(i.receitaLimpeza).toBe(120);
    expect(i.receitaExtras).toBe(80);
    expect(i.noitesVendidas).toBe(5);
    expect(i.adr).toBe(200);
    expect(i.noitesDisponiveis).toBe(31);
    expect(i.ocupacao).toBeCloseTo(5 / 31, 6);
    expect(i.revpar).toBeCloseTo(1000 / 31, 6);
  });

  it("rateia a reserva que cruza o mês pelas noites do período", () => {
    const r = reserva({ check_in: "2026-08-29", check_out: "2026-09-03", nights: 5 });
    const i = calcularIndicadores([r], periodo, 1);
    expect(i.receitaHospedagem).toBeCloseTo(600, 6);
    expect(i.noitesVendidas).toBe(3);
  });

  it("desconsidera reserva cancelada", () => {
    const i = calcularIndicadores([reserva({ status: "cancelada" })], periodo, 1);
    expect(i.reservas).toBe(0);
    expect(i.receitaBruta).toBe(0);
  });

  it("soma repasse, custo de limpeza e resultado líquido", () => {
    const i = calcularIndicadores([reserva(), reserva({ unit_id: "u2" })], periodo, 2);
    expect(i.repasseProprietarios).toBe(328);
    expect(i.custoLimpeza).toBe(140);
    expect(i.resultadoLiquido).toBe(1572);
  });

  it("não divide por zero sem unidades ativas", () => {
    const i = calcularIndicadores([reserva()], periodo, 0);
    expect(i.ocupacao).toBe(0);
    expect(i.revpar).toBe(0);
  });
});

describe("agruparPor", () => {
  it("agrupa por unidade ordenando pela receita", () => {
    const grupos = agruparPor(
      [reserva({ unit_id: "u1", gross_total: 500 }), reserva({ unit_id: "u2", gross_total: 900 })],
      { inicio: "2026-08-01", fim: "2026-08-31" },
      (r) => r.unit_id,
    );
    expect(grupos.map((g) => g.chave)).toEqual(["u2", "u1"]);
  });
});

describe("mesPeriodo", () => {
  it("devolve primeiro e último dia do mês", () => {
    expect(mesPeriodo("2026-02-17")).toEqual({ inicio: "2026-02-01", fim: "2026-02-28" });
  });
});
