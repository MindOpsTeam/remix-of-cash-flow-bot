import { mensagemDeErro } from "@/lib/erros";
import { AppLayout } from "@/components/AppLayout";
import { Link } from "react-router-dom";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Search, Send, RefreshCw, FlaskConical, ShieldAlert, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useCompany } from "@/hooks/useCompany";
import { supabase } from "@/integrations/supabase/client";
import { montarGrupoIbsCbsFocus, regimeDestacaEm, CCLASS_TRIB_PADRAO } from "@/lib/reforma";

interface FocusCfg {
  environment: "homologacao" | "producao";
  enabled_nfse: boolean;
  active: boolean;
  token_homologacao_preview: string | null;
  token_producao_preview: string | null;
}

interface Resultado {
  status?: string;
  numero?: string;
  codigo_verificacao?: string;
  url?: string;
  caminho_xml_nota_fiscal?: string;
  caminho_danfse?: string;
  erros?: unknown;
  mensagem?: string;
  [k: string]: unknown;
}

/** Chama a edge function focus-nfe e devolve o corpo já desembrulhado. */
async function focus(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("focus-nfe", { body });
  if (error) throw new Error(error.message);
  const r = data as { ok: boolean; ambiente: string; data: unknown; error?: string };
  if (!r?.ok) throw new Error(r?.error ?? JSON.stringify(r?.data ?? "falha na Focus"));
  return r;
}

export default function FocusEmit() {
  const { company } = useCompany();
  const [refDoc, setRefDoc] = useState("");
  const [cnpjTomador, setCnpjTomador] = useState("");
  const [razaoTomador, setRazaoTomador] = useState("");
  const [emailTomador, setEmailTomador] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [itemLista, setItemLista] = useState("");
  const [aliquota, setAliquota] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [emitindo, setEmitindo] = useState(false);
  const [consultando, setConsultando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const { data: cfg } = useQuery({
    queryKey: ["focus_config", company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("focus_config" as never)
        .select("*")
        .eq("company_id", company!.id)
        .maybeSingle();
      return (data as FocusCfg | null) ?? null;
    },
  });

  const ambiente = cfg?.environment ?? "homologacao";

  // Reforma Tributária: a partir de 03/08/2026 o regime regular tem documento
  // rejeitado sem o grupo IBS/CBS; o Simples entra em 04/01/2027. A conta é a
  // mesma que o PlugNotas já usa, só muda o nome do campo.
  const regime = (company as { regimeTributario?: "simples" | "regular" | "mei" | null } | null)?.regimeTributario ?? "regular";
  const cclasstrib =
    (company as { cclasstribPadrao?: string | null } | null)?.cclasstribPadrao || CCLASS_TRIB_PADRAO;
  const destacaReforma = regimeDestacaEm(regime, new Date().getFullYear());
  const valorNumerico = parseFloat(valor.replace(/\./g, "").replace(",", ".")) || 0;
  const grupoReforma = destacaReforma && valorNumerico > 0
    ? montarGrupoIbsCbsFocus(valorNumerico, cclasstrib)
    : null;
  const pronto = !!cfg?.active && !!cfg?.enabled_nfse &&
    !!(ambiente === "producao" ? cfg?.token_producao_preview : cfg?.token_homologacao_preview);

  async function buscarCnpj() {
    const limpo = cnpjTomador.replace(/\D/g, "");
    if (limpo.length !== 14) return toast.error("Informe um CNPJ com 14 dígitos.");
    setBuscando(true);
    try {
      const r = await focus({ action: "cnpj", companyId: company!.id, cnpj: limpo });
      const d = r.data as Record<string, string>;
      setRazaoTomador(d?.razao_social ?? d?.nome ?? "");
      toast.success("Dados do tomador preenchidos pela Receita");
    } catch (e) {
      toast.error("Não achei esse CNPJ: " + mensagemDeErro(e));
    } finally {
      setBuscando(false);
    }
  }

  async function emitir() {
    if (!company?.id) return;
    const referencia = refDoc.trim() || `nfse-${company.id.slice(0, 8)}-${Date.now()}`;
    const valorNum = parseFloat(valor.replace(/\./g, "").replace(",", "."));
    if (!descricao.trim() || !(valorNum > 0)) return toast.error("Descrição e valor do serviço são obrigatórios.");

    setEmitindo(true);
    try {
      const r = await focus({
        action: "emitir",
        companyId: company.id,
        tipo: "nfse",
        referencia,
        dados: {
          data_emissao: new Date().toISOString().slice(0, 10),
          prestador: { cnpj: (company as { cnpj?: string }).cnpj ?? undefined },
          tomador: {
            cnpj: cnpjTomador.replace(/\D/g, "") || undefined,
            razao_social: razaoTomador || undefined,
            email: emailTomador || undefined,
          },
          servico: {
            discriminacao: descricao,
            valor_servicos: valorNum,
            item_lista_servico: itemLista || undefined,
            aliquota: aliquota ? parseFloat(aliquota.replace(",", ".")) : undefined,
            ...(destacaReforma ? montarGrupoIbsCbsFocus(valorNum, cclasstrib) : {}),
          },
        },
      });
      setRefDoc(referencia);
      setResultado(r.data as Resultado);
      toast.success(`Enviada em ${r.ambiente}. A prefeitura processa de forma assíncrona: consulte o status.`);
    } catch (e) {
      toast.error("A Focus recusou: " + mensagemDeErro(e));
    } finally {
      setEmitindo(false);
    }
  }

  async function consultar() {
    if (!company?.id || !refDoc.trim()) return;
    setConsultando(true);
    try {
      const r = await focus({ action: "consultar", companyId: company.id, tipo: "nfse", referencia: refDoc.trim() });
      setResultado(r.data as Resultado);
      toast.success("Status atualizado");
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setConsultando(false);
    }
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6 pb-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/fiscal"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">Emitir NFS-e pela Focus</h1>
            <p className="text-sm text-muted-foreground">Alternativa ao PlugNotas e à NFS-e Nacional.</p>
          </div>
          <Badge variant={ambiente === "producao" ? "default" : "secondary"} className="gap-1">
            {ambiente === "producao" ? <ShieldAlert className="h-3 w-3" /> : <FlaskConical className="h-3 w-3" />}
            {ambiente === "producao" ? "Produção" : "Homologação"}
          </Badge>
        </div>

        {!pronto && (
          <div className="rounded-md border border-warning/30 bg-warning/[0.08] p-4 text-sm flex items-center justify-between gap-4">
            <span>Falta configurar a Focus: token do ambiente selecionado, NFS-e habilitada e integração ativa.</span>
            <Button size="sm" variant="outline" asChild>
              <Link to="/settings/integrations/focus">Configurar <ExternalLink className="h-3 w-3 ml-1" /></Link>
            </Button>
          </div>
        )}

        <section className="rounded-lg border p-5 space-y-4">
          <h2 className="font-medium">Tomador</h2>
          <div className="flex gap-2">
            <div className="flex-1 space-y-1.5">
              <Label>CNPJ</Label>
              <Input value={cnpjTomador} onChange={(e) => setCnpjTomador(e.target.value)} placeholder="00.000.000/0000-00" />
            </div>
            <Button variant="outline" className="self-end" onClick={buscarCnpj} disabled={buscando || !pronto}>
              {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-1">Buscar</span>
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Razão social</Label>
              <Input value={razaoTomador} onChange={(e) => setRazaoTomador(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input value={emailTomador} onChange={(e) => setEmailTomador(e.target.value)} placeholder="para envio da nota" />
            </div>
          </div>
        </section>

        <section className="rounded-lg border p-5 space-y-4">
          <h2 className="font-medium">Serviço</h2>
          <div className="space-y-1.5">
            <Label>Discriminação</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3}
              placeholder="Descreva o serviço prestado como deve sair na nota" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="1500,00" />
            </div>
            <div className="space-y-1.5">
              <Label>Item da lista de serviço</Label>
              <Input value={itemLista} onChange={(e) => setItemLista(e.target.value)} placeholder="ex.: 1.07" />
            </div>
            <div className="space-y-1.5">
              <Label>Alíquota ISS (%)</Label>
              <Input value={aliquota} onChange={(e) => setAliquota(e.target.value)} placeholder="ex.: 2" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Referência</Label>
            <Input value={refDoc} onChange={(e) => setRefDoc(e.target.value)} placeholder="gerada automaticamente se vazia" />
            <p className="text-xs text-muted-foreground">
              Chave de idempotência: reenviar a mesma referência não duplica a nota.
            </p>
          </div>
        </section>

        {grupoReforma && (
          <section className="rounded-lg border border-warning/30 bg-warning/[0.08] p-4 space-y-2">
            <h2 className="font-medium text-sm">Reforma Tributária: o que vai na nota</h2>
            <div className="grid gap-2 sm:grid-cols-3 text-sm">
              <div>
                <span className="text-muted-foreground text-xs block">CBS ({grupoReforma.cbs_aliquota}%)</span>
                <span className="tabular-nums">{grupoReforma.cbs_valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
              </div>
              <div>
                <span className="text-muted-foreground text-xs block">IBS estadual ({grupoReforma.ibs_uf_aliquota}%)</span>
                <span className="tabular-nums">{grupoReforma.ibs_uf_valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
              </div>
              <div>
                <span className="text-muted-foreground text-xs block">Classificação</span>
                <span className="font-mono text-xs">{grupoReforma.ibs_cbs_classificacao_tributaria}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Em 2026 esses valores são só destaque, sem recolhimento. A classificação vem do cadastro da empresa;
              confirme com seu contador se ela vale para o seu município.{" "}
              <Link to="/settings/company" className="underline hover:text-foreground">Alterar</Link>
            </p>
          </section>
        )}

        <div className="flex flex-wrap gap-3">
          <Button onClick={emitir} disabled={emitindo || !pronto}>
            {emitindo ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Emitir NFS-e
          </Button>
          <Button variant="outline" onClick={consultar} disabled={consultando || !refDoc.trim()}>
            {consultando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Consultar status
          </Button>
        </div>

        {resultado && (
          <section className="rounded-lg border p-5 space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="font-medium">Resultado</h2>
              {resultado.status && <Badge variant="secondary">{String(resultado.status)}</Badge>}
            </div>
            {resultado.status === "processando_autorizacao" && (
              <p className="text-sm text-muted-foreground">
                A prefeitura ainda está processando. Consulte de novo em alguns segundos.
              </p>
            )}
            <div className="flex flex-wrap gap-3 text-sm">
              {resultado.caminho_danfse && (
                <a className="underline" href={`https://${ambiente === "producao" ? "api" : "homologacao"}.focusnfe.com.br${resultado.caminho_danfse}`} target="_blank" rel="noreferrer">
                  Baixar PDF
                </a>
              )}
              {resultado.caminho_xml_nota_fiscal && (
                <a className="underline" href={`https://${ambiente === "producao" ? "api" : "homologacao"}.focusnfe.com.br${resultado.caminho_xml_nota_fiscal}`} target="_blank" rel="noreferrer">
                  Baixar XML
                </a>
              )}
            </div>
            <pre className="text-xs bg-muted rounded p-3 overflow-x-auto max-h-72">
              {JSON.stringify(resultado, null, 2)}
            </pre>
          </section>
        )}
      </div>
    </AppLayout>
  );
}
