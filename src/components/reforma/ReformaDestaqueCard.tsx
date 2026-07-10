import { useQuery } from "@tanstack/react-query";
import { ReceiptText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";

interface Props {
  year: number;
  month: number; // 0-indexed (Date convention)
}

function brl(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Auditoria da Reforma: total de CBS/IBS destacado nos documentos fiscais do
 * mês. Prova de conformidade (LC 214/2025 art. 348 §1º — quem destaca tem a
 * dispensa de recolhimento no ano-teste).
 */
export function ReformaDestaqueCard({ year, month }: Props) {
  const { company } = useCompany();
  const start = new Date(year, month, 1).toISOString();
  const end = new Date(year, month + 1, 1).toISOString();

  const { data } = useQuery({
    queryKey: ["reforma_destaque", company?.id, year, month],
    enabled: !!company,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("plugnotas_documents")
        .select("cbs_valor, ibs_valor, doc_type")
        .eq("company_id", company!.id)
        .not("cbs_valor", "is", null)
        .gte("created_at", start)
        .lt("created_at", end);
      if (error) throw error;
      const rows = (data ?? []) as Array<{ cbs_valor: number; ibs_valor: number }>;
      return {
        docs: rows.length,
        cbs: rows.reduce((s, r) => s + Number(r.cbs_valor ?? 0), 0),
        ibs: rows.reduce((s, r) => s + Number(r.ibs_valor ?? 0), 0),
      };
    },
  });

  if (!data || data.docs === 0) return null;

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <ReceiptText className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium">Reforma Tributária — destaque CBS/IBS no mês</p>
          <p className="text-xs text-muted-foreground">
            {data.docs} documento(s) emitidos com destaque — conformidade LC 214/2025 (dispensa de recolhimento no ano-teste)
          </p>
        </div>
      </div>
      <div className="flex gap-6 text-right">
        <div>
          <p className="text-xs text-muted-foreground">CBS (0,9%)</p>
          <p className="font-mono text-sm font-semibold tabular-nums">{brl(data.cbs)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">IBS (0,1%)</p>
          <p className="font-mono text-sm font-semibold tabular-nums">{brl(data.ibs)}</p>
        </div>
      </div>
    </div>
  );
}
