import { mensagemDeErro } from "@/lib/erros";
import { AppLayout } from "@/components/AppLayout";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Save, CheckCircle2, XCircle, Eye, EyeOff, ExternalLink,
  Loader2, FlaskConical, ShieldAlert, Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useCompany } from "@/hooks/useCompany";
import { supabase } from "@/integrations/supabase/client";

type Ambiente = "homologacao" | "producao";

interface FocusConfig {
  company_id: string;
  environment: Ambiente;
  token_homologacao_preview: string | null;
  token_producao_preview: string | null;
  enabled_nfse: boolean;
  enabled_nfe: boolean;
  enabled_nfce: boolean;
  enabled_cte: boolean;
  enabled_mdfe: boolean;
  serie_padrao: string | null;
  active: boolean;
  last_test_at: string | null;
  last_test_status: string | null;
  last_emission_at: string | null;
}

const DOCUMENTOS = [
  { campo: "enabled_nfse", rotulo: "NFS-e", detalhe: "Nota de serviço municipal" },
  { campo: "enabled_nfe", rotulo: "NF-e", detalhe: "Nota de produto (modelo 55)" },
  { campo: "enabled_nfce", rotulo: "NFC-e", detalhe: "Cupom fiscal ao consumidor" },
  { campo: "enabled_cte", rotulo: "CT-e", detalhe: "Conhecimento de transporte" },
  { campo: "enabled_mdfe", rotulo: "MDF-e", detalhe: "Manifesto de documentos" },
] as const;

export default function FocusIntegration() {
  const { company } = useCompany();
  const queryClient = useQueryClient();
  const [tokenHomolog, setTokenHomolog] = useState("");
  const [tokenProd, setTokenProd] = useState("");
  const [verTokens, setVerTokens] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [form, setForm] = useState<Partial<FocusConfig>>({});

  const { data: config, isLoading } = useQuery({
    queryKey: ["focus_config", company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("focus_config" as never)
        .select("*")
        .eq("company_id", company!.id)
        .maybeSingle();
      return (data as FocusConfig | null) ?? null;
    },
  });

  useEffect(() => {
    if (config) setForm(config);
    else setForm({ environment: "homologacao", enabled_nfse: true, active: true, serie_padrao: "1" });
  }, [config]);

  const ambiente = (form.environment ?? "homologacao") as Ambiente;
  const temTokenAmbiente =
    ambiente === "producao" ? !!config?.token_producao_preview : !!config?.token_homologacao_preview;

  async function salvar() {
    if (!company?.id) return;
    setSalvando(true);
    try {
      // 1) Tokens vão para o Vault por RPC — nunca para uma coluna.
      if (tokenHomolog.trim()) {
        const { error } = await supabase.rpc("set_focus_token" as never, {
          p_company_id: company.id, p_environment: "homologacao", p_token: tokenHomolog.trim(),
        } as never);
        if (error) throw error;
      }
      if (tokenProd.trim()) {
        const { error } = await supabase.rpc("set_focus_token" as never, {
          p_company_id: company.id, p_environment: "producao", p_token: tokenProd.trim(),
        } as never);
        if (error) throw error;
      }

      // 2) Preferências ficam na tabela.
      const payload = {
        company_id: company.id,
        environment: ambiente,
        enabled_nfse: !!form.enabled_nfse,
        enabled_nfe: !!form.enabled_nfe,
        enabled_nfce: !!form.enabled_nfce,
        enabled_cte: !!form.enabled_cte,
        enabled_mdfe: !!form.enabled_mdfe,
        serie_padrao: form.serie_padrao ?? "1",
        active: form.active !== false,
      };
      const { error } = await supabase
        .from("focus_config" as never)
        .upsert(payload as never, { onConflict: "company_id" } as never);
      if (error) throw error;

      setTokenHomolog("");
      setTokenProd("");
      queryClient.invalidateQueries({ queryKey: ["focus_config", company.id] });
      toast.success("Configuração da Focus NFe salva");
    } catch (e) {
      toast.error("Não foi possível salvar: " + mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }

  async function testar() {
    if (!company?.id) return;
    setTestando(true);
    try {
      const { data, error } = await supabase.functions.invoke("focus-nfe", {
        body: { action: "test", companyId: company.id },
      });
      if (error) throw error;
      const resp = data as { ok?: boolean; ambiente?: string; data?: unknown; error?: string };
      if (resp?.ok) {
        const qtd = Array.isArray(resp.data) ? resp.data.length : 0;
        toast.success(`Conexão OK em ${resp.ambiente} — ${qtd} empresa(s) na conta Focus`);
      } else {
        toast.error(resp?.error ?? "A Focus recusou o token. Confira se é o token do ambiente selecionado.");
      }
      queryClient.invalidateQueries({ queryKey: ["focus_config", company.id] });
    } catch (e) {
      toast.error("Falha no teste: " + mensagemDeErro(e));
    } finally {
      setTestando(false);
    }
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6 pb-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/settings/integrations"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">Focus NFe</h1>
            <p className="text-sm text-muted-foreground">
              Emissão automática de NF-e, NFC-e, NFS-e, CT-e e MDF-e por uma API só.
            </p>
          </div>
          {config?.last_test_status === "ok" ? (
            <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" /> Conectado</Badge>
          ) : config ? (
            <Badge variant="secondary" className="gap-1"><XCircle className="h-3 w-3" /> Não testado</Badge>
          ) : null}
        </div>

        {/* Passo 1: token */}
        <section className="rounded-lg border p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-medium">1. Token de acesso</h2>
              <p className="text-sm text-muted-foreground">
                Pegue no painel da Focus, em API &gt; Tokens. Homologação e produção têm tokens diferentes.
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href="https://app.focusnfe.com.br" target="_blank" rel="noreferrer">
                Abrir painel <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <FlaskConical className="h-3.5 w-3.5" /> Token de homologação
              </Label>
              <Input
                type={verTokens ? "text" : "password"}
                placeholder={config?.token_homologacao_preview ?? "cole o token de teste"}
                value={tokenHomolog}
                onChange={(e) => setTokenHomolog(e.target.value)}
              />
              {config?.token_homologacao_preview && (
                <p className="text-xs text-muted-foreground">Salvo: {config.token_homologacao_preview}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5" /> Token de produção
              </Label>
              <Input
                type={verTokens ? "text" : "password"}
                placeholder={config?.token_producao_preview ?? "cole o token real"}
                value={tokenProd}
                onChange={(e) => setTokenProd(e.target.value)}
              />
              {config?.token_producao_preview && (
                <p className="text-xs text-muted-foreground">Salvo: {config.token_producao_preview}</p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setVerTokens((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            {verTokens ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {verTokens ? "Ocultar" : "Mostrar"} o que estou digitando
          </button>

          <p className="text-xs text-muted-foreground border-t pt-3">
            O token é guardado criptografado no cofre do banco. Ninguém consegue lê-lo pela aplicação, nem você
            depois de salvo: aparece só o final, para conferência.
          </p>
        </section>

        {/* Passo 2: ambiente */}
        <section className="rounded-lg border p-5 space-y-4">
          <div>
            <h2 className="font-medium">2. Ambiente</h2>
            <p className="text-sm text-muted-foreground">
              Comece em homologação. Nota emitida ali não tem valor fiscal e serve para validar o layout.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {(["homologacao", "producao"] as Ambiente[]).map((amb) => (
              <button
                key={amb}
                type="button"
                onClick={() => setForm((f) => ({ ...f, environment: amb }))}
                className={`text-left rounded-md border p-3 transition ${
                  ambiente === amb ? "border-primary ring-1 ring-primary/40 bg-primary/5" : "hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-2 font-medium text-sm">
                  {amb === "homologacao" ? <FlaskConical className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                  {amb === "homologacao" ? "Homologação (teste)" : "Produção (valor fiscal)"}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {amb === "homologacao"
                    ? "Sem valor fiscal. Use para conferir a nota antes de valer."
                    : "Emite de verdade na SEFAZ ou na prefeitura. Cancelamento tem prazo."}
                </p>
              </button>
            ))}
          </div>

          {ambiente === "producao" && (
            <div className="rounded-md border border-warning/30 bg-warning/[0.08] p-3 text-sm">
              <strong>Atenção.</strong> Em produção, cada emissão é um ato fiscal irreversível. A NFC-e só pode ser
              cancelada em até 30 minutos, e a NF-e em geral em 24 horas.
            </div>
          )}

          <div className="flex items-center justify-between border-t pt-4">
            <div>
              <Label className="text-sm">Integração ativa</Label>
              <p className="text-xs text-muted-foreground">Desligado, o sistema não emite pela Focus.</p>
            </div>
            <Switch
              checked={form.active !== false}
              onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
            />
          </div>
        </section>

        {/* Passo 3: documentos */}
        <section className="rounded-lg border p-5 space-y-4">
          <div>
            <h2 className="font-medium">3. Documentos que esta empresa emite</h2>
            <p className="text-sm text-muted-foreground">
              Só aparece na tela de emissão o que estiver ligado aqui.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {DOCUMENTOS.map((d) => (
              <div key={d.campo} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="text-sm font-medium flex items-center gap-1.5">
                    <Receipt className="h-3.5 w-3.5 text-muted-foreground" /> {d.rotulo}
                  </div>
                  <p className="text-xs text-muted-foreground">{d.detalhe}</p>
                </div>
                <Switch
                  checked={!!form[d.campo]}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, [d.campo]: v }))}
                />
              </div>
            ))}
          </div>
          <div className="space-y-1.5 border-t pt-4 max-w-[200px]">
            <Label className="text-sm">Série padrão</Label>
            <Input
              value={form.serie_padrao ?? "1"}
              onChange={(e) => setForm((f) => ({ ...f, serie_padrao: e.target.value }))}
            />
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={salvar} disabled={salvando || isLoading}>
            {salvando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar
          </Button>
          <Button variant="outline" onClick={testar} disabled={testando || !temTokenAmbiente}>
            {testando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
            Testar conexão
          </Button>
          {!temTokenAmbiente && (
            <span className="text-xs text-muted-foreground">
              Salve o token de {ambiente === "producao" ? "produção" : "homologação"} para poder testar.
            </span>
          )}
          {config?.last_test_at && (
            <span className="text-xs text-muted-foreground">
              Último teste: {new Date(config.last_test_at).toLocaleString("pt-BR")} ({config.last_test_status})
            </span>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
