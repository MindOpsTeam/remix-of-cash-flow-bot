import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { toast } from "sonner";
import {
  Rocket, Building2, Link2, CheckCircle2, Users, Layers, Copy, Plus,
  Loader2, Sparkles, MessageCircleQuestion, Send,
} from "lucide-react";
import { OpenFinanceConnect } from "@/components/openfinance/OpenFinanceConnect";
import { edgeAuthHeaders, edgeUrl } from "@/lib/edge";

function formatCNPJ(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

interface OnboardingWizardProps {
  open: boolean;
  onComplete: () => void;
  memberId: string;
}

/**
 * Guia de instalação da plataforma. TUDO aqui é expressamente opcional: cada
 * passo ensina, oferece e segue em frente sem cobrar nada. Os textos de "como
 * obter" dizem onde a chave nasce e quanto o serviço do provedor custa —
 * transparência primeiro. A caixa de pergunta conversacional chama o CFO
 * Digital para dúvidas no meio do caminho.
 */

/* ------------------------------------------------------------------ */
/* Pergunta conversacional (CFO Digital, uma pergunta por vez)         */
/* ------------------------------------------------------------------ */
function PerguntaConversacional() {
  const { company } = useCompany();
  const [pergunta, setPergunta] = useState("");
  const [resposta, setResposta] = useState("");
  const [pensando, setPensando] = useState(false);

  async function perguntar() {
    if (!company || !pergunta.trim() || pensando) return;
    setPensando(true);
    setResposta("");
    try {
      const resp = await fetch(edgeUrl("cfo-digital"), {
        method: "POST",
        headers: await edgeAuthHeaders(),
        body: JSON.stringify({
          company_id: company.id,
          messages: [
            {
              role: "user",
              content: `Estou no guia de instalação do FinanceAI (onboarding). Responda curto e prático, em português. Pergunta: ${pergunta.trim()}`,
            },
          ],
        }),
      });
      if (!resp.ok || !resp.body) throw new Error("A IA não respondeu agora. Tente de novo.");
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acumulado = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) {
              acumulado += c;
              setResposta(acumulado);
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPensando(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-foreground">
        <MessageCircleQuestion className="h-3.5 w-3.5 text-primary" /> Dúvida em qualquer passo? Pergunte.
      </p>
      <div className="flex gap-2">
        <Input
          value={pergunta}
          onChange={(e) => setPergunta(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && perguntar()}
          placeholder="Ex.: preciso mesmo de CNPJ? O que é a API do Asaas?"
          className="h-8 text-xs"
          aria-label="Pergunta ao assistente"
        />
        <Button size="sm" variant="outline" className="h-8 shrink-0 gap-1.5" onClick={perguntar} disabled={pensando || !pergunta.trim()}>
          {pensando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        </Button>
      </div>
      {resposta && (
        <p className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
          {resposta}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Guias de "como obter a chave" (fonte + custo, sem enrolação)        */
/* ------------------------------------------------------------------ */
const GUIAS: Array<{ key: string; titulo: string; comoObter: string; custo: string; linkConfig?: string }> = [
  {
    key: "asaas",
    titulo: "Asaas — cobranças, boletos e Pix",
    comoObter:
      "Crie a conta em asaas.com (ou sandbox.asaas.com para testar). Dentro do app: foto de perfil → Integrações → Chave de API → Gerar. Cole a chave aqui.",
    custo:
      "Conta gratuita; o Asaas cobra POR COBRANÇA recebida (Pix/boleto a partir de ~R$1,99; cartão por percentual). Consulte asaas.com/precos.",
  },
  {
    key: "inter",
    titulo: "Banco Inter — extrato e saldo oficiais",
    comoObter:
      "Precisa de conta PJ no Inter. No Internet Banking: Menu → Aplicações (API) → Nova aplicação → marque o escopo 'Extrato' → baixe client_id, client_secret e o certificado. Cole os dois códigos aqui; o certificado entra em Configurações → Integrações → Inter.",
    custo: "Gratuito para correntistas PJ do Inter.",
    linkConfig: "/settings/integrations/inter",
  },
  {
    key: "whatsapp",
    titulo: "WhatsApp — avisos e agentes (Evolution API)",
    comoObter:
      "A Evolution API é um servidor de WhatsApp que você mesmo hospeda (uma VPS simples resolve) ou contrata gerenciado. Depois de subir, você terá a URL e a API key da instância — cole aqui e leia o QR em Inteligência → WhatsApp.",
    custo:
      "O software é aberto; a VPS custa a partir de ~R$25/mês. O número de WhatsApp conecta por QR (não é a API oficial da Meta).",
  },
  {
    key: "contaazul",
    titulo: "Conta Azul — importe seus dados de lá",
    comoObter:
      "1) Crie um app em developers.contaazul.com (recebe client_id e client_secret). 2) Autorize com o login da SUA conta Conta Azul na URL de autorização do portal — o retorno traz um código que vira o refresh_token. 3) Cole os três em Configurações → Integrações → Conta Azul e clique Importar.",
    custo:
      "A API é incluída na assinatura Conta Azul (planos com API). A importação pelo FinanceAI não custa nada extra.",
    linkConfig: "/settings/integrations/contaazul",
  },
  {
    key: "plugnotas",
    titulo: "PlugNotas — emitir NF-e e NFC-e",
    comoObter:
      "Crie a conta em plugnotas.com.br, cadastre o CNPJ emissor com o certificado digital A1 e copie a API key do painel. Configure em Configurações → Integrações → PlugNotas.",
    custo: "Cobrança por nota emitida (na casa de centavos por documento, conforme volume). Consulte plugnotas.com.br.",
    linkConfig: "/settings/integrations/plugnotas",
  },
  {
    key: "focus",
    titulo: "Focus NFe — emissor alternativo",
    comoObter:
      "Conta em focusnfe.com.br; o painel gera tokens separados de homologação e produção. Configure em Configurações → Integrações → Focus.",
    custo: "Mensalidade por CNPJ emissor (a partir de ~R$50/mês). Consulte focusnfe.com.br.",
    linkConfig: "/settings/integrations/focus",
  },
  {
    key: "nfse",
    titulo: "NFS-e Nacional — nota de serviço direto na Receita",
    comoObter:
      "Exige certificado digital A1 do CNPJ (arquivo .pfx). Compre numa Autoridade Certificadora (Serasa, Certisign, Soluti…) e suba em Configurações → Integrações → NFS-e Nacional.",
    custo: "Só o certificado A1: ~R$150 a R$250/ano. A emissão em si é gratuita.",
    linkConfig: "/settings/integrations/nfse",
  },
];

export function OnboardingWizard({ open, onComplete, memberId }: OnboardingWizardProps) {
  const { company, companies } = useCompany();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Empresa
  const [companyName, setCompanyName] = useState(company?.name || "");
  const [cnpj, setCnpj] = useState(company?.cnpj ? formatCNPJ(company.cnpj) : "");
  const [regime, setRegime] = useState<string>(company?.regimeTributario ?? "");

  // Mais CNPJs
  const [novoCnpjNome, setNovoCnpjNome] = useState("");
  const [novoCnpj, setNovoCnpj] = useState("");
  const [adicionandoCnpj, setAdicionandoCnpj] = useState(false);

  // Equipe
  const [inviteRole, setInviteRole] = useState<"admin" | "member" | "viewer">("member");
  const [conviteCopiado, setConviteCopiado] = useState(false);

  // Integrações
  const [asaasKey, setAsaasKey] = useState("");
  const [evolutionUrl, setEvolutionUrl] = useState("");
  const [evolutionKey, setEvolutionKey] = useState("");
  const [interClientId, setInterClientId] = useState("");
  const [interClientSecret, setInterClientSecret] = useState("");

  const PASSOS = [
    { titulo: "Bem-vindo", icone: Rocket },
    { titulo: "Sua empresa", icone: Building2 },
    { titulo: "Mais CNPJs", icone: Layers },
    { titulo: "Sua equipe", icone: Users },
    { titulo: "Conectar banco", icone: Link2 },
    { titulo: "Integrações e chaves", icone: Sparkles },
    { titulo: "Pronto", icone: CheckCircle2 },
  ];
  const totalSteps = PASSOS.length;
  const progress = ((step + 1) / totalSteps) * 100;
  const StepIcon = PASSOS[step].icone;

  const saveCompanyData = async () => {
    if (!company) return;
    setSaving(true);
    try {
      const updates: Record<string, string> = {};
      if (companyName.trim()) updates.name = companyName.trim();
      if (cnpj.trim()) updates.cnpj = cnpj.replace(/\D/g, "");
      if (regime) updates.regime_tributario = regime;
      if (Object.keys(updates).length > 0) {
        const { error } = await supabase.from("companies").update(updates).eq("id", company.id);
        if (error) throw error;
      }
    } catch (e) {
      toast.error("Erro ao salvar dados da empresa: " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const adicionarCnpj = async () => {
    if (!novoCnpjNome.trim()) {
      toast.error("Dê um nome à empresa do novo CNPJ.");
      return;
    }
    setAdicionandoCnpj(true);
    try {
      const { error } = await supabase.rpc("create_company_for_user", {
        company_name: novoCnpjNome.trim(),
        company_cnpj: novoCnpj.replace(/\D/g, "") || undefined,
      });
      if (error) throw new Error(error.message);
      toast.success(`${novoCnpjNome.trim()} adicionada. Alterne entre CNPJs no topo da tela.`);
      setNovoCnpjNome("");
      setNovoCnpj("");
      queryClient.invalidateQueries();
    } catch (e) {
      toast.error("Não consegui adicionar: " + (e as Error).message);
    } finally {
      setAdicionandoCnpj(false);
    }
  };

  const gerarConvite = async () => {
    if (!company) return;
    try {
      const { data: sessao } = await supabase.auth.getUser();
      const { data, error } = await (supabase.from as unknown as (t: string) => {
        insert: (row: Record<string, unknown>) => {
          select: (q: string) => { single: () => PromiseLike<{ data: { token: string } | null; error: { message: string } | null }> };
        };
      })("company_invites")
        .insert({ company_id: company.id, role: inviteRole, criado_por: sessao.user?.id })
        .select("token")
        .single();
      if (error || !data) throw new Error(error?.message ?? "sem token");
      await navigator.clipboard.writeText(`${window.location.origin}/?invite=${data.token}`);
      setConviteCopiado(true);
      setTimeout(() => setConviteCopiado(false), 2500);
      toast.success("Convite copiado! Vale 7 dias, para 1 pessoa.");
    } catch (e) {
      toast.error("Não consegui gerar o convite: " + (e as Error).message);
    }
  };

  const saveIntegrations = async () => {
    if (!company) return;
    setSaving(true);
    try {
      if (asaasKey.trim()) {
        const { data: existing } = await supabase
          .from("company_asaas_config").select("id").eq("company_id", company.id).maybeSingle();
        const payload: Record<string, string> = {
          company_id: company.id,
          environment: "production",
          api_key_production: asaasKey.trim(),
        };
        if (existing) await supabase.from("company_asaas_config").update(payload).eq("id", existing.id);
        else await supabase.from("company_asaas_config").insert([payload as never]);
      }
      if (evolutionUrl.trim() || evolutionKey.trim()) {
        const { data: existing } = await supabase
          .from("whatsapp_configs").select("id").eq("company_id", company.id).maybeSingle();
        const payload: Record<string, string> = { company_id: company.id, instance_name: "default" };
        if (evolutionUrl.trim()) payload.evolution_api_url = evolutionUrl.trim();
        if (evolutionKey.trim()) payload.evolution_api_key = evolutionKey.trim();
        if (existing) await supabase.from("whatsapp_configs").update(payload).eq("id", existing.id);
        else await supabase.from("whatsapp_configs").insert([payload as never]);
      }
      if (interClientId.trim() || interClientSecret.trim()) {
        const { data: existing } = await supabase
          .from("inter_config").select("id").eq("company_id", company.id).maybeSingle();
        const payload: Record<string, string> = { company_id: company.id };
        if (interClientId.trim()) payload.client_id = interClientId.trim();
        if (interClientSecret.trim()) payload.client_secret = interClientSecret.trim();
        if (existing) await supabase.from("inter_config").update(payload).eq("id", existing.id);
        else await supabase.from("inter_config").insert([payload as never]);
      }
    } catch (e) {
      toast.error("Erro ao salvar integrações: " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const finishOnboarding = async () => {
    setSaving(true);
    try {
      await supabase
        .from("company_members")
        .update({ onboarding_completed: true } as never)
        .eq("id", memberId);
      toast.success("Instalação concluída! Reabra o guia quando quiser em Configurações.");
      onComplete();
    } catch (e) {
      toast.error("Erro ao finalizar: " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    if (step === 1) await saveCompanyData();
    if (step === 5) await saveIntegrations();
    if (step === totalSteps - 1) {
      await finishOnboarding();
      return;
    }
    setStep((s) => s + 1);
  };

  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-[560px] p-0 gap-0 overflow-hidden [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="px-6 pt-6">
          <Progress value={progress} className="h-1.5 bg-muted" />
          <p className="text-[11px] text-muted-foreground mt-2 tabular-nums">
            {PASSOS[step].titulo} · etapa {step + 1} de {totalSteps} · tudo opcional
          </p>
        </div>

        <div className="px-6 pb-6 pt-4 min-h-[340px] max-h-[72vh] overflow-y-auto flex flex-col">
          {/* 0 — Boas-vindas */}
          {step === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <StepIcon className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground leading-tight">Guia de instalação</h2>
                <p className="text-sm text-muted-foreground mt-2 max-w-[400px]">
                  Vamos montar seu ERP passo a passo: empresa, CNPJs, equipe, banco e integrações.
                  <span className="font-medium text-foreground"> Nada aqui é obrigatório</span> — pule o que quiser e
                  volte depois em Configurações. Cada chave vem com o "como obter" e o custo do provedor.
                </p>
              </div>
            </div>
          )}

          {/* 1 — Empresa */}
          {step === 1 && (
            <div className="flex-1 flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <StepIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Dados da empresa</h2>
                  <p className="text-xs text-muted-foreground">Tudo editável depois em Configurações → Empresa</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="ob-name">Nome da empresa</Label>
                  <Input id="ob-name" placeholder="Ex: Minha Empresa Ltda" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ob-cnpj">CNPJ <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                  <Input id="ob-cnpj" placeholder="00.000.000/0001-00" value={cnpj} onChange={(e) => setCnpj(formatCNPJ(e.target.value))} maxLength={18} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ob-regime">Regime tributário <span className="text-muted-foreground font-normal">(opcional — Reforma CBS/IBS)</span></Label>
                  <select
                    id="ob-regime"
                    value={regime}
                    onChange={(e) => setRegime(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Escolher depois</option>
                    <option value="simples">Simples Nacional</option>
                    <option value="regular">Regime regular (Lucro Real/Presumido)</option>
                    <option value="mei">MEI</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* 2 — Mais CNPJs */}
          {step === 2 && (
            <div className="flex-1 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <StepIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Sua empresa tem mais de um CNPJ?</h2>
                  <p className="text-xs text-muted-foreground">
                    Cada CNPJ vira uma empresa aqui dentro, com DRE próprio e visão consolidada do grupo
                  </p>
                </div>
              </div>
              {companies.length > 0 && (
                <div className="space-y-1.5">
                  {companies.map((c) => (
                    <div key={c.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                      <span className="truncate">{c.name}</span>
                      {c.cnpj && <span className="font-mono text-xs text-muted-foreground">{formatCNPJ(c.cnpj)}</span>}
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-2 rounded-lg bg-muted/30 p-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Input placeholder="Nome da empresa do CNPJ" value={novoCnpjNome} onChange={(e) => setNovoCnpjNome(e.target.value)} aria-label="Nome do novo CNPJ" />
                  <Input placeholder="CNPJ (opcional)" value={novoCnpj} onChange={(e) => setNovoCnpj(formatCNPJ(e.target.value))} maxLength={18} aria-label="Novo CNPJ" />
                </div>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={adicionarCnpj} disabled={adicionandoCnpj}>
                  {adicionandoCnpj ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Adicionar CNPJ
                </Button>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Cada CNPJ pode ter responsáveis diferentes: no próximo passo você convida a equipe, e em
                Configurações → Usuários define quem cuida de qual CNPJ (trocando de empresa no topo da tela).
              </p>
            </div>
          )}

          {/* 3 — Equipe */}
          {step === 3 && (
            <div className="flex-1 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <StepIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Convide sua equipe</h2>
                  <p className="text-xs text-muted-foreground">
                    Todo mundo na MESMA organização — nada de cada um criar a própria empresa duplicada
                  </p>
                </div>
              </div>
              <div className="space-y-3 rounded-lg bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">
                  O convite é um link único: vale 7 dias, serve para 1 pessoa e já entra com o papel certo em{" "}
                  <span className="font-medium text-foreground">{company?.name}</span>.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    aria-label="Papel do convidado"
                  >
                    <option value="member">Membro — lança e edita</option>
                    <option value="admin">Admin — tudo, inclusive convidar</option>
                    <option value="viewer">Leitura — só visualiza</option>
                  </select>
                  <Button size="sm" className="gap-2" onClick={gerarConvite}>
                    <Copy className="h-3.5 w-3.5" />
                    {conviteCopiado ? "Copiado!" : "Gerar e copiar convite"}
                  </Button>
                </div>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                O papel vale de verdade: quem entra como Leitura não consegue alterar nada, nem pela API. Para os
                outros CNPJs, troque de empresa no topo e gere o convite de lá — assim cada CNPJ tem os próprios
                responsáveis.
              </p>
            </div>
          )}

          {/* 4 — Banco */}
          {step === 4 && (
            <div className="flex-1 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <StepIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Conecte seu banco</h2>
                  <p className="text-xs text-muted-foreground">
                    Sem chave nenhuma: Open Finance regulado pelo Banco Central. O extrato entra sozinho e a IA classifica.
                  </p>
                </div>
              </div>
              <OpenFinanceConnect />
              <p className="text-[11px] text-muted-foreground">
                Custo: incluído no FinanceAI. Já usa Conta Azul? O passo seguinte mostra como importar tudo de lá.
              </p>
            </div>
          )}

          {/* 5 — Integrações e chaves */}
          {step === 5 && (
            <div className="flex-1 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <StepIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Integrações e chaves</h2>
                  <p className="text-xs text-muted-foreground">
                    Todas opcionais. Cada uma explica onde a chave nasce e o custo do provedor.
                  </p>
                </div>
              </div>

              <Accordion type="single" collapsible className="w-full">
                {GUIAS.map((g) => (
                  <AccordionItem key={g.key} value={g.key}>
                    <AccordionTrigger className="text-sm">{g.titulo}</AccordionTrigger>
                    <AccordionContent className="space-y-3">
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        <span className="font-medium text-foreground">Como obter: </span>
                        {g.comoObter}
                      </p>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        <span className="font-medium text-foreground">Custo: </span>
                        {g.custo}
                      </p>
                      {g.key === "asaas" && (
                        <Input placeholder="$aact_… (API key do Asaas)" value={asaasKey} onChange={(e) => setAsaasKey(e.target.value)} aria-label="API key do Asaas" />
                      )}
                      {g.key === "inter" && (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <Input placeholder="client_id" value={interClientId} onChange={(e) => setInterClientId(e.target.value)} aria-label="Client ID do Inter" />
                          <Input placeholder="client_secret" value={interClientSecret} onChange={(e) => setInterClientSecret(e.target.value)} aria-label="Client secret do Inter" />
                        </div>
                      )}
                      {g.key === "whatsapp" && (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <Input placeholder="https://sua-evolution.com" value={evolutionUrl} onChange={(e) => setEvolutionUrl(e.target.value)} aria-label="URL da Evolution" />
                          <Input placeholder="API key da instância" value={evolutionKey} onChange={(e) => setEvolutionKey(e.target.value)} aria-label="API key da Evolution" />
                        </div>
                      )}
                      {g.linkConfig && (
                        <a href={g.linkConfig} className="inline-block text-xs text-primary underline underline-offset-2">
                          Abrir a configuração completa
                        </a>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>

              <div className="rounded-lg border border-primary/20 bg-primary/[0.04] p-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary" /> Não achou a integração que precisa? Crie a sua.
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  O FinanceAI expõe uma API pública (Configurações → Chaves de API). Descreva no Lovable o conector
                  que você quer ("leia os pedidos do meu sistema X e lance as vendas no FinanceAI pela API") e ele
                  constrói para você — o ERP não te prende ao nosso catálogo.
                </p>
              </div>
            </div>
          )}

          {/* 6 — Pronto */}
          {step === 6 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground leading-tight">Instalação concluída</h2>
                <p className="text-sm text-muted-foreground mt-2 max-w-[400px]">
                  O que ficou para depois mora em Configurações — e este guia reabre por lá quando você quiser.
                  O checklist no painel mostra os próximos passos até o DRE montar sozinho.
                </p>
              </div>
            </div>
          )}

          {/* Pergunta conversacional + ações */}
          <div className="mt-6 space-y-3 border-t border-border pt-4">
            {step > 0 && step < totalSteps - 1 && <PerguntaConversacional />}
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {step > 0 && step < totalSteps - 1 && (
                  <Button variant="outline" size="sm" onClick={() => setStep((s) => s - 1)} disabled={saving}>
                    Voltar
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                {step > 0 && step < totalSteps - 1 && (
                  <Button variant="ghost" size="sm" onClick={() => setStep((s) => s + 1)} disabled={saving}>
                    Pular
                  </Button>
                )}
                <Button onClick={handleNext} disabled={saving} size="sm">
                  {saving ? "Salvando..." : step === totalSteps - 1 ? "Ir para o painel" : "Próximo"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
