import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TrendingUp, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";

/**
 * Contratos com aniversário de reajuste chegando.
 *
 * O conselho: contrato de recorrência sem reajuste perde margem sozinho todo
 * ano, e o cliente mais antigo costuma ser o que mais custa a atender.
 *
 * O sistema NÃO inventa IPCA nem IGPM. Ele sabe a data do aniversário e o
 * índice combinado, avisa quando chega, e pede o percentual do período, que é
 * o número que o contador informa. Guardar um índice que ninguém buscou na
 * fonte seria o mesmo erro de escrever cClassTrib à mão.
 */

interface AReajustar {
  id: string;
  description: string;
  contato_nome: string | null;
  valor_atual: number;
  indice_reajuste: string;
  percentual_reajuste: number | null;
  proximo_reajuste: string;
  dias_para_aniversario: number;
  aplica_sozinho: boolean;
}

const brl = (v: number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const NOME_INDICE: Record<string, string> = {
  fixo: "percentual combinado", ipca: "IPCA", igpm: "IGP-M", inpc: "INPC",
};

export function ReajustesPendentes() {
  const { company } = useCompany();
  const qc = useQueryClient();
  const [percentuais, setPercentuais] = useState<Record<string, string>>({});
  const [aplicando, setAplicando] = useState<string | null>(null);

  const { data: pendentes = [] } = useQuery({
    queryKey: ["contratos_a_reajustar", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data } = await supabase
        .from("v_contratos_a_reajustar" as never)
        .select("*")
        .eq("company_id", company!.id)
        .order("proximo_reajuste");
      return (data ?? []) as unknown as AReajustar[];
    },
  });

  async function aplicar(c: AReajustar) {
    const pct = Number(percentuais[c.id] ?? c.percentual_reajuste ?? NaN);
    if (!Number.isFinite(pct) || pct === 0) {
      toast.error("Informe o percentual do período.");
      return;
    }
    setAplicando(c.id);
    try {
      const { data, error } = await supabase.rpc("reajustar_contrato" as never, {
        p_contract_id: c.id,
        p_percentual: pct,
      } as never);
      if (error) throw error;

      const r = data as unknown as { valor_anterior: number; valor_novo: number };
      toast.success(`${c.description}: ${brl(r.valor_anterior)} passou para ${brl(r.valor_novo)}.`, {
        description: "O reajuste ficou registrado no histórico do contrato.",
      });
      qc.invalidateQueries({ queryKey: ["contratos_a_reajustar", company?.id] });
      qc.invalidateQueries({ queryKey: ["contracts"] });
    } catch (e) {
      toast.error("Não consegui reajustar: " + (e as Error).message);
    } finally {
      setAplicando(null);
    }
  }

  if (pendentes.length === 0) return null;

  return (
    <div className="mb-5 rounded-lg border border-primary/30 bg-primary/5 p-4">
      <div className="mb-3 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-primary" />
        <p className="text-sm font-medium">
          {pendentes.length} contrato(s) com reajuste no prazo
        </p>
      </div>

      <div className="space-y-2">
        {pendentes.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{c.description}</p>
              <p className="text-xs text-muted-foreground">
                {c.contato_nome ?? "Sem cliente"} · {brl(c.valor_atual)} ·{" "}
                {NOME_INDICE[c.indice_reajuste] ?? c.indice_reajuste} ·{" "}
                {c.dias_para_aniversario < 0
                  ? `venceu há ${-c.dias_para_aniversario} dia(s)`
                  : c.dias_para_aniversario === 0
                    ? "aniversário é hoje"
                    : `em ${c.dias_para_aniversario} dia(s)`}
              </p>
            </div>

            <div className="flex items-center gap-1">
              <Input
                className="w-20 text-right"
                inputMode="decimal"
                placeholder="%"
                value={percentuais[c.id] ?? (c.percentual_reajuste != null ? String(c.percentual_reajuste) : "")}
                onChange={(e) => setPercentuais({ ...percentuais, [c.id]: e.target.value })}
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>

            <Button size="sm" onClick={() => aplicar(c)} disabled={aplicando === c.id} className="gap-1.5">
              {aplicando === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Aplicar
            </Button>
          </div>
        ))}
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground">
        O sistema não busca IPCA nem IGP-M sozinho. Informe o acumulado do período, que é o número que o contador
        passa, e o reajuste fica registrado no histórico do contrato.
      </p>
    </div>
  );
}
