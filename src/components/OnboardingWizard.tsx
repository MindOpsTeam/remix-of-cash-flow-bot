import { mensagemDeErro } from "@/lib/erros";
import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useAdminPlataforma } from "@/hooks/useAdminPlataforma";
import { toast } from "sonner";
import {
  Rocket, Building2, Link2, CheckCircle2, Users, Layers, Copy, Plus,
  Loader2, Sparkles, MessageCircleQuestion, Send, ShieldCheck, SkipForward,
} from "lucide-react";
import { OpenFinanceConnect } from "@/components/openfinance/OpenFinanceConnect";
import { CentralDeConfiguracao } from "@/components/integracoes/CentralDeConfiguracao";
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
 * Assistente de instalação da plataforma, apresentado ao ADMIN (quem criou a
 * conta). Ele faz a configuração inteira num lugar só: dados da empresa, mais
 * CNPJs, equipe e TODAS as chaves de integração — cada uma com botão de testar
 * conexão, salvar e um guia de "como obter" com o custo do provedor.
 *
 * Regra inegociável: NADA é obrigatório. Todo passo tem "Pular", e pular não
 * penaliza nem esconde nada — o produto funciona no manual e melhora conforme
 * o admin liga o que fizer sentido.
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
              content: `Estou no assistente de instalação do FinanceAI. Responda curto e prático, em português. Pergunta: ${pergunta.trim()}`,
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
      toast.error(mensagemDeErro(e));
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
/* Wizard                                                              */
/* ------------------------------------------------------------------ */

export function OnboardingWizard({ open, onComplete, memberId }: OnboardingWizardProps) {
  const { company, companies } = useCompany();
  const { ehAdmin, ehPrimeiroUsuario } = useAdminPlataforma();
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

  const PASSOS = [
    { titulo: "Bem-vindo", icone: Rocket },
    { titulo: "Sua empresa", icone: Building2 },
    { titulo: "Mais CNPJs", icone: Layers },
    { titulo: "Sua equipe", icone: Users },
    { titulo: "Configuração da plataforma", icone: Sparkles },
    { titulo: "Conectar banco", icone: Link2 },
    { titulo: "Pronto", icone: CheckCircle2 },
  ];
  const totalSteps = PASSOS.length;
  const progress = ((step + 1) / totalSteps) * 100;
  const StepIcon = PASSOS[step].icone;
  const passoLargo = step === 4; // a central de configuração pede mais espaço

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
      toast.error("Erro ao salvar dados da empresa: " + mensagemDeErro(e));
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
      toast.error("Não consegui adicionar: " + mensagemDeErro(e));
    } finally {
      setAdicionandoCnpj(false);
    }
  };

  const gerarConvite = async () => {
    if (!company) return;
    try {
      const { data: sessao } = await supabase.auth.getUser();
      if (!sessao.user) throw new Error("Sessão expirada. Entre de novo.");
      const { data, error } = await supabase
        .from("company_invites")
        .insert({ company_id: company.id, role: inviteRole, criado_por: sessao.user.id })
        .select("token")
        .single();
      if (error || !data) throw new Error(error?.message ?? "sem token");
      await navigator.clipboard.writeText(`${window.location.origin}/?invite=${data.token}`);
      setConviteCopiado(true);
      setTimeout(() => setConviteCopiado(false), 2500);
      toast.success("Convite copiado! Vale 7 dias, para 1 pessoa.");
    } catch (e) {
      toast.error("Não consegui gerar o convite: " + mensagemDeErro(e));
    }
  };

  const finishOnboarding = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("company_members")
        .update({ onboarding_completed: true })
        .eq("id", memberId);
      if (error) throw error;
      onComplete();
    } catch (e) {
      toast.error("Erro ao finalizar: " + mensagemDeErro(e));
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    if (step === 1) await saveCompanyData();
    if (step === totalSteps - 1) {
      await finishOnboarding();
      return;
    }
    setStep((s) => s + 1);
  };

  return (
    <Dialog open={open}>
      <DialogContent
        className={`gap-0 overflow-hidden p-0 [&>button]:hidden ${passoLargo ? "sm:max-w-[880px]" : "sm:max-w-[560px]"}`}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="px-6 pt-6">
          <Progress value={progress} className="h-1.5 bg-muted" />
          <p className="mt-2 text-[11px] tabular-nums text-muted-foreground">
            Passo {step + 1} de {totalSteps} · {PASSOS[step].titulo}
          </p>
        </div>

        <div className="max-h-[68vh] overflow-y-auto px-6 py-5">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <StepIcon className="h-4.5 w-4.5" />
            </span>
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-foreground">{PASSOS[step].titulo}</h2>
          </div>

          {/* 0 — Bem-vindo */}
          {step === 0 && (
            <div className="space-y-3">
              {ehAdmin && (
                <Badge variant="outline" className="gap-1 border-primary/30 bg-primary/5 text-[11px] text-primary">
                  <ShieldCheck className="h-3 w-3" />
                  {ehPrimeiroUsuario ? "Você é o administrador da plataforma" : "Você tem acesso de administrador"}
                </Badge>
              )}
              <p className="text-sm leading-6 text-muted-foreground">
                Este assistente configura o FinanceAI de ponta a ponta: os dados da empresa, os outros CNPJs,
                a equipe e todas as chaves de integração — cada uma com teste de conexão e um guia de onde
                obter, como e quanto custa.
              </p>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                  <SkipForward className="h-3.5 w-3.5 text-primary" /> Tudo aqui é opcional
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Nenhum passo trava a sua entrada. Pule o que não fizer sentido agora e volte quando quiser em
                  Configurações. O sistema já funciona no manual desde o primeiro lançamento.
                </p>
              </div>
              <PerguntaConversacional />
            </div>
          )}

          {/* 1 — Empresa */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm leading-6 text-muted-foreground">
                Estes dados aparecem nos relatórios e definem a régua fiscal. Dá para preencher depois.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="ob-nome" className="text-xs">Nome da empresa</Label>
                <Input id="ob-nome" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Minha Empresa Ltda" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ob-cnpj" className="text-xs">CNPJ</Label>
                <Input id="ob-cnpj" value={cnpj} onChange={(e) => setCnpj(formatCNPJ(e.target.value))} placeholder="00.000.000/0000-00" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ob-regime" className="text-xs">Regime tributário</Label>
                <select
                  id="ob-regime"
                  value={regime}
                  onChange={(e) => setRegime(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Prefiro definir depois</option>
                  <option value="simples">Simples Nacional</option>
                  <option value="presumido">Lucro Presumido</option>
                  <option value="regular">Lucro Real</option>
                </select>
              </div>
              <PerguntaConversacional />
            </div>
          )}

          {/* 2 — Mais CNPJs */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm leading-6 text-muted-foreground">
                Tem mais de um CNPJ? Adicione agora e o painel passa a consolidar o grupo inteiro. Você alterna
                entre eles no seletor do topo.
              </p>
              {companies.length > 1 && (
                <p className="rounded-md border border-border bg-muted/30 p-2.5 text-xs text-muted-foreground">
                  Já cadastrados: {companies.map((c) => c.name).join(", ")}
                </p>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="ob-novo-nome" className="text-xs">Nome da empresa</Label>
                <Input id="ob-novo-nome" value={novoCnpjNome} onChange={(e) => setNovoCnpjNome(e.target.value)} placeholder="Filial ou outra razão social" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ob-novo-cnpj" className="text-xs">CNPJ (opcional)</Label>
                <Input id="ob-novo-cnpj" value={novoCnpj} onChange={(e) => setNovoCnpj(formatCNPJ(e.target.value))} placeholder="00.000.000/0000-00" />
              </div>
              <Button variant="outline" className="w-full gap-1.5" onClick={adicionarCnpj} disabled={adicionandoCnpj}>
                {adicionandoCnpj ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Adicionar CNPJ
              </Button>
            </div>
          )}

          {/* 3 — Equipe */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm leading-6 text-muted-foreground">
                Convide quem vai operar com você. O convite entra na MESMA organização e vale 7 dias, para uma
                pessoa só.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="ob-papel" className="text-xs">Papel de quem receber</Label>
                <select
                  id="ob-papel"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as "admin" | "member" | "viewer")}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="admin">Administrador — configura tudo</option>
                  <option value="member">Operador — lança e edita</option>
                  <option value="viewer">Visualizador — somente leitura</option>
                </select>
              </div>
              <Button variant="outline" className="w-full gap-1.5" onClick={gerarConvite}>
                {conviteCopiado ? <CheckCircle2 className="h-4 w-4 text-[hsl(var(--success))]" /> : <Copy className="h-4 w-4" />}
                {conviteCopiado ? "Link copiado!" : "Gerar e copiar convite"}
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Cole o link para a pessoa. Ao entrar, ela cai direto nesta empresa com o papel escolhido.
              </p>
            </div>
          )}

          {/* 4 — Configuração da plataforma */}
          {step === 4 && (
            <div className="space-y-4">
              <p className="text-sm leading-6 text-muted-foreground">
                Aqui mora a configuração inteira da plataforma. Cada integração abre um formulário com os campos
                reais, um botão para <strong className="text-foreground">testar a conexão</strong> antes de
                confiar, e um guia de <strong className="text-foreground">como obter a chave</strong> com o custo
                do provedor. Ligue só o que fizer sentido.
              </p>
              <CentralDeConfiguracao compacto />
              <PerguntaConversacional />
            </div>
          )}

          {/* 5 — Conectar banco */}
          {step === 5 && (
            <div className="space-y-4">
              <p className="text-sm leading-6 text-muted-foreground">
                Com o Open Finance configurado no passo anterior, conecte o banco aqui: o extrato passa a chegar
                sozinho e vira lançamento classificado, sem digitação.
              </p>
              <OpenFinanceConnect />
              <p className="text-[11px] text-muted-foreground">
                Ainda não configurou a credencial? Volte um passo ou siga em frente — dá para conectar depois em
                Bancos &amp; Open Finance.
              </p>
            </div>
          )}

          {/* 6 — Pronto */}
          {step === 6 && (
            <div className="space-y-3">
              <p className="text-sm leading-6 text-muted-foreground">
                Instalação concluída. O painel já está de pé e tudo que você pulou continua disponível em
                Configurações, com o mesmo guia e o mesmo teste de conexão.
              </p>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-xs font-medium text-foreground">Por onde começar</p>
                <ul className="mt-1.5 space-y-1 text-xs leading-5 text-muted-foreground">
                  <li>· Lance a primeira movimentação ou importe o extrato do banco.</li>
                  <li>· Ative um agente para vigiar caixa, contas e recompra por você.</li>
                  <li>· Defina as metas do cockpit para o painel comparar realizado x alvo.</li>
                </ul>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Para rever este assistente depois: Configurações → Guia de instalação.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border bg-muted/20 px-6 py-4">
          <Button variant="ghost" size="sm" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            Voltar
          </Button>
          <div className="flex items-center gap-2">
            {step < totalSteps - 1 && (
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => setStep((s) => s + 1)}>
                <SkipForward className="h-3.5 w-3.5" />
                Pular
              </Button>
            )}
            <Button size="sm" onClick={handleNext} disabled={saving}>
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              {step === totalSteps - 1 ? "Concluir" : "Próximo"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
