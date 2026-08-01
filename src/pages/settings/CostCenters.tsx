import { mensagemDeErro } from "@/lib/erros";
import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

interface CostCenter {
  id: string;
  name: string;
  category: string;
}

const categoryLabels: Record<string, string> = {
  department: "Departamento",
  project: "Projeto",
  client: "Cliente",
  branch: "Unidade/Filial",
};

export default function CostCentersPage() {
  const { company } = useCompany();
  const [centers, setCenters] = useState<CostCenter[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CostCenter | null>(null);
  const [form, setForm] = useState({ name: "", category: "department" });

  const fetch = useCallback(async () => {
    if (!company) return;
    const { data } = await supabase
      .from("cost_centers")
      .select("id, name, category")
      .eq("company_id", company.id)
      .order("category")
      .order("name");
    if (data) setCenters(data as CostCenter[]);
  }, [company]);

  useEffect(() => { fetch(); }, [fetch]);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", category: "department" });
    setDialogOpen(true);
  };

  const openEdit = (c: CostCenter) => {
    setEditing(c);
    setForm({ name: c.name, category: c.category });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!company || !form.name.trim()) return;
    if (editing) {
      const { error } = await supabase.from("cost_centers").update({ name: form.name.trim(), category: form.category }).eq("id", editing.id);
      if (error) { toast.error(mensagemDeErro(error)); return; }
      toast.success("Centro de custo atualizado!");
    } else {
      const { error } = await supabase.from("cost_centers").insert({ company_id: company.id, name: form.name.trim(), category: form.category });
      if (error) { toast.error(mensagemDeErro(error)); return; }
      toast.success("Centro de custo criado!");
    }
    setDialogOpen(false);
    fetch();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este centro de custo?")) return;
    const { error } = await supabase.from("cost_centers").delete().eq("id", id);
    if (error) { toast.error(mensagemDeErro(error)); return; }
    toast.success("Centro de custo excluído!");
    fetch();
  };

  const grouped = Object.entries(categoryLabels).map(([key, label]) => ({
    key,
    label,
    items: centers.filter((c) => c.category === key),
  })).filter((g) => g.items.length > 0);

  return (
    <AppLayout>
      <div className="flex items-center gap-3 mb-8">
        <Link to="/settings">
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Voltar"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em]">Centros de Custo</h1>
          <p className="text-sm text-muted-foreground mt-1">Departamentos, projetos e clientes</p>
        </div>
        <Button className="gap-2" onClick={openNew}><Plus className="h-4 w-4" />Novo Centro</Button>
      </div>

      <div className="bg-card border border-border rounded-lg p-5 max-w-2xl">
        {grouped.map((g) => (
          <div key={g.key} className="mb-6">
            <h3 className="text-sm font-semibold text-primary mb-3">{g.label.toUpperCase()}</h3>
            <div className="space-y-1">
              {g.items.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-accent/30 transition-colors group">
                  <span className="text-sm text-foreground">{c.name}</span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)} aria-label="Editar centro de custo"><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(c.id)} aria-label="Excluir centro de custo"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {grouped.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhum centro de custo cadastrado.</p>}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader><DialogTitle>{editing ? "Editar Centro de Custo" : "Novo Centro de Custo"}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 bg-background/50" />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger className="mt-1 bg-background/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={handleSave}>{editing ? "Salvar" : "Criar"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
