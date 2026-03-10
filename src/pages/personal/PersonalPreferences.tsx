import { AppLayout } from "@/components/AppLayout";
import { ArrowLeft, Save } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const STORAGE_KEY = "pf_preferences";

interface PFPreferences {
  defaultBudgetMethod: "kakeibo" | "50-30-20" | "zero-based" | "none";
  monthClosingDay: string;
  aiAutoClassify: boolean;
  whatsappNotifyOverdue: boolean;
  whatsappNotifyBudgetAlert: boolean;
  budgetAlertThreshold: string;
  showOwnerTransactions: boolean;
}

const defaults: PFPreferences = {
  defaultBudgetMethod: "none",
  monthClosingDay: "01",
  aiAutoClassify: false,
  whatsappNotifyOverdue: true,
  whatsappNotifyBudgetAlert: true,
  budgetAlertThreshold: "80",
  showOwnerTransactions: true,
};

export default function PersonalPreferences() {
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<PFPreferences>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    } catch {
      return defaults;
    }
  });

  const set = <K extends keyof PFPreferences>(key: K, value: PFPreferences[K]) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  };

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    toast({ title: "Preferências salvas", description: "Suas configurações foram atualizadas." });
  };

  return (
    <AppLayout>
      <div className="mb-6 flex items-center gap-3">
        <Link to="/personal/settings" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em]">Preferências</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Personalize sua experiência pessoal</p>
        </div>
      </div>

      <div className="max-w-2xl space-y-8">

        {/* Orçamento */}
        <section>
          <h2 className="text-sm font-semibold text-foreground mb-1">Planejamento</h2>
          <p className="text-xs text-muted-foreground mb-4">Método de orçamento e ciclo mensal</p>
          <div className="bg-card border border-border rounded-lg divide-y divide-border">

            <div className="flex items-center justify-between p-4">
              <div>
                <Label className="text-sm font-medium">Método de orçamento</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Regra utilizada nas sugestões automáticas de orçamento
                </p>
              </div>
              <Select
                value={prefs.defaultBudgetMethod}
                onValueChange={(v) => set("defaultBudgetMethod", v as PFPreferences["defaultBudgetMethod"])}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  <SelectItem value="50-30-20">50/30/20</SelectItem>
                  <SelectItem value="kakeibo">Kakeibo</SelectItem>
                  <SelectItem value="zero-based">Base zero</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-4">
              <div>
                <Label className="text-sm font-medium">Dia de fechamento mensal</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Dia em que o ciclo financeiro mensal reinicia
                </p>
              </div>
              <Select value={prefs.monthClosingDay} onValueChange={(v) => set("monthClosingDay", v)}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                    <SelectItem key={d} value={String(d).padStart(2, "0")}>Dia {d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

          </div>
        </section>

        {/* IA */}
        <section>
          <h2 className="text-sm font-semibold text-foreground mb-1">Agente de IA</h2>
          <p className="text-xs text-muted-foreground mb-4">Como o assistente classifica seus gastos</p>
          <div className="bg-card border border-border rounded-lg divide-y divide-border">

            <div className="flex items-center justify-between p-4">
              <div>
                <Label className="text-sm font-medium">Classificação automática</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Gastos com alta confiança são salvos sem pedir confirmação
                </p>
              </div>
              <Switch
                checked={prefs.aiAutoClassify}
                onCheckedChange={(v) => set("aiAutoClassify", v)}
              />
            </div>

          </div>
        </section>

        {/* Notificações WhatsApp */}
        <section>
          <h2 className="text-sm font-semibold text-foreground mb-1">Notificações WhatsApp</h2>
          <p className="text-xs text-muted-foreground mb-4">Alertas enviados pelo assistente</p>
          <div className="bg-card border border-border rounded-lg divide-y divide-border">

            <div className="flex items-center justify-between p-4">
              <div>
                <Label className="text-sm font-medium">Contas vencidas</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Aviso quando contas a pagar estiverem atrasadas</p>
              </div>
              <Switch
                checked={prefs.whatsappNotifyOverdue}
                onCheckedChange={(v) => set("whatsappNotifyOverdue", v)}
              />
            </div>

            <div className="flex items-center justify-between p-4">
              <div>
                <Label className="text-sm font-medium">Alerta de orçamento</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Aviso quando o gasto atingir {prefs.budgetAlertThreshold}% do orçamento da categoria
                </p>
              </div>
              <Switch
                checked={prefs.whatsappNotifyBudgetAlert}
                onCheckedChange={(v) => set("whatsappNotifyBudgetAlert", v)}
              />
            </div>

            {prefs.whatsappNotifyBudgetAlert && (
              <div className="flex items-center justify-between p-4">
                <div>
                  <Label className="text-sm font-medium">Limiar de alerta (%)</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Percentual do orçamento que dispara o aviso</p>
                </div>
                <Select value={prefs.budgetAlertThreshold} onValueChange={(v) => set("budgetAlertThreshold", v)}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="60">60%</SelectItem>
                    <SelectItem value="70">70%</SelectItem>
                    <SelectItem value="80">80%</SelectItem>
                    <SelectItem value="90">90%</SelectItem>
                    <SelectItem value="100">100%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

          </div>
        </section>

        {/* Exibição */}
        <section>
          <h2 className="text-sm font-semibold text-foreground mb-1">Exibição</h2>
          <p className="text-xs text-muted-foreground mb-4">O que mostrar no painel pessoal</p>
          <div className="bg-card border border-border rounded-lg divide-y divide-border">

            <div className="flex items-center justify-between p-4">
              <div>
                <Label className="text-sm font-medium">Transações Sócio ↔ Empresa</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Exibir aportes e retiradas na visão pessoal
                </p>
              </div>
              <Switch
                checked={prefs.showOwnerTransactions}
                onCheckedChange={(v) => set("showOwnerTransactions", v)}
              />
            </div>

          </div>
        </section>

        <Button onClick={save} className="gap-2">
          <Save className="h-4 w-4" />
          Salvar preferências
        </Button>

      </div>
    </AppLayout>
  );
}
