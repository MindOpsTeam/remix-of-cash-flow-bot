import { mensagemDeErro } from "@/lib/erros";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert, Compass, Loader2, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";

/**
 * Pronto para 3 de agosto.
 *
 * A partir de 03/08/2026 o grupo IBS/CBS é obrigatório no documento fiscal, e a
 * LC 227/2026 art. 341-G VI põe a multa em quem DESENVOLVE o software, não no
 * cliente. Produto sem NCM ou sem cClassTrib depois dessa data é exposição
 * nossa. Em produção estavam 22 de 22 sem cClassTrib.
 *
 * A IA propõe o lote inteiro, o humano confere linha a linha e confirma. Nada é
 * gravado sem confirmação: classificação fiscal errada gera multa, então aqui o
 * modelo sugere e não decide.
 */

interface Pendencia {
  id: string;
  name: string;
  type: string;
  sku: string | null;
  ncm: string | null;
  cclasstrib: string | null;
  falta_ncm: boolean;
  falta_cclasstrib: boolean;
  bloqueia_emissao: boolean;
}

interface Sugestao {
  id: string;
  ncm: string | null;
  cclasstrib: string | null;
  confidence: "high" | "medium" | "low";
  justificativa: string;
  cclasstrib_conferido: boolean;
}

interface Resumo {
  total: number;
  com_ncm: number;
  com_cclasstrib: number;
  tabela_oficial: boolean;
  custo_centavos: number;
}

const PRAZO = new Date("2026-08-03T00:00:00");

export function ProntoParaAgosto() {
  const { company } = useCompany();
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [sugerindo, setSugerindo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [edicoes, setEdicoes] = useState<Record<string, { ncm: string; cclasstrib: string }>>({});
  const [resumo, setResumo] = useState<Resumo | null>(null);

  const { data: pendencias = [] } = useQuery({
    queryKey: ["produtos_pendencia_fiscal", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data } = await supabase
        // Cast enquanto os tipos gerados (regerados pelo Lovable, dono do
        // projeto Supabase) não conhecem esta view. O formato está fixado em
        // Pendencia e é o mesmo declarado na migration.
        .from("v_produtos_pendencia_fiscal" as never)
        .select("id, name, type, sku, ncm, cclasstrib, falta_ncm, falta_cclasstrib, bloqueia_emissao")
        .eq("company_id", company!.id)
        .eq("bloqueia_emissao", true);
      return (data ?? []) as unknown as Pendencia[];
    },
  });

  const diasParaOPrazo = Math.ceil((PRAZO.getTime() - Date.now()) / 86_400_000);

  async function sugerir() {
    if (!company) return;
    setSugerindo(true);
    try {
      const { data, error } = await supabase.functions.invoke("sugerir-fiscal", {
        body: { company_id: company.id, product_ids: pendencias.map((p) => p.id) },
      });
      if (error) throw error;

      const r = data as { sugestoes: Sugestao[]; resumo: Resumo };
      setEdicoes(
        Object.fromEntries(
          r.sugestoes.map((s) => [s.id, { ncm: s.ncm ?? "", cclasstrib: s.cclasstrib ?? "" }]),
        ),
      );
      setResumo(r.resumo);
      if (!r.resumo.tabela_oficial) {
        toast.warning("A tabela oficial de cClassTrib não está carregada aqui.", {
          description: "As sugestões saem sem conferência contra ela. Confira antes de confirmar.",
        });
      }
    } catch (e) {
      toast.error("Não consegui sugerir agora: " + mensagemDeErro(e));
    } finally {
      setSugerindo(false);
    }
  }

  async function confirmar() {
    if (!company) return;
    const paraSalvar = Object.entries(edicoes).filter(
      ([, v]) => v.ncm.trim() !== "" || v.cclasstrib.trim() !== "",
    );
    if (paraSalvar.length === 0) {
      toast.info("Nada preenchido para salvar.");
      return;
    }

    setSalvando(true);
    try {
      const { data: sessao } = await supabase.auth.getUser();
      let salvos = 0;
      for (const [id, v] of paraSalvar) {
        const patch: Record<string, unknown> = {
          // Quem confirmou foi um humano nesta tela, então a origem é 'humano'
          // mesmo que a IA tenha proposto. É essa marca que separa o que foi
          // conferido do que foi chutado.
          fiscal_origem: "humano",
          fiscal_confirmado_em: new Date().toISOString(),
          fiscal_confirmado_por: sessao.user?.id ?? null,
        };
        if (v.ncm.trim()) patch.ncm = v.ncm.trim();
        if (v.cclasstrib.trim()) patch.cclasstrib = v.cclasstrib.trim();

        const { error } = await supabase.from("products").update(patch).eq("id", id);
        if (!error) salvos++;
      }
      toast.success(`${salvos} produto(s) classificados.`);
      qc.invalidateQueries({ queryKey: ["produtos_pendencia_fiscal", company.id] });
      qc.invalidateQueries({ queryKey: ["products"] });
      setAberto(false);
      setEdicoes({});
      setResumo(null);
    } catch (e) {
      toast.error("Não consegui salvar: " + mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }

  if (pendencias.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="mb-5 flex w-full items-start gap-3 rounded-lg border border-warning/30 bg-warning/[0.08] p-4 text-left transition-colors hover:bg-warning/[0.08]"
      >
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning dark:text-warning" />
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {pendencias.length} produto(s) não poderão emitir nota a partir de 3 de agosto
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Falta NCM ou classificação tributária do IBS/CBS.{" "}
            {diasParaOPrazo > 0 ? `Faltam ${diasParaOPrazo} dia(s).` : "O prazo já passou."} Clique para resolver com IA.
          </p>
        </div>
      </button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Classificação fiscal dos produtos</DialogTitle>
            <DialogDescription>
              A IA propõe, você confere e confirma. Nada é gravado sem a sua confirmação, porque classificação
              fiscal errada gera multa.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={sugerir} disabled={sugerindo} className="gap-2">
              {sugerindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Compass className="h-4 w-4" />}
              {sugerindo ? "Analisando..." : "Sugerir com IA"}
            </Button>
            {resumo && (
              <Badge variant="secondary">
                {resumo.com_ncm} NCM · {resumo.com_cclasstrib} cClassTrib
                {!resumo.tabela_oficial && " · sem conferência oficial"}
              </Badge>
            )}
          </div>

          {resumo && !resumo.tabela_oficial && (
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              A tabela oficial de cClassTrib ainda não foi carregada neste ambiente, então as sugestões não foram
              conferidas contra ela. Confira antes de confirmar.
            </p>
          )}

          <div className="max-h-[46vh] overflow-y-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/50">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Produto</th>
                  <th className="px-3 py-2 font-medium">NCM</th>
                  <th className="px-3 py-2 font-medium">cClassTrib</th>
                </tr>
              </thead>
              <tbody>
                {pendencias.map((p) => {
                  const e = edicoes[p.id] ?? { ncm: p.ncm ?? "", cclasstrib: p.cclasstrib ?? "" };
                  const ehServico = p.type === "service";
                  return (
                    <tr key={p.id} className="border-t">
                      <td className="px-3 py-2">
                        <span className="block max-w-[260px] truncate">{p.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {ehServico ? "Serviço" : "Mercadoria"}{p.sku ? ` · ${p.sku}` : ""}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          className="h-8 w-32 font-mono text-xs"
                          value={e.ncm}
                          placeholder={ehServico ? "não se aplica" : "8 dígitos"}
                          disabled={ehServico}
                          onChange={(ev) => setEdicoes({ ...edicoes, [p.id]: { ...e, ncm: ev.target.value } })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          className="h-8 w-28 font-mono text-xs"
                          value={e.cclasstrib}
                          placeholder="6 dígitos"
                          onChange={(ev) => setEdicoes({ ...edicoes, [p.id]: { ...e, cclasstrib: ev.target.value } })}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAberto(false)}>Fechar</Button>
            <Button onClick={confirmar} disabled={salvando} className="gap-2">
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Confirmar classificação
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
