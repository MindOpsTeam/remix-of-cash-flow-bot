import { AppLayout } from "@/components/AppLayout";
import { ArrowLeft, Plus, Save, Building2, Hash, Loader2, Layers } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useCompany, type Company } from "@/hooks/useCompany";
import { supabase } from "@/integrations/supabase/client";

const MAX_COMPANIES = 6;

function formatCNPJ(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

const REGIME_OPTIONS = [
  { value: "regular", label: "Regime regular (Lucro Real/Presumido)" },
  { value: "simples", label: "Simples Nacional" },
  { value: "mei", label: "MEI" },
] as const;

function CompanyCard({ company, onSaved }: { company: Company; onSaved: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState(company.name);
  const [cnpj, setCnpj] = useState(company.cnpj ? formatCNPJ(company.cnpj) : "");
  const [regime, setRegime] = useState<string>(company.regimeTributario ?? "");
  const [cclasstrib, setCclasstrib] = useState(company.cclasstribPadrao ?? "");
  const [saving, setSaving] = useState(false);

  const dirty =
    name !== company.name ||
    cnpj.replace(/\D/g, "") !== (company.cnpj ?? "") ||
    regime !== (company.regimeTributario ?? "") ||
    cclasstrib.trim() !== (company.cclasstribPadrao ?? "");

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }
    setSaving(true);
    const rawCnpj = cnpj.replace(/\D/g, "");
    const { error } = await (supabase as any)
      .from("companies")
      .update({
        name: name.trim(),
        cnpj: rawCnpj || null,
        regime_tributario: regime || null,
        cclasstrib_padrao: cclasstrib.trim() || null,
      })
      .eq("id", company.id);
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Empresa atualizada", description: name.trim() });
      onSaved();
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
            <Hash className="h-3 w-3" /> {company.orgId}
          </span>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`name-${company.id}`}>Nome / Razão Social</Label>
          <Input id={`name-${company.id}`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Empresa XYZ Ltda" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`cnpj-${company.id}`}>CNPJ</Label>
          <Input
            id={`cnpj-${company.id}`}
            value={cnpj}
            onChange={(e) => setCnpj(formatCNPJ(e.target.value))}
            placeholder="00.000.000/0000-00"
            maxLength={18}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`regime-${company.id}`}>Regime tributário (Reforma CBS/IBS)</Label>
          <select
            id={`regime-${company.id}`}
            value={regime}
            onChange={(e) => setRegime(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Não informado</option>
            {REGIME_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`cclasstrib-${company.id}`}>cClassTrib padrão</Label>
          <Input
            id={`cclasstrib-${company.id}`}
            value={cclasstrib}
            onChange={(e) => setCclasstrib(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000001 (tributação integral)"
            maxLength={6}
          />
          <p className="text-xs text-muted-foreground">
            Código da tabela nacional de classificação tributária usado no destaque CBS/IBS das notas.
          </p>
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={handleSave} disabled={saving || !dirty} size="sm" className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  );
}

function LinkCompanyForm({ disabled, onLinked }: { disabled: boolean; onLinked: () => Promise<void> }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [saving, setSaving] = useState(false);

  const handleLink = async () => {
    if (!name.trim()) {
      toast({ title: "Informe o nome da empresa", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("create_company_for_user", {
      company_name: name.trim(),
      company_cnpj: cnpj.replace(/\D/g, "") || undefined,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Não foi possível vincular", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "CNPJ vinculado", description: name.trim() });
    setName("");
    setCnpj("");
    setOpen(false);
    await onLinked();
  };

  if (disabled) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
        Limite de {MAX_COMPANIES} CNPJs atingido.
      </div>
    );
  }

  if (!open) {
    return (
      <Button variant="outline" className="w-full gap-2 border-dashed" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Vincular nova empresa (CNPJ)
      </Button>
    );
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-card p-5">
      <p className="mb-4 text-sm font-semibold text-foreground">Vincular novo CNPJ</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="new-name">Nome / Razão Social</Label>
          <Input id="new-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Filial Sul Ltda" autoFocus />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-cnpj">CNPJ</Label>
          <Input id="new-cnpj" value={cnpj} onChange={(e) => setCnpj(formatCNPJ(e.target.value))} placeholder="00.000.000/0000-00" maxLength={18} />
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
        <Button size="sm" className="gap-2" onClick={handleLink} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Vincular
        </Button>
      </div>
    </div>
  );
}

export default function CompanySettings() {
  const { companies, loading, refetch } = useCompany();

  return (
    <AppLayout>
      <div className="mb-6 flex items-center gap-3">
        <Link to="/settings" className="text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-foreground">Empresas</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Vincule até {MAX_COMPANIES} CNPJs — cada um tem seu próprio org_id e dados isolados.
          </p>
        </div>
      </div>

      <div className="max-w-3xl space-y-4">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <Layers className="h-4 w-4 text-primary" />
          {companies.length} de {MAX_COMPANIES} CNPJs vinculados. O painel consolida todos ou mostra individualmente pelo seletor no topo.
        </div>

        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {companies.map((c) => (
              <CompanyCard key={c.id} company={c} onSaved={() => refetch()} />
            ))}
            <LinkCompanyForm disabled={companies.length >= MAX_COMPANIES} onLinked={refetch} />
          </>
        )}
      </div>
    </AppLayout>
  );
}
