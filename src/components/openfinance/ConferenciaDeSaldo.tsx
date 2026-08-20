import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Check, TriangleAlert, HelpCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { formatCurrency } from "@/lib/utils";

/**
 * "Bate ou não bate": a pergunta que o financeiro precisa responder no fim do
 * dia, e que o sistema não respondia.
 *
 * O cockpit somava `bank_accounts.balance`, que é o número que o provedor
 * mandou, e chamava aquilo de caixa. Ninguém nunca comparava com o que os
 * lançamentos dizem, então a diferença crescia todo mês e ninguém conseguia
 * apontar de onde vinha.
 *
 * O contador de lançamentos sem conta bancária fica em destaque de propósito:
 * sem ele, uma diferença causada por lançamento não atribuído pareceria erro de
 * conciliação, que é problema diferente e tem outro dono.
 */

interface Linha {
  bank_account_id: string | null;
  conta: string | null;
  bank_name: string | null;
  saldo_extrato: number | null;
  saldo_sistema: number | null;
  diferenca: number | null;
  situacao: string | null;
  lancamentos_na_conta: number | null;
  lancamentos_sem_conta_bancaria: number | null;
}

const APARENCIA: Record<string, { rotulo: string; classe: string; Icone: typeof Check }> = {
  bate: { rotulo: "Bate com o banco", classe: "text-revenue", Icone: Check },
  diverge: { rotulo: "Diverge", classe: "text-[hsl(var(--warning))]", Icone: TriangleAlert },
  sem_extrato: { rotulo: "Sem extrato do banco", classe: "text-muted-foreground", Icone: HelpCircle },
};

export function ConferenciaDeSaldo() {
  const { company } = useCompany();

  const { data: linhas = [] } = useQuery<Linha[]>({
    queryKey: ["conciliacao", "saldo", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_conciliacao_saldo")
        .select("bank_account_id, conta, bank_name, saldo_extrato, saldo_sistema, diferenca, situacao, lancamentos_na_conta, lancamentos_sem_conta_bancaria")
        .eq("company_id", company!.id);
      if (error) throw error;
      return (data ?? []) as Linha[];
    },
  });

  if (!linhas.length) return null;

  const orfaos = linhas[0]?.lancamentos_sem_conta_bancaria ?? 0;
  const divergentes = linhas.filter((l) => l.situacao === "diverge").length;

  return (
    <Card className="mb-6">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold">Conferência de saldo</h2>
          <p className="text-xs text-muted-foreground">
            {divergentes === 0
              ? "Todas as contas com extrato batem com os lançamentos."
              : `${divergentes} ${divergentes === 1 ? "conta não bate" : "contas não batem"} com o extrato.`}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-2 py-1.5 text-left font-medium">Conta</th>
                <th className="px-2 py-1.5 text-right font-medium">Extrato</th>
                <th className="px-2 py-1.5 text-right font-medium">Sistema</th>
                <th className="px-2 py-1.5 text-right font-medium">Diferença</th>
                <th className="px-2 py-1.5 text-left font-medium">Situação</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const ap = APARENCIA[l.situacao ?? "sem_extrato"] ?? APARENCIA.sem_extrato;
                const { Icone } = ap;
                return (
                  <tr key={l.bank_account_id} className="border-b border-border last:border-0">
                    <td className="px-2 py-2">
                      {l.conta}
                      {l.bank_name && <span className="text-muted-foreground"> · {l.bank_name}</span>}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {l.saldo_extrato != null ? formatCurrency(Number(l.saldo_extrato)) : "—"}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(Number(l.saldo_sistema ?? 0))}</td>
                    <td className={`px-2 py-2 text-right tabular-nums ${l.situacao === "diverge" ? "text-[hsl(var(--warning))]" : ""}`}>
                      {l.diferenca != null ? formatCurrency(Number(l.diferenca)) : "—"}
                    </td>
                    <td className={`px-2 py-2 ${ap.classe}`}>
                      <span className="inline-flex items-center gap-1 text-xs">
                        <Icone className="h-3.5 w-3.5" /> {ap.rotulo}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {orfaos > 0 && (
          <p className="text-xs text-muted-foreground">
            {orfaos} {orfaos === 1 ? "lançamento não tem" : "lançamentos não têm"} conta bancária atribuída, então{" "}
            {orfaos === 1 ? "ele não entra" : "eles não entram"} nesta comparação. Enquanto isso não for resolvido, a
            diferença acima não é toda erro de conciliação.
          </p>
        )}
        {linhas.some((l) => l.situacao === "sem_extrato") && (
          <p className="text-xs text-muted-foreground">
            Conta sem extrato não tem com o que ser comparada. Informe o saldo em{" "}
            <Link to="/settings/bank-accounts" className="text-primary underline underline-offset-2">
              Contas Bancárias
            </Link>{" "}
            ou conecte o banco pelo Open Finance.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
