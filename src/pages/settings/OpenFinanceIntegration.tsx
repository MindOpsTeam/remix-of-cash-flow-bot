import { mensagemDeErro } from "@/lib/erros";
import { AppLayout } from "@/components/AppLayout";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Save, CheckCircle2, XCircle, Eye, EyeOff, ExternalLink,
  Loader2, Landmark, FlaskConical, ShieldAlert, Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useCompany } from "@/hooks/useCompany";
import { supabase } from "@/integrations/supabase/client";

interface OfConfig {
  company_id: string;
  provider: string;
  client_id_preview: string | null;
  sandbox: boolean;
  active: boolean;
  last_test_at: string | null;
  last_test_status: string | null;
  last_sync_at: string | null;
}

interface Conexao {
  id: string;
  provider: string;
  status: string;
  institution_name: string | null;
  last_synced_at: string | null;
}

export default function OpenFinanceIntegration() {
  const { company } = useCompany();
  const queryClient = useQueryClient();
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [verSegredo, setVerSegredo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [form, setForm] = useState<Partial<OfConfig>>({});

  const { data: config } = useQuery({
    queryKey: ["openfinance_config", company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("openfinance_config" as never)
        .select("*")
        .eq("company_id", company!.id)
        .eq("provider", "pluggy")
        .maybeSingle();
      return (data as OfConfig | null) ?? null;
    },
  });

  const { data: conexoes } = useQuery({
    queryKey: ["bank_connections", company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("bank_connections" as never)
        .select("id, provider, status, institution_name, last_synced_at")
        .eq("company_id", company!.id);
      return (data as Conexao[] | null) ?? [];
    },
  });

  useEffect(() => {
    if (config) setForm(config);
    else setForm({ sandbox: true, active: true, provider: "pluggy" });
  }, [config]);

  async function salvar() {
    if (!company?.id) return;
    setSalvando(true);
    try {
      if (clientId.trim()) {
        const { error } = await supabase.rpc("set_pluggy_credentials" as never, {
          p_company_id: company.id,
          p_client_id: clientId.trim(),
          p_client_secret: clientSecret.trim(),
        } as never);
        if (error) throw error;
      }
      const { error } = await supabase
        .from("openfinance_config" as never)
        .upsert(
          {
            company_id: company.id,
            provider: "pluggy",
            sandbox: form.sandbox !== false,
            active: form.active !== false,
          } as never,
          { onConflict: "company_id,provider" } as never,
        );
      if (error) throw error;

      setClientId("");
      setClientSecret("");
      queryClient.invalidateQueries({ queryKey: ["openfinance_config", company.id] });
      toast.success("Credenciais do Open Finance salvas no cofre");
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
      const { data, error } = await supabase.functions.invoke("openfinance-connect", {
        body: { action: "status", company_id: company.id },
      });
      if (error) throw error;
      const r = data as { configured?: boolean; origem?: string };
      if (r?.configured) {
        toast.success(
          r.origem === "vault"
            ? "Credenciais lidas do cofre desta empresa"
            : "Funcionando pela credencial global (env). Salve a sua para não depender dela.",
        );
      } else {
        toast.error("Nenhuma credencial encontrada. Cole o Client ID e o Secret da sua aplicação Pluggy.");
      }
      await supabase
        .from("openfinance_config" as never)
        .update({
          last_test_at: new Date().toISOString(),
          last_test_status: r?.configured ? `ok_${r.origem}` : "sem_credencial",
        } as never)
        .eq("company_id", company.id)
        .eq("provider", "pluggy");
      queryClient.invalidateQueries({ queryKey: ["openfinance_config", company.id] });
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
            <h1 className="text-2xl font-semibold tracking-tight">Open Finance</h1>
            <p className="text-sm text-muted-foreground">
              Extrato bancário oficial via Pluggy: saldo, lançamentos, cartão, investimentos e crédito.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Para conectar um banco você NÃO precisa de credencial própria: use o botão{" "}
              <Link to="/settings/bank-accounts" className="underline underline-offset-2 hover:text-foreground">
                Conectar banco
              </Link>{" "}
              em Bancos &amp; Open Finance. A credencial Pluggy abaixo é opcional, para quem quer usar a própria conta.
            </p>
          </div>
          {config?.last_test_status?.startsWith("ok") ? (
            <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" /> Conectado</Badge>
          ) : config ? (
            <Badge variant="secondary" className="gap-1"><XCircle className="h-3 w-3" /> Não testado</Badge>
          ) : null}
        </div>

        <section className="rounded-lg border p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-medium">1. Credenciais da sua aplicação</h2>
              <p className="text-sm text-muted-foreground">
                Pegue em dashboard.pluggy.ai, na aplicação. O par fica criptografado no cofre do banco.
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href="https://dashboard.pluggy.ai" target="_blank" rel="noreferrer">
                Abrir painel <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Client ID</Label>
              <Input
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder={config?.client_id_preview ?? "00000000-0000-0000-0000-000000000000"}
              />
              {config?.client_id_preview && (
                <p className="text-xs text-muted-foreground">Salvo: {config.client_id_preview}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Client Secret</Label>
              <Input
                type={verSegredo ? "text" : "password"}
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="mantido em segredo"
              />
              <button
                type="button"
                onClick={() => setVerSegredo((v) => !v)}
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                {verSegredo ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {verSegredo ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground border-t pt-3">
            O Secret nunca volta para a tela depois de salvo, nem para quem tem acesso de leitura ao banco.
            Só as funções do servidor conseguem lê-lo.
          </p>
        </section>

        <section className="rounded-lg border p-5 space-y-4">
          <h2 className="font-medium">2. Ambiente</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {[true, false].map((sb) => (
              <button
                key={String(sb)}
                type="button"
                onClick={() => setForm((f) => ({ ...f, sandbox: sb }))}
                className={`text-left rounded-md border p-3 transition ${
                  (form.sandbox !== false) === sb ? "border-primary ring-1 ring-primary/40 bg-primary/5" : "hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-2 font-medium text-sm">
                  {sb ? <FlaskConical className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                  {sb ? "Sandbox (teste)" : "Produção"}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {sb
                    ? "Mostra o Pluggy Bank fictício na lista de bancos. Use user-ok / password-ok."
                    : "Conecta bancos de verdade, com consentimento do titular."}
                </p>
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between border-t pt-4">
            <div>
              <Label className="text-sm">Integração ativa</Label>
              <p className="text-xs text-muted-foreground">Desligada, o sistema para de sincronizar extratos.</p>
            </div>
            <Switch checked={form.active !== false} onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))} />
          </div>
        </section>

        <section className="rounded-lg border p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-medium">3. Bancos conectados</h2>
              <p className="text-sm text-muted-foreground">
                A conexão é feita pelo titular, na tela de contas bancárias.
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/settings/bank-accounts">
                <Landmark className="h-3.5 w-3.5 mr-1" /> Conectar banco
              </Link>
            </Button>
          </div>
          {conexoes && conexoes.length > 0 ? (
            <ul className="divide-y rounded-md border">
              {conexoes.map((c) => (
                <li key={c.id} className="flex items-center justify-between p-3 text-sm">
                  <span className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    {c.institution_name ?? c.provider}
                  </span>
                  <span className="flex items-center gap-3">
                    <Badge variant={c.status === "updated" ? "default" : "secondary"}>{c.status}</Badge>
                    {c.last_synced_at && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(c.last_synced_at).toLocaleString("pt-BR")}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground border rounded-md p-3">
              Nenhum banco conectado ainda.
            </p>
          )}
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar
          </Button>
          <Button variant="outline" onClick={testar} disabled={testando}>
            {testando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
            Testar credenciais
          </Button>
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
