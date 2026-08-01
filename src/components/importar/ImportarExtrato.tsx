import { mensagemDeErro } from "@/lib/erros";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ClipboardPaste, Loader2, Check, Compass, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useCompany } from "@/hooks/useCompany";
import { supabase } from "@/integrations/supabase/client";
import { lerExtrato, type LinhaExtrato } from "@/lib/extrato";

/**
 * Importação por colagem.
 *
 * O caminho mais curto entre "empresa criada" e "vi o meu dinheiro na tela".
 * Não pede formato, não pede arquivo, não pede credencial: o usuário copia do
 * app do banco ou da planilha e cola. O sistema lê, a IA classifica, ele
 * confere e confirma. Toda correção que ele fizer vira regra e a próxima
 * importação já não precisa de modelo para aquele padrão.
 */

interface Conta {
  id: string;
  name: string;
  code: string | null;
  type: string;
}

interface LinhaRevisao extends LinhaExtrato {
  account_id: string | null;
  cost_center_id: string | null;
  confidence: "high" | "medium" | "low";
  origem: "regra" | "ia" | "nenhuma";
  /** Marca que o humano trocou a sugestão: é isso que vira regra. */
  corrigido: boolean;
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface ImportarExtratoProps {
  trigger?: React.ReactNode;
  /** Chamado depois que os lançamentos entraram, para a tela recarregar. */
  onImportado?: () => void;
}

export function ImportarExtrato({ trigger, onImportado }: ImportarExtratoProps) {
  const { company } = useCompany();
  const queryClient = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [linhas, setLinhas] = useState<LinhaRevisao[] | null>(null);
  const [ignoradas, setIgnoradas] = useState(0);
  const [contas, setContas] = useState<Conta[]>([]);
  const [lendo, setLendo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [resumoIa, setResumoIa] = useState<{ por_regra: number; por_ia: number; sem_classificacao: number } | null>(null);

  function reiniciar() {
    setTexto("");
    setLinhas(null);
    setResumoIa(null);
    setIgnoradas(0);
  }

  async function ler() {
    if (!company?.id) return;
    const leitura = lerExtrato(texto);
    if (leitura.linhas.length === 0) {
      toast.error("Não encontrei lançamentos aí. Cole as linhas do extrato, com data e valor.");
      return;
    }

    setLendo(true);
    try {
      const { data: contasData } = await supabase
        .from("chart_of_accounts")
        .select("id, name, code, type")
        .eq("company_id", company.id);
      const listaContas = (contasData as Conta[] | null) ?? [];
      setContas(listaContas);

      const { data, error } = await supabase.functions.invoke("classificar-lote", {
        body: {
          company_id: company.id,
          itens: leitura.linhas.map((l) => ({ descricao: l.descricao, tipo: l.tipo })),
        },
      });
      if (error) throw error;

      const resposta = data as {
        itens: Array<{ indice: number; account_id: string | null; cost_center_id: string | null; confidence: LinhaRevisao["confidence"]; origem: LinhaRevisao["origem"] }>;
        resumo: { por_regra: number; por_ia: number; sem_classificacao: number };
      };

      setLinhas(
        leitura.linhas.map((l, i) => {
          const c = resposta.itens?.[i];
          return {
            ...l,
            account_id: c?.account_id ?? null,
            cost_center_id: c?.cost_center_id ?? null,
            confidence: c?.confidence ?? "low",
            origem: c?.origem ?? "nenhuma",
            corrigido: false,
          };
        }),
      );
      setResumoIa(resposta.resumo ?? null);
      setIgnoradas(leitura.ignoradas.length);
    } catch (e) {
      toast.error("Não consegui classificar agora: " + mensagemDeErro(e));
      // Mesmo sem IA o usuário segue: as linhas foram lidas, só falta a conta.
      setLinhas(
        leitura.linhas.map((l) => ({
          ...l, account_id: null, cost_center_id: null, confidence: "low", origem: "nenhuma", corrigido: false,
        })),
      );
      setIgnoradas(leitura.ignoradas.length);
    } finally {
      setLendo(false);
    }
  }

  function trocarConta(indice: number, contaId: string) {
    setLinhas((atual) =>
      (atual ?? []).map((l, i) => (i === indice ? { ...l, account_id: contaId, corrigido: true } : l)),
    );
  }

  async function confirmar() {
    if (!company?.id || !linhas?.length) return;
    setSalvando(true);
    try {
      const { data: sessao } = await supabase.auth.getUser();
      const uid = sessao.user?.id;
      if (!uid) throw new Error("Sessão expirada. Entre de novo.");

      const { error } = await supabase.from("transactions").insert(
        linhas.map((l) => ({
          company_id: company.id,
          user_id: uid,
          date: l.data,
          description: l.descricao,
          amount: l.valor,
          type: l.tipo,
          status: "confirmed",
          source: "importacao",
          account_id: l.account_id,
          cost_center_id: l.cost_center_id,
        })) as never,
      );
      if (error) throw error;

      // A correção do humano vira regra: da próxima vez, zero token e resposta
      // igual. É isso que faz o sistema ficar mais barato conforme é usado.
      // Quem normaliza o padrão é a edge function, dona do mesmo normalizador
      // usado na busca. Se o front normalizasse aqui, a regra gravada poderia
      // nunca casar com o lançamento seguinte.
      const aprendidas = linhas.filter((l) => l.corrigido && l.account_id);
      if (aprendidas.length > 0) {
        await supabase.functions.invoke("classificar-lote", {
          body: {
            company_id: company.id,
            aprender: aprendidas.map((l) => ({
              descricao: l.descricao,
              account_id: l.account_id,
              cost_center_id: l.cost_center_id,
            })),
          },
        });
      }

      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dre"] });
      toast.success(
        `${linhas.length} lançamentos importados.` +
          (aprendidas.length ? ` Aprendi ${aprendidas.length} classificação(ões) para a próxima vez.` : ""),
      );
      setAberto(false);
      reiniciar();
      onImportado?.();
    } catch (e) {
      toast.error("Não consegui importar: " + mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }

  const totalEntradas = (linhas ?? []).filter((l) => l.tipo === "revenue").reduce((s, l) => s + l.valor, 0);
  const totalSaidas = (linhas ?? []).filter((l) => l.tipo === "expense").reduce((s, l) => s + l.valor, 0);

  return (
    <Dialog open={aberto} onOpenChange={(v) => { setAberto(v); if (!v) reiniciar(); }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="gap-2">
            <ClipboardPaste className="h-4 w-4" /> Colar extrato
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Colar extrato</DialogTitle>
          <DialogDescription>
            Abra o app do banco ou a planilha, copie as linhas do último mês e cole aqui. Eu entendo o formato sozinho.
          </DialogDescription>
        </DialogHeader>

        {!linhas ? (
          <div className="space-y-3">
            <Textarea
              rows={10}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              className="font-mono text-xs"
              placeholder={`05/07  PIX ENVIADO FORNECEDOR ABC   -1.240,00
06/07  TED RECEBIDA CLIENTE XYZ      3.500,00
08/07  ALUGUEL JULHO                -3.200,00`}
            />
            <Button onClick={ler} disabled={lendo || texto.trim().length < 10} className="gap-2">
              {lendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Compass className="h-4 w-4" />}
              {lendo ? "Lendo e classificando..." : "Ler extrato"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="font-medium">{linhas.length} lançamentos encontrados</span>
              <span className="text-muted-foreground">
                Entradas {brl(totalEntradas)} · Saídas {brl(totalSaidas)} ·{" "}
                <span className={totalEntradas - totalSaidas >= 0 ? "text-revenue" : "text-expense"}>
                  Resultado {brl(totalEntradas - totalSaidas)}
                </span>
              </span>
              {resumoIa && (
                <Badge variant="secondary" className="gap-1">
                  <Compass className="h-3 w-3" />
                  {resumoIa.por_regra} por regra · {resumoIa.por_ia} pela IA
                  {resumoIa.sem_classificacao > 0 && ` · ${resumoIa.sem_classificacao} sem conta`}
                </Badge>
              )}
              {ignoradas > 0 && (
                <span className="text-xs text-muted-foreground">{ignoradas} linha(s) ignorada(s)</span>
              )}
            </div>

            <div className="border rounded-lg overflow-x-auto max-h-[42vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">Data</th>
                    <th className="px-3 py-2 font-medium">Descrição</th>
                    <th className="px-3 py-2 font-medium">Classifiquei como</th>
                    <th className="px-3 py-2 font-medium text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                        {new Date(l.data + "T00:00:00").toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-3 py-2 max-w-[220px] truncate" title={l.original}>{l.descricao}</td>
                      <td className="px-3 py-2">
                        <Select value={l.account_id ?? ""} onValueChange={(v) => trocarConta(i, v)}>
                          <SelectTrigger className={`h-8 text-xs ${!l.account_id ? "border-warning/30" : ""}`}>
                            <SelectValue placeholder="Escolher conta" />
                          </SelectTrigger>
                          <SelectContent>
                            {contas
                              .filter((c) => c.type === l.tipo)
                              .map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.code} {c.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${l.tipo === "revenue" ? "text-revenue" : "text-expense"}`}>
                        {l.tipo === "revenue" ? "+" : "−"}{brl(l.valor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {linhas.some((l) => !l.account_id) && (
              <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                Os lançamentos sem conta entram assim mesmo e você classifica depois, no fechamento do mês.
              </p>
            )}

            <div className="flex flex-wrap gap-3">
              <Button onClick={confirmar} disabled={salvando} className="gap-2">
                {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Confirmar {linhas.length} lançamentos
              </Button>
              <Button variant="outline" onClick={reiniciar}>Colar outro extrato</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
