import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Rocket, Building2, Link2, CheckCircle2 } from "lucide-react";
import { OpenFinanceConnect } from "@/components/openfinance/OpenFinanceConnect";

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

export function OnboardingWizard({ open, onComplete, memberId }: OnboardingWizardProps) {
  const { company } = useCompany();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 2 - Company data
  const [companyName, setCompanyName] = useState(company?.name || "");
  const [cnpj, setCnpj] = useState(company?.cnpj ? formatCNPJ(company.cnpj) : "");
  const [regime, setRegime] = useState<string>(company?.regimeTributario ?? "");

  // Step 3 - Integrations (all optional)
  const [asaasKeySandbox, setAsaasKeySandbox] = useState("");
  const [asaasKeyProduction, setAsaasKeyProduction] = useState("");
  const [evolutionUrl, setEvolutionUrl] = useState("");
  const [evolutionKey, setEvolutionKey] = useState("");
  const [interClientId, setInterClientId] = useState("");
  const [interClientSecret, setInterClientSecret] = useState("");

  const totalSteps = 4;
  const progress = ((step + 1) / totalSteps) * 100;

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
    } catch (e: any) {
      toast.error("Erro ao salvar dados da empresa: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const saveIntegrations = async () => {
    if (!company) return;
    setSaving(true);
    try {
      // Save Asaas config if any key provided
      if (asaasKeySandbox.trim() || asaasKeyProduction.trim()) {
        const { data: existing } = await supabase
          .from("company_asaas_config")
          .select("id")
          .eq("company_id", company.id)
          .maybeSingle();

        const asaasPayload: Record<string, string> = {
          company_id: company.id,
          environment: asaasKeyProduction.trim() ? "production" : "sandbox",
        };
        if (asaasKeySandbox.trim()) asaasPayload.api_key_sandbox = asaasKeySandbox.trim();
        if (asaasKeyProduction.trim()) asaasPayload.api_key_production = asaasKeyProduction.trim();

        if (existing) {
          await supabase.from("company_asaas_config").update(asaasPayload).eq("id", existing.id);
        } else {
          await supabase.from("company_asaas_config").insert([asaasPayload as any]);
        }
      }

      // Save WhatsApp/Evolution config if provided
      if (evolutionUrl.trim() || evolutionKey.trim()) {
        const { data: existing } = await supabase
          .from("whatsapp_configs")
          .select("id")
          .eq("company_id", company.id)
          .maybeSingle();

        const waPayload: Record<string, string> = {
          company_id: company.id,
          instance_name: "default",
        };
        if (evolutionUrl.trim()) waPayload.evolution_api_url = evolutionUrl.trim();
        if (evolutionKey.trim()) waPayload.evolution_api_key = evolutionKey.trim();

        if (existing) {
          await supabase.from("whatsapp_configs").update(waPayload).eq("id", existing.id);
        } else {
          await supabase.from("whatsapp_configs").insert([waPayload as any]);
        }
      }

      // Save Inter config if provided
      if (interClientId.trim() || interClientSecret.trim()) {
        const { data: existing } = await supabase
          .from("inter_config")
          .select("id")
          .eq("company_id", company.id)
          .maybeSingle();

        const interPayload: Record<string, string> = {
          company_id: company.id,
        };
        if (interClientId.trim()) interPayload.client_id = interClientId.trim();
        if (interClientSecret.trim()) interPayload.client_secret = interClientSecret.trim();

        if (existing) {
          await supabase.from("inter_config").update(interPayload).eq("id", existing.id);
        } else {
          await supabase.from("inter_config").insert([interPayload as any]);
        }
      }
    } catch (e: any) {
      toast.error("Erro ao salvar integrações: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const finishOnboarding = async () => {
    setSaving(true);
    try {
      await supabase
        .from("company_members")
        .update({ onboarding_completed: true } as any)
        .eq("id", memberId);
      toast.success("Configuração concluída! Bem-vindo.");
      onComplete();
    } catch (e: any) {
      toast.error("Erro ao finalizar: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    if (step === 1) await saveCompanyData();
    if (step === 2) await saveIntegrations();
    if (step === 3) {
      await finishOnboarding();
      return;
    }
    setStep((s) => s + 1);
  };

  const handleSkip = () => {
    if (step === 3) {
      finishOnboarding();
      return;
    }
    setStep((s) => s + 1);
  };

  const stepIcons = [Rocket, Building2, Link2, CheckCircle2];
  const StepIcon = stepIcons[step];

  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-[520px] p-0 gap-0 overflow-hidden [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Progress bar */}
        <div className="px-6 pt-6">
          <Progress value={progress} className="h-1.5 bg-muted" />
          <p className="text-[11px] text-muted-foreground mt-2 tabular-nums">
            Etapa {step + 1} de {totalSteps}
          </p>
        </div>

        <div className="px-6 pb-6 pt-4 min-h-[320px] max-h-[70vh] overflow-y-auto flex flex-col">
          {/* Step 0 — Welcome */}
          {step === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <StepIcon className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground leading-tight">
                  Bem-vindo ao seu ERP financeiro
                </h2>
                <p className="text-sm text-muted-foreground mt-2 max-w-[380px]">
                  Vamos fazer uma configuração rápida para personalizar o sistema. Leva menos de 2 minutos.
                </p>
              </div>
            </div>
          )}

          {/* Step 1 — Company Data */}
          {step === 1 && (
            <div className="flex-1 flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <StepIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Dados da empresa</h2>
                  <p className="text-xs text-muted-foreground">Informações básicas do seu negócio</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="ob-name">Nome da empresa</Label>
                  <Input
                    id="ob-name"
                    placeholder="Ex: Minha Empresa Ltda"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ob-cnpj">CNPJ <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                  <Input
                    id="ob-cnpj"
                    placeholder="00.000.000/0001-00"
                    value={cnpj}
                    onChange={(e) => setCnpj(formatCNPJ(e.target.value))}
                    maxLength={18}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ob-regime">Regime tributário <span className="text-muted-foreground font-normal">(Reforma CBS/IBS)</span></Label>
                  <select
                    id="ob-regime"
                    value={regime}
                    onChange={(e) => setRegime(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Escolher depois</option>
                    <option value="simples">Simples Nacional</option>
                    <option value="regular">Regime regular (Lucro Real/Presumido)</option>
                    <option value="mei">MEI</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Com o regime informado, as notas já saem com o destaque CBS/IBS exigido em 2026.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 2 — Integrations */}
          {step === 2 && (
            <div className="flex-1 flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <StepIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Conecte seu banco</h2>
                  <p className="text-xs text-muted-foreground">
                    O extrato entra sozinho e a IA classifica — é o caminho mais rápido para ver seu DRE montado
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                {/* Ativação começa aqui: banco conectado é o passo que separa
                    cadastro de uso. O widget é o mesmo de Bancos & Open Finance. */}
                <OpenFinanceConnect />
                <p className="text-[11px] text-muted-foreground">
                  Já usa Conta Azul? Depois de entrar, importe tudo em Configurações → Integrações → Conta Azul.
                  As integrações abaixo são opcionais.
                </p>
                <div className="space-y-3 bg-muted/30 rounded-lg p-3">
                  <p className="text-xs font-medium text-foreground">Asaas (cobranças)</p>
                  <div className="space-y-1.5">
                    <Label htmlFor="ob-asaas-sb" className="text-xs">API Key Sandbox</Label>
                    <Input
                      id="ob-asaas-sb"
                      placeholder="$aact_..."
                      value={asaasKeySandbox}
                      onChange={(e) => setAsaasKeySandbox(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ob-asaas-prod" className="text-xs">API Key Produção</Label>
                    <Input
                      id="ob-asaas-prod"
                      placeholder="$aact_..."
                      value={asaasKeyProduction}
                      onChange={(e) => setAsaasKeyProduction(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-3 bg-muted/30 rounded-lg p-3">
                  <p className="text-xs font-medium text-foreground">Evolution API (WhatsApp)</p>
                  <div className="space-y-1.5">
                    <Label htmlFor="ob-evo-url" className="text-xs">URL da API</Label>
                    <Input
                      id="ob-evo-url"
                      placeholder="https://api.exemplo.com"
                      value={evolutionUrl}
                      onChange={(e) => setEvolutionUrl(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ob-evo-key" className="text-xs">API Key</Label>
                    <Input
                      id="ob-evo-key"
                      placeholder="sua-api-key"
                      value={evolutionKey}
                      onChange={(e) => setEvolutionKey(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-3 bg-muted/30 rounded-lg p-3">
                  <p className="text-xs font-medium text-foreground">Banco Inter (Open Banking)</p>
                  <div className="space-y-1.5">
                    <Label htmlFor="ob-inter-cid" className="text-xs">Client ID</Label>
                    <Input
                      id="ob-inter-cid"
                      placeholder="client_id do app Inter"
                      value={interClientId}
                      onChange={(e) => setInterClientId(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ob-inter-cs" className="text-xs">Client Secret</Label>
                    <Input
                      id="ob-inter-cs"
                      placeholder="client_secret do app Inter"
                      value={interClientSecret}
                      onChange={(e) => setInterClientSecret(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3 — Done */}
          {step === 3 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground leading-tight">
                  Tudo pronto!
                </h2>
                <p className="text-sm text-muted-foreground mt-2 max-w-[380px]">
                  Sua configuração inicial está completa. Você pode alterar tudo nas Configurações a qualquer momento.
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
            <div className="flex gap-2">
              {step > 0 && step < 3 && (
                <Button variant="outline" size="sm" onClick={() => setStep((s) => s - 1)} disabled={saving}>
                  Voltar
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {step > 0 && step < 3 && (
                <Button variant="ghost" size="sm" onClick={handleSkip} disabled={saving}>
                  Pular
                </Button>
              )}
              <Button onClick={handleNext} disabled={saving} size="sm">
                {saving ? "Salvando..." : step === 3 ? "Ir para o Dashboard" : "Próximo"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
