import { mensagemDeErro } from "@/lib/erros";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Compass, Loader2, Check, CornerDownLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { lerLancamento, type LancamentoLido } from "@/lib/lancamento-texto";

/**
 * Lançar escrevendo.
 *
 * "paguei 350 de energia ontem" e pronto.
 *
 * A mediana dos usuários nunca lançou nada, e o formulário de sete campos é
 * parte da explicação. Colar extrato resolve o volume; isto resolve o avulso,
 * o gasto que o dono lembra no semáforo.
 *
 * Valor e data saem de código puro (`lerLancamento`), porque são número. A IA
 * entra só depois, e só para dizer em qual conta contábil aquilo cai, com a
 * regra aprendida da empresa rodando antes do modelo.
 */

interface Conta {
  id: string;
  name: string;
  code: string | null;
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function LancamentoRapido({ onLancado }: { onLancado?: () => void }) {
  const { company } = useCompany();
  const qc = useQueryClient();
  const [texto, setTexto] = useState("");
  const [lido, setLido] = useState<LancamentoLido | null>(null);
  const [conta, setConta] = useState<Conta | null>(null);
  const [origemConta, setOrigemConta] = useState<"regra" | "ia" | "nenhuma">("nenhuma");
  const [pensando, setPensando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  function limpar() {
    setTexto("");
    setLido(null);
    setConta(null);
    setOrigemConta("nenhuma");
  }

  async function interpretar() {
    if (!company) return;
    const r = lerLancamento(texto);
    if (!r) {
      toast.error("Não achei um valor aí. Tente algo como: paguei 350 de energia ontem.");
      return;
    }
    setLido(r);
    setPensando(true);
    try {
      const { data, error } = await supabase.functions.invoke("classificar-lote", {
        body: { company_id: company.id, itens: [{ descricao: r.descricao, tipo: r.tipo }] },
      });
      if (error) throw error;

      const resposta = data as {
        itens: Array<{ account_id: string | null; origem: "regra" | "ia" | "nenhuma" }>;
      };
      const sugestao = resposta.itens?.[0];
      setOrigemConta(sugestao?.origem ?? "nenhuma");

      if (sugestao?.account_id) {
        const { data: c } = await supabase
          .from("chart_of_accounts")
          .select("id, name, code")
          .eq("id", sugestao.account_id)
          .maybeSingle();
        setConta((c as Conta) ?? null);
      }
    } catch {
      // Sem classificação o lançamento entra assim mesmo. Registrar o dinheiro
      // é mais importante do que classificá-lo na hora.
      setOrigemConta("nenhuma");
    } finally {
      setPensando(false);
    }
  }

  async function confirmar() {
    if (!company || !lido) return;
    setSalvando(true);
    try {
      const { data: sessao } = await supabase.auth.getUser();
      const uid = sessao.user?.id;
      if (!uid) throw new Error("Sessão expirada. Entre de novo.");

      const { error } = await supabase.from("transactions").insert({
        company_id: company.id,
        user_id: uid,
        date: lido.data,
        description: lido.descricao,
        amount: lido.valor,
        type: lido.tipo,
        status: "confirmed",
        source: "texto",
        account_id: conta?.id ?? null,
      });
      if (error) throw error;

      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["dre"] });
      toast.success(`${lido.tipo === "revenue" ? "Entrada" : "Saída"} de ${brl(lido.valor)} lançada.`);
      limpar();
      onLancado?.();
    } catch (e) {
      toast.error("Não consegui lançar: " + mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex gap-2">
        <Input
          value={texto}
          onChange={(e) => { setTexto(e.target.value); if (lido) setLido(null); }}
          onKeyDown={(e) => { if (e.key === "Enter" && !pensando) interpretar(); }}
          placeholder="paguei 350 de energia ontem"
          aria-label="Lançar escrevendo"
        />
        <Button onClick={interpretar} disabled={pensando || texto.trim().length < 3} className="gap-2 shrink-0">
          {pensando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CornerDownLeft className="h-4 w-4" />}
          Ler
        </Button>
      </div>

      {lido && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className={lido.tipo === "revenue" ? "text-revenue font-medium" : "text-expense font-medium"}>
            {lido.tipo === "revenue" ? "+" : "−"}{brl(lido.valor)}
          </span>
          <span className="text-muted-foreground">·</span>
          <span>{new Date(lido.data + "T00:00:00").toLocaleDateString("pt-BR")}</span>
          <span className="text-muted-foreground">·</span>
          <span className="max-w-[220px] truncate">{lido.descricao}</span>

          {conta ? (
            <Badge variant="secondary" className="gap-1">
              <Compass className="h-3 w-3" />
              {conta.code} {conta.name}
              {origemConta === "regra" && " (regra)"}
            </Badge>
          ) : (
            <Badge variant="outline">sem conta</Badge>
          )}

          {lido.incerto.length > 0 && (
            <span className="text-xs text-muted-foreground">
              assumi {lido.incerto.includes("data") && "hoje"}
              {lido.incerto.length === 2 && " e "}
              {lido.incerto.includes("tipo") && "saída"}
            </span>
          )}

          <Button size="sm" onClick={confirmar} disabled={salvando} className="ml-auto gap-1.5">
            {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Lançar
          </Button>
          <Button size="sm" variant="ghost" onClick={limpar}>Cancelar</Button>
        </div>
      )}
    </div>
  );
}
