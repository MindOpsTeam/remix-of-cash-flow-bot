import { useEffect, useState } from "react";
import { PluggyConnect } from "react-pluggy-connect";
import { Link } from "react-router-dom";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  FlaskConical, Landmark, KeyRound, CheckCircle2, Loader2, ExternalLink, ArrowRight, ArrowLeft, Gift,
} from "lucide-react";
import { MEUPLUGGY_CONNECTOR_ID, parseItemIds } from "@/lib/openfinance";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { toast } from "sonner";

type Modo = "sandbox" | "producao" | "gratis";
type Passo = "objetivo" | "credenciais" | "conectar" | "pronto";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected?: () => void;
}

/** Máscara leve de CNPJ (14 díg.) ou CPF (11 díg.); devolve como veio se não bater. */
function formatCnpj(doc: string): string {
  const d = (doc ?? "").replace(/\D/g, "");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return doc;
}

/**
 * Lê a mensagem de erro de uma edge function. Em resposta não-2xx o supabase-js
 * põe o corpo em `error.context` (Response) e deixa `data` vazio; sem isto o
 * usuário só veria "Edge Function returned a non-2xx status code".
 */
async function mensagemDaEdge(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response })?.context;
  if (ctx && typeof ctx.json === "function") {
    try {
      const corpo = await ctx.clone().json();
      if (corpo?.detail) return String(corpo.detail);
      if (corpo?.error === "PLUGGY_NOT_CONFIGURED") return "Credenciais Pluggy ausentes. Volte e salve o Client ID e o Client Secret.";
      if (corpo?.error) return String(corpo.error);
    } catch {
      // corpo não é JSON: cai na mensagem genérica abaixo
    }
  }
  return error instanceof Error ? error.message : String(error);
}

/**
 * Wizard guiado de Open Finance (Pluggy). Deixa o passo a passo explícito:
 * objetivo (testar no sandbox x banco real) → credenciais (cofre) → conexão
 * embedada do banco → pronto. A distinção sandbox x produção é do APP Pluggy:
 * app Development/Demo só conecta o banco de teste; banco real exige app de produção.
 * O modo "gratis" usa o MeuPluggy: a pessoa conecta os bancos no meu.pluggy.ai
 * (portal gratuito da Pluggy, até 5 conexões) e autoriza a aplicação dela a ler.
 * Chega aqui pelo widget filtrado no conector MeuPluggy ou colando o Item ID.
 */
export function OpenFinanceSetupWizard({ open, onOpenChange, onConnected }: Props) {
  const { company } = useCompany();
  const [passo, setPasso] = useState<Passo>("objetivo");
  const [modo, setModo] = useState<Modo | null>(null);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [jaConfigurado, setJaConfigurado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [carregandoToken, setCarregandoToken] = useState(false);
  const [staged, setStaged] = useState<number | null>(null);
  const [itemIdsTexto, setItemIdsTexto] = useState("");
  const [registrandoIds, setRegistrandoIds] = useState(false);

  // Ao abrir, descobre se já há credencial salva (para poder pular a etapa 2).
  useEffect(() => {
    if (!open || !company) return;
    setPasso("objetivo"); setModo(null); setClientId(""); setClientSecret("");
    setToken(null); setStaged(null); setItemIdsTexto("");
    (async () => {
      const { data } = await supabase
        .from("openfinance_config")
        .select("client_id_preview, sandbox")
        .eq("company_id", company.id).eq("provider", "pluggy").maybeSingle();
      setJaConfigurado(Boolean(data?.client_id_preview));
    })();
  }, [open, company]);

  const salvarCredenciais = async () => {
    if (!company) return;
    if (!clientId.trim() || !clientSecret.trim()) {
      toast.error("Informe o Client ID e o Client Secret da Pluggy.");
      return;
    }
    setSalvando(true);
    try {
      const { error } = await supabase.rpc("set_pluggy_credentials", {
        p_company_id: company.id,
        p_client_id: clientId.trim(),
        p_client_secret: clientSecret.trim(),
      });
      if (error) throw error;
      // Ativa a integração e registra o ambiente escolhido (metadado da UI).
      await supabase.from("openfinance_config")
        .update({ active: true, sandbox: modo === "sandbox" })
        .eq("company_id", company.id).eq("provider", "pluggy");
      toast.success("Credenciais guardadas no cofre.");
      setPasso("conectar");
    } catch (e) {
      toast.error("Erro ao salvar: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSalvando(false);
    }
  };

  const abrirConexao = async () => {
    if (!company) return;
    setCarregandoToken(true);
    try {
      const { data, error } = await supabase.functions.invoke("openfinance-connect", {
        body: { action: "token", company_id: company.id },
      });
      if (error) throw new Error(await mensagemDaEdge(error));
      if (data?.error === "PLUGGY_NOT_CONFIGURED" || !data?.accessToken) {
        toast.error("Credenciais Pluggy ausentes. Volte e salve o Client ID e Secret.");
        setPasso("credenciais");
        return;
      }
      setToken(data.accessToken);
    } catch (e) {
      toast.error("Erro ao iniciar conexão: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setCarregandoToken(false);
    }
  };

  /** Registra um item na empresa. Devolve as transações que vieram, ou lança com a mensagem da edge. */
  const registrarItem = async (itemId: string): Promise<number> => {
    if (!company) throw new Error("Nenhuma empresa selecionada.");
    const { data, error } = await supabase.functions.invoke("openfinance-connect", {
      body: { action: "register", company_id: company.id, item_id: itemId },
    });
    if (error) throw new Error(await mensagemDaEdge(error));
    return Number(data?.staged ?? 0);
  };

  const onWidgetSuccess = async (itemData: { item: { id: string } }) => {
    setToken(null);
    toast.loading("Registrando conexão…", { id: "of-wizard" });
    try {
      setStaged(await registrarItem(itemData.item.id));
      toast.success("Banco conectado.", { id: "of-wizard" });
      onConnected?.();
      setPasso("pronto");
    } catch (e) {
      toast.error("Erro ao registrar: " + (e instanceof Error ? e.message : String(e)), { id: "of-wizard" });
    }
  };

  /** Modo gratuito: registra um a um os Item IDs colados do dashboard da Pluggy. */
  const conectarPorItemIds = async () => {
    const ids = parseItemIds(itemIdsTexto);
    if (ids.length === 0) {
      toast.error("Cole ao menos um Item ID (formato 00000000-0000-0000-0000-000000000000).");
      return;
    }
    setRegistrandoIds(true);
    let total = 0;
    const falhas: string[] = [];
    for (const id of ids) {
      try {
        total += await registrarItem(id);
      } catch (e) {
        falhas.push(`${id.slice(0, 8)}…: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    setRegistrandoIds(false);
    const conectados = ids.length - falhas.length;
    if (falhas.length > 0) {
      toast.error(`${falhas.length} de ${ids.length} não conectaram. ${falhas.join(" | ")}`, { duration: 12000 });
    }
    if (conectados > 0) {
      setStaged(total);
      onConnected?.();
      setPasso("pronto");
      toast.success(`${conectados} conexão(ões) do MeuPluggy registrada(s).`);
    }
  };

  const fechar = () => onOpenChange(false);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Conectar banco (Open Finance)</DialogTitle>
          </DialogHeader>

          {/* Escopo explícito: a conexão é sempre de UMA empresa (CNPJ). Outra empresa
              é outra conexão. Uma empresa pode ter vários bancos e várias contas. */}
          {company && (
            <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-[11px] leading-4 text-muted-foreground">
              Conectando para <span className="font-medium text-foreground">{company.name}</span>
              {company.cnpj ? <span className="font-mono"> · {formatCnpj(company.cnpj)}</span> : null}.
              A conexão fica <span className="font-medium">nesta empresa</span>; para outro CNPJ, troque a empresa no topo. Uma empresa pode ter vários bancos e contas.
            </div>
          )}

          {/* Passo 1 — objetivo */}
          {passo === "objetivo" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                O Open Finance traz o extrato do banco automaticamente para conciliar. Comece escolhendo o objetivo:
              </p>
              <button
                type="button"
                onClick={() => { setModo("sandbox"); setPasso(jaConfigurado ? "conectar" : "credenciais"); }}
                className="flex w-full items-start gap-3 rounded-lg border border-border p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/30"
              >
                <FlaskConical className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-semibold">Testar agora (Sandbox)</p>
                  <p className="text-xs text-muted-foreground">Grátis. Conecta o banco de teste "Pluggy Bank" com usuário <span className="font-mono">user-ok</span> e senha <span className="font-mono">password-ok</span>, para ver a esteira funcionando.</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => { setModo("producao"); setPasso(jaConfigurado ? "conectar" : "credenciais"); }}
                className="flex w-full items-start gap-3 rounded-lg border border-border p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/30"
              >
                <Landmark className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-semibold">Conectar banco real (Produção)</p>
                  <p className="text-xs text-muted-foreground">Puxa o extrato do seu banco de verdade. Exige uma aplicação Pluggy de <span className="font-medium">produção</span> (o app Development/Demo NÃO conecta banco real).</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => { setModo("gratis"); setPasso(jaConfigurado ? "conectar" : "credenciais"); }}
                className="flex w-full items-start gap-3 rounded-lg border border-border p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/30"
              >
                <Gift className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-semibold">Conectar grátis (MeuPluggy)</p>
                  <p className="text-xs text-muted-foreground">Banco real sem mensalidade: você conecta até <span className="font-medium">5 bancos</span> (PJ e PF) no portal gratuito meu.pluggy.ai e autoriza a leitura aqui. Sem garantia de disponibilidade (SLA) da Pluggy.</p>
                </div>
              </button>
              {jaConfigurado && (
                <p className="text-[11px] text-muted-foreground">Já há credenciais Pluggy salvas nesta empresa: você vai direto para a conexão do banco.</p>
              )}
            </div>
          )}

          {/* Passo 2 — credenciais */}
          {passo === "credenciais" && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/20 p-3">
                <KeyRound className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  Pegue o <span className="font-medium">Client ID</span> e o <span className="font-medium">Client Secret</span> no{" "}
                  <a href="https://dashboard.pluggy.ai" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 underline hover:text-foreground">
                    dashboard.pluggy.ai <ExternalLink className="h-3 w-3" />
                  </a>{" "}
                  em Aplicações.{" "}
                  {modo === "producao"
                    ? "Precisa ser uma aplicação de PRODUÇÃO aprovada pela Pluggy."
                    : modo === "gratis"
                      ? "Crie a conta grátis e uma aplicação de desenvolvimento; na lista de conectores dela, habilite o \"MeuPluggy\"."
                      : "Pode ser o app Development/Demo: ele conecta o banco de teste."}
                </p>
              </div>
              {modo !== "gratis" && <p className="text-[11px] leading-4 text-muted-foreground">
                Não é uma assinatura por empresa: a Pluggy cobra por <span className="font-medium">conexão bancária ativa/mês</span> (vários bancos e contas de um CNPJ podem cair numa só conta Pluggy). Use a mesma conta Pluggy em várias empresas, ou uma conta própria por cliente.
              </p>}
              <div className="space-y-1.5">
                <Label className="text-xs">Client ID</Label>
                <Input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="00000000-0000-0000-0000-000000000000" className="font-mono text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Client Secret</Label>
                <Input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder="••••••••-••••-••••" className="font-mono text-xs" />
              </div>
              <div className="flex justify-between gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => setPasso("objetivo")}>
                  <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
                </Button>
                <Button size="sm" onClick={salvarCredenciais} disabled={salvando}>
                  {salvando ? "Salvando..." : "Salvar e continuar"} <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Passo 3 — conectar */}
          {passo === "conectar" && (
            <div className="space-y-4">
              {modo === "sandbox" && (
                <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs">
                  <p className="font-semibold text-foreground">No teste, use o banco Sandbox:</p>
                  <p className="mt-1 text-muted-foreground">Escolha <span className="font-medium">"Pluggy Bank"</span> na lista e entre com usuário <span className="font-mono">user-ok</span> e senha <span className="font-mono">password-ok</span> (para CNPJ, "Pluggy Bank Business").</p>
                </div>
              )}
              {modo === "producao" && (
                <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
                  Escolha o seu banco na lista e siga o login do próprio banco. Se aparecer "conexão cancelada", a credencial ainda é de um app Development/Demo: troque por um app de produção na etapa anterior.
                </div>
              )}
              {modo === "gratis" && (
                <div className="space-y-3">
                  <ol className="list-decimal space-y-1 rounded-md border border-primary/30 bg-primary/5 py-3 pl-7 pr-3 text-xs text-muted-foreground">
                    <li>
                      Entre em{" "}
                      <a href="https://meu.pluggy.ai" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 underline hover:text-foreground">
                        meu.pluggy.ai <ExternalLink className="h-3 w-3" />
                      </a>{" "}
                      e conecte lá os seus bancos (até 5, conta PJ ou PF).
                    </li>
                    <li>Volte aqui e clique em <span className="font-medium text-foreground">Autorizar pelo MeuPluggy</span>. Autorize <span className="font-medium">um banco por vez</span>: repita para cada banco.</li>
                  </ol>
                  <p className="text-[11px] leading-4 text-muted-foreground">
                    A Pluggy atualiza esses dados uma vez por dia. Não há garantia de disponibilidade: se a conexão cair, reconecte no meu.pluggy.ai.
                  </p>
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                {modo === "gratis"
                  ? "Clique abaixo para abrir a autorização do MeuPluggy (janela da Pluggy)."
                  : "Clique abaixo para abrir a conexão segura do banco (janela da Pluggy)."}
              </p>
              <div className="flex justify-between gap-2">
                <Button variant="outline" size="sm" onClick={() => setPasso(jaConfigurado ? "objetivo" : "credenciais")}>
                  <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
                </Button>
                <Button size="sm" onClick={abrirConexao} disabled={carregandoToken}>
                  {carregandoToken ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Landmark className="mr-1 h-4 w-4" />}
                  {modo === "gratis" ? "Autorizar pelo MeuPluggy" : "Abrir conexão do banco"}
                </Button>
              </div>
              {modo === "gratis" && (
                <details className="rounded-md border border-border/60 p-3 text-xs">
                  <summary className="cursor-pointer font-medium text-foreground">A janela não abriu ou deu erro? Cole o Item ID</summary>
                  <div className="mt-2 space-y-2 text-muted-foreground">
                    <p>
                      No{" "}
                      <a href="https://dashboard.pluggy.ai" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 underline hover:text-foreground">
                        dashboard.pluggy.ai <ExternalLink className="h-3 w-3" />
                      </a>
                      , abra a sua aplicação, clique em <span className="font-medium">Ir para Demo</span>, conecte o MeuPluggy e, no menu de três pontos de cada conexão, use <span className="font-medium">Copiar Item ID</span>. Cole um ou vários abaixo.
                    </p>
                    <Label className="text-xs" htmlFor="of-item-ids">Item IDs</Label>
                    <Textarea
                      id="of-item-ids"
                      value={itemIdsTexto}
                      onChange={(e) => setItemIdsTexto(e.target.value)}
                      placeholder="00000000-0000-0000-0000-000000000000"
                      className="min-h-[72px] font-mono text-xs"
                    />
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px]">{parseItemIds(itemIdsTexto).length} id(s) reconhecido(s)</span>
                      <Button size="sm" variant="outline" onClick={conectarPorItemIds} disabled={registrandoIds}>
                        {registrandoIds ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                        Conectar pelos IDs
                      </Button>
                    </div>
                  </div>
                </details>
              )}
            </div>
          )}

          {/* Passo 4 — pronto */}
          {passo === "pronto" && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-income" />
              <p className="text-sm font-semibold">Banco conectado!</p>
              <p className="text-xs text-muted-foreground">
                {staged != null && staged > 0
                  ? `${staged} transação(ões) já vieram para revisão.`
                  : "O extrato vai chegar e a IA classifica para você aprovar."}
              </p>
              <div className="flex gap-2 pt-1">
                <Button asChild size="sm" variant="outline"><Link to="/transactions" onClick={fechar}>Ver transações</Link></Button>
                <Button size="sm" onClick={fechar}>Concluir</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Widget da Pluggy (renderiza sua própria janela por cima do dialog). */}
      {token && (
        <PluggyConnect
          connectToken={token}
          includeSandbox={modo !== "gratis"}
          connectorIds={modo === "gratis" ? [MEUPLUGGY_CONNECTOR_ID] : undefined}
          onSuccess={onWidgetSuccess}
          onError={(error) => {
            setToken(null);
            console.error("[pluggy] connect error", error);
            toast.error(
              modo === "sandbox"
                ? "Conexão cancelada. No teste, conecte o banco 'Pluggy Bank' com user-ok / password-ok."
                : modo === "gratis"
                  ? "Autorização do MeuPluggy cancelada. Confira se o conector MeuPluggy está habilitado na sua aplicação, ou cole o Item ID."
                  : "Conexão cancelada ou o banco recusou. Banco real exige um app Pluggy de produção.",
            );
          }}
          onClose={() => setToken(null)}
        />
      )}
    </>
  );
}
