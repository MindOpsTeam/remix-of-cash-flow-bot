import { AppLayout } from "@/components/AppLayout";
import { ArrowLeft, Save } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "pj_preferences";

interface PJPreferences {
  aiAutoClassify: boolean;
  aiConfirmationThreshold: "low" | "medium" | "high";
  whatsappNotifyOverdue: boolean;
  whatsappNotifyLowBalance: boolean;
  defaultCurrency: string;
  fiscalYearStart: string;
  dateFormat: string;
}

const defaults: PJPreferences = {
  aiAutoClassify: false,
  aiConfirmationThreshold: "medium",
  whatsappNotifyOverdue: true,
  whatsappNotifyLowBalance: false,
  defaultCurrency: "BRL",
  fiscalYearStart: "01",
  dateFormat: "DD/MM/YYYY",
};

export default function Preferences() {
  const { toast } = useToast();
  // O que estava só no navegador passa a viver na conta: trocar de máquina não
  // pode zerar a configuração. O localStorage vira só ponte de migração.
  const [prefs, setPrefs] = useState<PJPreferences>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    } catch {
      return defaults;
    }
  });
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: sessao } = await supabase.auth.getUser();
      const uid = sessao.user?.id;
      if (!uid) return setCarregando(false);
      const { data } = await supabase
        .from("user_preferences" as never)
        .select("prefs")
        .eq("user_id", uid)
        .maybeSingle();
      const doBanco = (data as { prefs?: Partial<PJPreferences> } | null)?.prefs;
      if (doBanco && Object.keys(doBanco).length > 0) {
        setPrefs((atual) => ({ ...atual, ...doBanco }));
      }
      setCarregando(false);
    })();
  }, []);

  const set = <K extends keyof PJPreferences>(key: K, value: PJPreferences[K]) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    setSalvando(true);
    try {
      const { data: sessao } = await supabase.auth.getUser();
      const uid = sessao.user?.id;
      if (!uid) throw new Error("Sessão expirada. Entre de novo.");
      const { error } = await supabase
        .from("user_preferences" as never)
        .upsert({ user_id: uid, prefs } as never, { onConflict: "user_id" } as never);
      if (error) throw error;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
      toast({ title: "Preferências salvas", description: "Valem em qualquer dispositivo onde você entrar." });
    } catch (e) {
      toast({
        title: "Não consegui salvar",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <AppLayout>
      <div className="mb-6 flex items-center gap-3">
        <Link to="/settings" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em]">Preferências</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Personalize o comportamento do sistema. Vale em qualquer dispositivo onde você entrar.</p>
        </div>
      </div>

      <div className="max-w-2xl space-y-8">

        {/* IA Section */}
        <section>
          <h2 className="text-sm font-semibold text-foreground mb-1">Agente de IA</h2>
          <p className="text-xs text-muted-foreground mb-4">Como a IA classifica e processa seus lançamentos</p>
          <div className="bg-card border border-border rounded-lg divide-y divide-border">

            <div className="flex items-center justify-between p-4">
              <div>
                <Label className="text-sm font-medium">Classificação automática</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Lançamentos com alta confiança são salvos sem confirmação
                </p>
              </div>
              <Switch
                checked={prefs.aiAutoClassify}
                onCheckedChange={(v) => set("aiAutoClassify", v)}
              />
            </div>

            <div className="flex items-center justify-between p-4">
              <div>
                <Label className="text-sm font-medium">Limiar para perguntar ao usuário</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Quando a confiança da IA está abaixo deste nível, ela pergunta
                </p>
              </div>
              <Select
                value={prefs.aiConfirmationThreshold}
                onValueChange={(v) => set("aiConfirmationThreshold", v as PJPreferences["aiConfirmationThreshold"])}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixo</SelectItem>
                  <SelectItem value="medium">Médio</SelectItem>
                  <SelectItem value="high">Alto</SelectItem>
                </SelectContent>
              </Select>
            </div>

          </div>
        </section>

        {/* WhatsApp Notifications */}
        <section>
          <h2 className="text-sm font-semibold text-foreground mb-1">Notificações WhatsApp</h2>
          <p className="text-xs text-muted-foreground mb-4">Alertas enviados proativamente pelo assistente</p>
          <div className="bg-card border border-border rounded-lg divide-y divide-border">

            <div className="flex items-center justify-between p-4">
              <div>
                <Label className="text-sm font-medium">Contas vencidas</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Aviso quando contas a pagar estão atrasadas
                </p>
              </div>
              <Switch
                checked={prefs.whatsappNotifyOverdue}
                onCheckedChange={(v) => set("whatsappNotifyOverdue", v)}
              />
            </div>

            <div className="flex items-center justify-between p-4">
              <div>
                <Label className="text-sm font-medium">Saldo baixo</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Alerta quando o saldo bancário estiver abaixo do mínimo configurado
                </p>
              </div>
              <Switch
                checked={prefs.whatsappNotifyLowBalance}
                onCheckedChange={(v) => set("whatsappNotifyLowBalance", v)}
              />
            </div>

          </div>
        </section>

        {/* Regional */}
        <section>
          <h2 className="text-sm font-semibold text-foreground mb-1">Regional</h2>
          <p className="text-xs text-muted-foreground mb-4">Moeda, datas e ano fiscal</p>
          <div className="bg-card border border-border rounded-lg divide-y divide-border">

            <div className="flex items-center justify-between p-4">
              <div>
                <Label className="text-sm font-medium">Moeda padrão</Label>
              </div>
              <Select value={prefs.defaultCurrency} onValueChange={(v) => set("defaultCurrency", v)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">BRL — Real</SelectItem>
                  <SelectItem value="USD">USD — Dólar</SelectItem>
                  <SelectItem value="EUR">EUR — Euro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-4">
              <div>
                <Label className="text-sm font-medium">Início do ano fiscal</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Mês de início para relatórios anuais</p>
              </div>
              <Select value={prefs.fiscalYearStart} onValueChange={(v) => set("fiscalYearStart", v)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"].map((m, i) => (
                    <SelectItem key={i} value={String(i + 1).padStart(2, "0")}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-4">
              <div>
                <Label className="text-sm font-medium">Formato de data</Label>
              </div>
              <Select value={prefs.dateFormat} onValueChange={(v) => set("dateFormat", v)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DD/MM/YYYY">DD/MM/AAAA</SelectItem>
                  <SelectItem value="MM/DD/YYYY">MM/DD/AAAA</SelectItem>
                  <SelectItem value="YYYY-MM-DD">AAAA-MM-DD</SelectItem>
                </SelectContent>
              </Select>
            </div>

          </div>
        </section>

        <Button onClick={save} className="gap-2" disabled={salvando || carregando}>
          <Save className="h-4 w-4" />
          {salvando ? "Salvando..." : carregando ? "Carregando..." : "Salvar preferências"}
        </Button>

      </div>
    </AppLayout>
  );
}
