import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { SomenteAdmin } from "@/components/auth/SomenteAdmin";

/**
 * Quem mexeu no quê.
 *
 * Antes desta tela, o júnior apagava um lançamento de trinta mil e não ficava
 * linha, nem log, nem partida contábil. O sócio perguntava o que aconteceu e a
 * resposta honesta era "não dá para saber". Numa PME familiar, isso encerra a
 * conversa sobre o sistema.
 */

interface Linha {
  id: number;
  tabela: string;
  registro_id: string | null;
  operacao: string;
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
  campos: string[] | null;
  em: string;
  user_id: string | null;
}

const ROTULO_TABELA: Record<string, string> = {
  transactions: "Lançamento",
  receivables: "Conta a receber",
  bills_payable: "Conta a pagar",
  bank_accounts: "Conta bancária",
  title_payments: "Baixa de título",
  tax_guides: "Guia de imposto",
  invoices: "Nota fiscal",
  monthly_close: "Fechamento de mês",
  contracts: "Contrato",
};

const ROTULO_OPERACAO: Record<string, { texto: string; classe: string }> = {
  INSERT: { texto: "criou", classe: "text-revenue" },
  UPDATE: { texto: "alterou", classe: "text-[hsl(var(--warning))]" },
  DELETE: { texto: "apagou", classe: "text-[hsl(var(--destructive))]" },
};

const PAGINA = 50;

function valorLegivel(v: unknown): string {
  if (v === null || v === undefined) return "vazio";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export default function TrilhaAuditoria() {
  const { company } = useCompany();
  const [tabela, setTabela] = useState<string>("todas");
  const [limite, setLimite] = useState(PAGINA);

  const { data: linhas = [], isLoading } = useQuery<Linha[]>({
    queryKey: ["auditoria", company?.id, tabela, limite],
    enabled: !!company,
    queryFn: async () => {
      let q = supabase
        .from("audit_log")
        .select("id, tabela, registro_id, operacao, antes, depois, campos, em, user_id")
        .eq("company_id", company!.id)
        .order("em", { ascending: false })
        .limit(limite);
      if (tabela !== "todas") q = q.eq("tabela", tabela);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Linha[];
    },
  });

  return (
    <SomenteAdmin>
      <AppLayout>
        <PageHeader
          title="Quem mexeu no quê"
          description="Toda alteração de valor em lançamento, título, conta e fechamento, com o que era antes"
          backTo="/settings"
        />

        <div className="mb-4 flex items-center gap-2">
          <Select value={tabela} onValueChange={(v) => { setTabela(v); setLimite(PAGINA); }}>
            <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Tudo</SelectItem>
              {Object.entries(ROTULO_TABELA).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : linhas.length === 0 ? (
              <div className="py-12 text-center">
                <History className="h-7 w-7 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma alteração registrada ainda. A trilha começa a partir de agora.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {linhas.map((l) => {
                  const op = ROTULO_OPERACAO[l.operacao] ?? { texto: l.operacao, classe: "" };
                  return (
                    <div key={l.id} className="px-4 py-3">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className={`text-sm font-medium ${op.classe}`}>{op.texto}</span>
                        <span className="text-sm text-foreground">{ROTULO_TABELA[l.tabela] ?? l.tabela}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(l.em).toLocaleString("pt-BR")}
                        </span>
                      </div>

                      {l.operacao === "UPDATE" && l.campos?.length ? (
                        <div className="mt-1 space-y-0.5">
                          {l.campos.map((c) => (
                            <p key={c} className="text-xs text-muted-foreground">
                              <span className="text-foreground">{c}</span>: {valorLegivel(l.antes?.[c])}{" "}
                              <span aria-hidden>&rarr;</span> {valorLegivel(l.depois?.[c])}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground truncate">
                          {valorLegivel((l.antes ?? l.depois)?.description ?? (l.antes ?? l.depois)?.descricao ?? l.registro_id)}
                          {l.operacao === "DELETE" && (l.antes?.amount || l.antes?.valor) ? (
                            <> · valor {valorLegivel(l.antes?.amount ?? l.antes?.valor)}</>
                          ) : null}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {linhas.length >= limite && (
          <div className="mt-4 flex justify-center">
            <Button variant="outline" size="sm" onClick={() => setLimite((n) => n + PAGINA)}>
              Ver mais
            </Button>
          </div>
        )}
      </AppLayout>
    </SomenteAdmin>
  );
}
