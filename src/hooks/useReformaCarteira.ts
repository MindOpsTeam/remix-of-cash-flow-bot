import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";

// receivables/contracts ainda não estão nos tipos gerados do Supabase.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const CICLO_POR_ANO: Record<string, number> = {
  WEEKLY: 52, BIWEEKLY: 26, MONTHLY: 12, QUARTERLY: 4, SEMIANNUALLY: 2, YEARLY: 1,
};

export type TipoCliente = "B2B" | "B2C";

export interface ClienteCarteira {
  contactId: string;
  nome: string;
  tipo: TipoCliente;
  receitaAno: number;
}

export interface CarteiraReforma {
  clientes: ClienteCarteira[]; // ordenados por receita desc
  faturamentoAno: number;
  /** Participação da receita vinda de clientes B2B (0..1). */
  pctB2B: number;
  /** Proxy de insumos creditáveis (despesas 12m). */
  insumosAno: number;
  temDados: boolean;
}

function doze(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 12);
  return d.toISOString().slice(0, 10);
}

/**
 * Agrega a carteira REAL do tenant para a simulação de Reforma — sem digitação.
 * Receita por cliente vem do ledger cliente-vinculado (receivables + contracts),
 * classificada B2B/B2C por `contacts.person_type`/document. Insumos = despesas 12m.
 */
export function useReformaCarteira() {
  const { company } = useCompany();
  const companyId = company?.id;

  return useQuery({
    queryKey: ["reforma_carteira", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<CarteiraReforma> => {
      const cid = companyId as string; // enabled: !!companyId garante em runtime
      const desde = doze();
      const [rec, con, cts, bills] = await Promise.all([
        db.from("receivables").select("contact_id, amount, status, due_date, contract_id")
          .eq("company_id", cid).neq("status", "cancelado").gte("due_date", desde),
        db.from("contracts").select("contact_id, amount, cycle, status")
          .eq("company_id", cid).eq("status", "active"),
        supabase.from("contacts").select("id, name, person_type, document").eq("company_id", cid),
        supabase.from("bills_payable").select("valor").eq("company_id", cid).gte("vencimento", desde),
      ]);

      const contatos = new Map<string, { name: string; person_type: string | null; document: string | null }>();
      for (const c of (cts.data ?? []) as Array<{ id: string; name: string; person_type: string | null; document: string | null }>) {
        contatos.set(c.id, { name: c.name, person_type: c.person_type, document: c.document });
      }

      // Contratos anualizados (recorrente) + recebíveis AVULSOS (sem contrato).
      // Recebíveis de contrato têm contract_id e já entram via porCon — não duplicar.
      const porRecAvulso = new Map<string, number>();
      for (const r of (rec.data ?? []) as Array<{ contact_id: string | null; amount: number; contract_id: string | null }>) {
        if (!r.contact_id || r.contract_id) continue;
        porRecAvulso.set(r.contact_id, (porRecAvulso.get(r.contact_id) ?? 0) + Number(r.amount));
      }
      const porCon = new Map<string, number>();
      for (const c of (con.data ?? []) as Array<{ contact_id: string | null; amount: number; cycle: string }>) {
        if (!c.contact_id) continue;
        const anual = Number(c.amount) * (CICLO_POR_ANO[c.cycle] ?? 12);
        porCon.set(c.contact_id, (porCon.get(c.contact_id) ?? 0) + anual);
      }

      const ids = new Set<string>([...porRecAvulso.keys(), ...porCon.keys()]);
      const clientes: ClienteCarteira[] = [];
      for (const id of ids) {
        const receitaAno = (porCon.get(id) ?? 0) + (porRecAvulso.get(id) ?? 0);
        if (receitaAno <= 0) continue;
        const info = contatos.get(id);
        const doc = (info?.document ?? "").replace(/\D/g, "");
        const tipo: TipoCliente = info?.person_type === "pj" || doc.length === 14 ? "B2B" : "B2C";
        clientes.push({ contactId: id, nome: info?.name ?? "Cliente", tipo, receitaAno: Math.round(receitaAno) });
      }
      clientes.sort((a, b) => b.receitaAno - a.receitaAno);

      const faturamentoAno = clientes.reduce((s, c) => s + c.receitaAno, 0);
      const receitaB2B = clientes.filter((c) => c.tipo === "B2B").reduce((s, c) => s + c.receitaAno, 0);
      const pctB2B = faturamentoAno > 0 ? receitaB2B / faturamentoAno : 0;
      const insumosAno = Math.round(((bills.data ?? []) as Array<{ valor: number }>).reduce((s, b) => s + Number(b.valor), 0));

      return { clientes, faturamentoAno, pctB2B, insumosAno, temDados: clientes.length > 0 };
    },
  });
}
