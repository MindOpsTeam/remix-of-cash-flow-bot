import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link2, Users, AlertTriangle, ShieldCheck, Info } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useReformaCarteira } from "@/hooks/useReformaCarteira";
import { analisarCreditoB2B, ANO_PLENO } from "@/lib/reforma-credito";

const ANOS = [2027, 2029, 2031, 2033];

export default function ReformaImpactoClientes() {
  const { data: carteira, isLoading } = useReformaCarteira();
  const [ano, setAno] = useState(ANO_PLENO);

  const credito = useMemo(
    () => analisarCreditoB2B(carteira?.clientes ?? [], ano),
    [carteira, ano],
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <Link2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-[-0.02em]">Cadeia de crédito B2B · Reforma</h1>
              <p className="text-sm text-muted-foreground">Quanto de crédito de CBS/IBS seus clientes PJ perdem se você ficar no Simples padrão</p>
            </div>
          </div>
          <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ANOS.map((a) => <SelectItem key={a} value={String(a)}>{a === ANO_PLENO ? "2033 (pleno)" : String(a)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : !carteira?.temDados ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Sem carteira detectada. Cadastre clientes com contratos ou contas a receber para ver o impacto por cliente — sem digitar nada.</p>
          </CardContent></Card>
        ) : credito.clientesB2B === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">
            <ShieldCheck className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Sua carteira é majoritariamente B2C (consumidor final), que não usa crédito. O crédito em risco só afeta vendas para PJ.</p>
          </CardContent></Card>
        ) : (
          <>
            {/* Mensagem-chave */}
            <Card className="border-warning/30 bg-warning/[0.08] dark:border-warning/30 dark:bg-warning/[0.08]">
              <CardContent className="p-5 flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-warning/[0.08] dark:bg-warning/[0.08] flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                </div>
                <p className="text-sm text-foreground">
                  No <strong>Simples padrão</strong>, seus <strong>{credito.clientesB2B}</strong> cliente{credito.clientesB2B > 1 ? "s" : ""} PJ perde{credito.clientesB2B > 1 ? "m" : ""} cerca de <strong className="tabular-nums text-warning dark:text-warning">{formatCurrency(credito.creditoEmRiscoTotal)}/ano</strong> de crédito de CBS/IBS comprando de você (referência {ano === ANO_PLENO ? "2033, regime pleno" : ano}). Recolhendo <strong>por fora (Híbrido)</strong>, esse crédito vira <strong>vantagem competitiva</strong> — e evita pressão por desconto ou troca de fornecedor.
                </p>
              </CardContent>
            </Card>

            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {([
                { label: "Crédito em risco (Simples)", value: formatCurrency(credito.creditoEmRiscoTotal), Icon: AlertTriangle, cls: "bg-warning/[0.08] dark:bg-warning/[0.08]", ic: "text-warning" },
                { label: "Crédito cheio (por fora)", value: formatCurrency(credito.creditoCheioTotal), Icon: ShieldCheck, cls: "bg-success/[0.08] dark:bg-success/[0.08]", ic: "text-success" },
                { label: "Receita B2B / ano", value: formatCurrency(credito.receitaB2B), Icon: Users, cls: "bg-primary/[0.08] dark:bg-primary/[0.08]", ic: "text-primary" },
              ] as const).map(({ label, value, Icon, cls, ic }) => (
                <Card key={label}><CardContent className="p-4 flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-lg ${cls} flex items-center justify-center`}><Icon className={`h-4 w-4 ${ic}`} /></div>
                  <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-lg font-semibold tabular-nums">{value}</p></div>
                </CardContent></Card>
              ))}
            </div>

            {/* Tabela por cliente */}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cliente PJ</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Receita/ano</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Crédito cheio</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Crédito no Simples</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Em risco</th>
                      </tr>
                    </thead>
                    <tbody>
                      {credito.porCliente.map((c) => (
                        <tr key={c.contactId} className="border-b last:border-b-0 hover:bg-muted/20">
                          <td className="px-4 py-2.5 font-medium">{c.nome}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{formatCurrency(c.receitaAno)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(c.creditoCheio)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{formatCurrency(c.creditoSimples)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-warning dark:text-warning">{formatCurrency(c.creditoEmRisco)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-2 rounded-lg border border-border/60 bg-muted/20 p-3">
              <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Estimativa gerencial sobre a carteira real (contratos + contas a receber, clientes PJ classificados por documento). O crédito transferível do Simples padrão é aproximado; o crédito cheio usa a alíquota de referência do IVA por ano da transição. Não substitui parecer do contador. Combine com o <strong>Simulador de Regime</strong> para a decisão do Simples (prazo de opção: 1-30/09/2026).
              </p>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
