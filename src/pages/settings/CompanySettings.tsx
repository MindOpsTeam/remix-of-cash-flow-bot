import { AppLayout } from "@/components/AppLayout";
import { ArrowLeft, Save } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/hooks/useCompany";
import { supabase } from "@/integrations/supabase/client";

function formatCNPJ(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export default function CompanySettings() {
  const { company } = useCompany();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (company) {
      setName(company.name);
      setCnpj(company.cnpj ? formatCNPJ(company.cnpj) : "");
    }
  }, [company]);

  const handleSave = async () => {
    if (!company) return;
    if (!name.trim()) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }
    setSaving(true);
    const rawCnpj = cnpj.replace(/\D/g, "");
    const { error } = await supabase
      .from("companies")
      .update({ name: name.trim(), cnpj: rawCnpj || null })
      .eq("id", company.id);
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Dados salvos", description: "Informações da empresa atualizadas." });
    }
  };

  return (
    <AppLayout>
      <div className="mb-6 flex items-center gap-3">
        <Link to="/settings" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em]">Empresa</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Dados cadastrais da empresa</p>
        </div>
      </div>

      <div className="max-w-lg space-y-6">
        <div className="bg-card border border-border rounded-lg p-5 space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nome / Razão Social</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Empresa XYZ Ltda"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cnpj">CNPJ</Label>
            <Input
              id="cnpj"
              value={cnpj}
              onChange={(e) => setCnpj(formatCNPJ(e.target.value))}
              placeholder="00.000.000/0000-00"
              maxLength={18}
            />
            <p className="text-xs text-muted-foreground">Deixe em branco se ainda não tiver CNPJ</p>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </AppLayout>
  );
}
