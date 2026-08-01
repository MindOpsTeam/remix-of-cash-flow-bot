import { mensagemDeErro } from "@/lib/erros";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
import { CustomWidget, type DashboardWidget } from "@/components/bi/CustomWidget";
import {
  METRICAS_BI,
  METRICA_POR_KEY,
  tiposPermitidos,
  widgetConfigSchema,
  type DimensaoBI,
  type TipoGrafico,
} from "@/lib/bi-catalog";

/**
 * BI self-service: as visões que o cliente cria e deixa no cockpit. Widget é
 * da empresa (todo membro vê); o builder valida a combinação com zod antes de
 * gravar — configuração inválida não entra no banco.
 */

const TIPO_LABEL: Record<TipoGrafico, string> = {
  bar: "Barras",
  line: "Linha",
  area: "Área",
  table: "Tabela",
};

const DIMENSAO_LABEL: Record<DimensaoBI, string> = {
  tempo: "Ao longo do tempo",
  empresa: "Por CNPJ",
  centro_custo: "Por centro de custo",
  cliente: "Por cliente",
};

type WidgetsFrom = (table: string) => {
  select: (q: string) => {
    in: (c: string, v: string[]) => {
      order: (c: string, o: { ascending: boolean }) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
    };
  };
  insert: (row: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null }>;
  update: (patch: Record<string, unknown>) => {
    eq: (c: string, v: string) => PromiseLike<{ error: { message: string } | null }>;
  };
  delete: () => { eq: (c: string, v: string) => PromiseLike<{ error: { message: string } | null }> };
};
const widgetsTable = () => (supabase.from as unknown as WidgetsFrom)("dashboard_widgets");

export function MinhasVisoes() {
  const { companies, scope, company } = useCompany();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const scopedIds = (scope === "all" ? companies : companies.filter((c) => c.id === scope)).map((c) => c.id);
  const holder = scope === "all" ? companies[0]?.id : company?.id;
  const nomesEmpresas = useMemo(
    () => Object.fromEntries(companies.map((c) => [c.id, c.name])),
    [companies],
  );

  const [aberto, setAberto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [metrica, setMetrica] = useState("");
  const [dimensao, setDimensao] = useState<DimensaoBI | "">("");
  const [tipo, setTipo] = useState<TipoGrafico | "">("");

  const { data: widgets = [] } = useQuery({
    queryKey: ["dashboard_widgets", scopedIds.join(",")],
    enabled: scopedIds.length > 0,
    queryFn: async () => {
      const { data, error } = await widgetsTable()
        .select("id, titulo, config, posicao")
        .in("company_id", scopedIds)
        .order("posicao", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as DashboardWidget[];
    },
  });

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ["dashboard_widgets"] });

  const criar = useMutation({
    mutationFn: async () => {
      if (!holder || !user) throw new Error("Sessão ou empresa indisponível.");
      if (!titulo.trim()) throw new Error("Dê um título à visão.");
      const parsed = widgetConfigSchema.safeParse({ metrica, dimensao, tipo });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Configuração inválida.");
      const { error } = await widgetsTable().insert({
        company_id: holder,
        user_id: user.id,
        titulo: titulo.trim(),
        config: parsed.data,
        posicao: widgets.length,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Visão criada.");
      setAberto(false);
      setTitulo("");
      setMetrica("");
      setDimensao("");
      setTipo("");
      invalidar();
    },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await widgetsTable().delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidar,
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  const mover = useMutation({
    mutationFn: async ({ id, direcao }: { id: string; direcao: -1 | 1 }) => {
      const idx = widgets.findIndex((w) => w.id === id);
      // idx -1 com direcao +1 cairia em widgets[0] e trocaria posições erradas
      // (widget removido por outro membro com o cache local ainda velho).
      if (idx < 0) return;
      const alvo = widgets[idx + direcao];
      if (!alvo) return;
      await widgetsTable().update({ posicao: alvo.posicao }).eq("id", id);
      await widgetsTable().update({ posicao: widgets[idx].posicao }).eq("id", alvo.id);
    },
    onSuccess: invalidar,
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  const metricaDef = metrica ? METRICA_POR_KEY[metrica] : undefined;
  const dimensoesDisponiveis = metricaDef?.dimensoes ?? [];
  const tiposDisponiveis = dimensao ? tiposPermitidos(dimensao) : [];

  return (
    <section aria-label="Minhas visões">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2 border-b border-border/70 pb-4">
        <div>
          <span className="via-eyebrow">BI sob medida</span>
          <h2 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-foreground">Minhas visões</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Gráficos que você monta e ficam no cockpit, visíveis para todo o time.
          </p>
        </div>
        <Dialog open={aberto} onOpenChange={setAberto}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> Novo gráfico
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Nova visão</DialogTitle>
              <DialogDescription>Escolha a métrica, como cortar e o formato. Três passos e pronto.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Título</Label>
                <Input
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ex.: Receita dos últimos 12 meses"
                />
              </div>
              <div className="space-y-1.5">
                <Label>1 · Métrica</Label>
                <Select
                  value={metrica}
                  onValueChange={(v) => {
                    setMetrica(v);
                    const dims = METRICA_POR_KEY[v]?.dimensoes ?? [];
                    setDimensao(dims.length === 1 ? dims[0] : "");
                    setTipo("");
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="O que medir" /></SelectTrigger>
                  <SelectContent>
                    {METRICAS_BI.map((m) => (
                      <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>2 · Corte</Label>
                <Select
                  value={dimensao}
                  onValueChange={(v) => {
                    setDimensao(v as DimensaoBI);
                    setTipo("");
                  }}
                  disabled={!metrica}
                >
                  <SelectTrigger><SelectValue placeholder="Como agrupar" /></SelectTrigger>
                  <SelectContent>
                    {dimensoesDisponiveis.map((d) => (
                      <SelectItem key={d} value={d}>{DIMENSAO_LABEL[d]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>3 · Formato</Label>
                <Select value={tipo} onValueChange={(v) => setTipo(v as TipoGrafico)} disabled={!dimensao}>
                  <SelectTrigger><SelectValue placeholder="Como desenhar" /></SelectTrigger>
                  <SelectContent>
                    {tiposDisponiveis.map((t) => (
                      <SelectItem key={t} value={t}>{TIPO_LABEL[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full gap-2"
                onClick={() => criar.mutate()}
                disabled={criar.isPending || !titulo.trim() || !metrica || !dimensao || !tipo}
              >
                {criar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LayoutDashboard className="h-4 w-4" />}
                Adicionar ao cockpit
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {widgets.length === 0 ? (
        <div className="mb-8 flex flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/20 px-6 py-8 text-center">
          <LayoutDashboard className="mb-2 h-6 w-6 text-muted-foreground" strokeWidth={1.6} />
          <p className="text-sm font-medium text-foreground">Monte o seu primeiro gráfico</p>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
            Receita por CNPJ, despesa por centro de custo, recebíveis por vencimento: você escolhe a métrica, o corte e o formato.
          </p>
        </div>
      ) : (
        <div className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
          {widgets.map((w, i) => (
            <CustomWidget
              key={w.id}
              widget={w}
              scopedIds={scopedIds}
              nomesEmpresas={nomesEmpresas}
              onRemove={(id) => remover.mutate(id)}
              onMove={(id, direcao) => mover.mutate({ id, direcao })}
              podeMover={{ cima: i > 0, baixo: i < widgets.length - 1 }}
            />
          ))}
        </div>
      )}
    </section>
  );
}
