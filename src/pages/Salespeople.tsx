import { mensagemDeErro } from "@/lib/erros";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Plus, Loader2, HandCoins, Target } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";

/**
 * Vendedores, metas e comissão.
 *
 * Antes `sales_orders.salesperson` era um campo de texto livre, então "João",
 * "joão" e "Joao Silva" eram três vendedores diferentes e não existia ranking,
 * comissão nem meta. As colunas `commission_percent` e `commission_value` já
 * existiam na tabela e a tela nunca as gravava, o que é pior que não existirem:
 * dão a impressão de que o recurso está lá.
 *
 * A comissão vira CONTA A PAGAR no fechamento. Comissão que fica só em
 * relatório não aparece no fluxo de caixa nem no DRE, e a empresa se surpreende
 * quando o vendedor cobra.
 */

interface Vendedor {
  id: string;
  name: string;
  email: string | null;
  comissao_padrao: number;
  active: boolean;
}

interface LinhaMeta {
  salesperson_id: string | null;
  vendedor: string | null;
  mes: string;
  meta: number | null;
  vendido: number;
  pedidos: number;
  comissao: number;
  atingimento_pct: number | null;
}

const brl = (v: number | null) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function mesAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function SalespeoplePage() {
  const { company } = useCompany();
  const qc = useQueryClient();
  const [dialogo, setDialogo] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", comissao_padrao: "0" });
  const [mes] = useState(mesAtual());
  const [metas, setMetas] = useState<Record<string, string>>({});
  const [fechando, setFechando] = useState(false);

  const { data: vendedores = [] } = useQuery({
    queryKey: ["salespeople", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data } = await supabase
        .from("salespeople" as never)
        .select("id, name, email, comissao_padrao, active")
        .eq("company_id", company!.id)
        .eq("active", true)
        .order("name");
      return (data ?? []) as unknown as Vendedor[];
    },
  });

  const { data: desempenho = [] } = useQuery({
    queryKey: ["meta_vendedor", company?.id, mes],
    enabled: !!company,
    queryFn: async () => {
      const { data } = await supabase
        .from("v_meta_vendedor" as never)
        .select("salesperson_id, vendedor, mes, meta, vendido, pedidos, comissao, atingimento_pct")
        .eq("company_id", company!.id)
        .eq("mes", mes);
      return (data ?? []) as unknown as LinhaMeta[];
    },
  });

  const criar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("salespeople" as never).insert({
        company_id: company!.id,
        name: form.name.trim(),
        email: form.email.trim() || null,
        comissao_padrao: Number(form.comissao_padrao) || 0,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vendedor cadastrado.");
      qc.invalidateQueries({ queryKey: ["salespeople", company?.id] });
      setDialogo(false);
      setForm({ name: "", email: "", comissao_padrao: "0" });
    },
    onError: (e: Error) => toast.error("Não consegui salvar: " + mensagemDeErro(e)),
  });

  async function salvarMeta(vendedorId: string) {
    const valor = Number(metas[vendedorId]);
    if (!Number.isFinite(valor) || valor <= 0) {
      toast.error("Meta precisa ser maior que zero.");
      return;
    }
    const { error } = await supabase.from("sales_targets" as never).upsert(
      { company_id: company!.id, salesperson_id: vendedorId, mes, meta: valor } as never,
      { onConflict: "company_id,salesperson_id,mes" } as never,
    );
    if (error) { toast.error("Não consegui salvar a meta: " + mensagemDeErro(error)); return; }
    toast.success("Meta salva.");
    qc.invalidateQueries({ queryKey: ["meta_vendedor", company?.id, mes] });
  }

  async function fecharComissao() {
    setFechando(true);
    try {
      const { data, error } = await supabase.rpc("fechar_comissao" as never, {
        p_company_id: company!.id,
        p_mes: mes,
      } as never);
      if (error) throw error;
      const r = data as unknown as { contas_criadas: number; total: number };
      if (r.contas_criadas === 0) {
        toast.info("Nenhuma comissão nova a lançar neste mês.");
      } else {
        toast.success(`${r.contas_criadas} comissão(ões) lançadas em Contas a Pagar, ${brl(r.total)}.`);
      }
      qc.invalidateQueries({ queryKey: ["bills_payable"] });
    } catch (e) {
      toast.error("Não consegui fechar: " + mensagemDeErro(e));
    } finally {
      setFechando(false);
    }
  }

  const porVendedor = new Map(desempenho.filter((d) => d.salesperson_id).map((d) => [d.salesperson_id!, d]));
  const rotuloMes = new Date(mes + "T00:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <AppLayout>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-[-0.02em]">Vendedores</h1>
          </div>
          <p className="mt-1 text-sm capitalize text-muted-foreground">
            Meta e comissão de {rotuloMes}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={fecharComissao} disabled={fechando} className="gap-2">
            {fechando ? <Loader2 className="h-4 w-4 animate-spin" /> : <HandCoins className="h-4 w-4" />}
            Lançar comissão do mês
          </Button>
          <Button onClick={() => setDialogo(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Vendedor
          </Button>
        </div>
      </div>

      {vendedores.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">Nenhum vendedor cadastrado.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Com vendedor cadastrado, o pedido passa a render ranking, meta e comissão.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-4 py-2.5 font-medium">Vendedor</th>
                <th className="px-4 py-2.5 text-right font-medium">Vendido</th>
                <th className="px-4 py-2.5 text-right font-medium">Meta</th>
                <th className="px-4 py-2.5 text-right font-medium">Atingimento</th>
                <th className="px-4 py-2.5 text-right font-medium">Comissão</th>
              </tr>
            </thead>
            <tbody>
              {vendedores.map((v) => {
                const d = porVendedor.get(v.id);
                const pct = d?.atingimento_pct ?? null;
                return (
                  <tr key={v.id} className="border-t border-border">
                    <td className="px-4 py-2.5">
                      <span className="block">{v.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {v.comissao_padrao}% padrão{d?.pedidos ? ` · ${d.pedidos} pedido(s)` : ""}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{brl(d?.vendido ?? 0)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <Input
                          className="h-8 w-28 text-right"
                          inputMode="decimal"
                          placeholder={d?.meta != null ? String(d.meta) : "definir"}
                          value={metas[v.id] ?? (d?.meta != null ? String(d.meta) : "")}
                          onChange={(e) => setMetas({ ...metas, [v.id]: e.target.value })}
                          onBlur={() => { if (metas[v.id]) salvarMeta(v.id); }}
                        />
                        <Target className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {pct == null ? (
                        <span className="text-xs text-muted-foreground">sem meta</span>
                      ) : (
                        <Badge variant={pct >= 100 ? "default" : "secondary"}>{pct}%</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{brl(d?.comissao ?? 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        O realizado conta só pedido faturado ou entregue. Comissão sobre proposta que nunca virou nota é dívida
        que a empresa cria contra si mesma.
      </p>

      <Dialog open={dialogo} onOpenChange={setDialogo}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Novo vendedor</DialogTitle>
            <DialogDescription>
              A comissão padrão vale quando o pedido não trouxer um percentual próprio.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input className="mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">E-mail</Label>
              <Input className="mt-1" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Comissão padrão (%)</Label>
              <Input
                className="mt-1" inputMode="decimal" value={form.comissao_padrao}
                onChange={(e) => setForm({ ...form, comissao_padrao: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogo(false)}>Cancelar</Button>
            <Button onClick={() => criar.mutate()} disabled={criar.isPending || form.name.trim().length < 2}>
              {criar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Cadastrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
