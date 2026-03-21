import { useState, useEffect, useCallback, useRef, ChangeEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";

interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const paymentMethods = [
  { value: "pix", label: "PIX" },
  { value: "boleto", label: "Boleto" },
  { value: "credit_card", label: "Cartão de Crédito" },
  { value: "debit_card", label: "Cartão de Débito" },
  { value: "transfer", label: "Transferência" },
  { value: "cash", label: "Dinheiro" },
  { value: "other", label: "Outro" },
];

export function TransactionForm({ open, onOpenChange, onSuccess }: TransactionFormProps) {
  const { company } = useCompany();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [accounts, setAccounts] = useState<{ id: string; name: string; code: string | null; type: string }[]>([]);
  const [costCenters, setCostCenters] = useState<{ id: string; name: string; category: string }[]>([]);
  const [bankAccounts, setBankAccounts] = useState<{ id: string; name: string }[]>([]);

  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    description: "",
    amount: "",
    type: "expense" as "revenue" | "expense",
    account_id: "",
    cost_center_id: "",
    bank_account_id: "",
    payment_method: "",
    project: "",
  });

  const [aiSuggested, setAiSuggested] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!company) return;
    const fetchOptions = async () => {
      const [accts, ccs, banks] = await Promise.all([
        supabase.from("chart_of_accounts").select("id, name, code, type").eq("company_id", company.id).order("code"),
        supabase.from("cost_centers").select("id, name, category").eq("company_id", company.id).eq("active", true).order("name"),
        supabase.from("bank_accounts").select("id, name").eq("company_id", company.id).order("name"),
      ]);
      if (accts.data) setAccounts(accts.data);
      if (ccs.data) setCostCenters(ccs.data as any);
      if (banks.data) setBankAccounts(banks.data);
    };
    fetchOptions();
  }, [company]);

  const classifyWithAI = useCallback(async (description: string) => {
    if (!company || description.trim().length < 5) return;
    setClassifying(true);
    setAiSuggested(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-classify`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ description, type: form.type, company_id: company.id }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.account_id && !form.account_id) {
          setForm(prev => ({ ...prev, account_id: data.account_id, cost_center_id: data.cost_center_id || prev.cost_center_id }));
          setAiSuggested(true);
          toast.success("✨ IA sugeriu a classificação automaticamente!");
        }
      }
    } catch (e) {
      console.error("AI classify error:", e);
    } finally {
      setClassifying(false);
    }
  }, [company, form.type, form.account_id]);

  const debouncedClassify = useCallback((description: string) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => classifyWithAI(description), 600);
  }, [classifyWithAI]);

  const filteredAccounts = accounts.filter((a) => {
    if (form.type === "revenue") return a.type === "revenue";
    return a.type === "expense";
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !user) return;
    const amount = parseFloat(form.amount.replace(",", "."));
    if (isNaN(amount) || amount <= 0) { toast.error("Informe um valor válido."); return; }
    if (!form.account_id) { toast.error("Selecione uma conta contábil."); return; }
    if (!form.cost_center_id) { toast.error("Selecione um centro de custo."); return; }

    setLoading(true);
    const { error } = await supabase.from("transactions").insert({
      company_id: company.id, user_id: user.id, date: form.date,
      description: form.description.trim(), amount, type: form.type,
      account_id: form.account_id, cost_center_id: form.cost_center_id,
      bank_account_id: form.bank_account_id || null, payment_method: form.payment_method || null,
      project: form.project.trim() || null, status: "confirmed", source: "manual",
    });

    if (error) { toast.error("Erro ao salvar: " + error.message); }
    else {
      toast.success("Lançamento criado com sucesso!");
      setForm({ date: new Date().toISOString().split("T")[0], description: "", amount: "", type: "expense", account_id: "", cost_center_id: "", bank_account_id: "", payment_method: "", project: "" });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      onSuccess();
      onOpenChange(false);
    }
    setLoading(false);
  };

  const update = (key: string, value: string) => {
    if (key === "type") { setForm({ ...form, type: value as any, account_id: "" }); }
    else { setForm({ ...form, [key]: value }); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Lançamento</DialogTitle>
          <DialogDescription>Registre uma receita ou despesa</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tipo *</Label>
              <Select value={form.type} onValueChange={(v) => update("type", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="revenue">Receita</SelectItem>
                  <SelectItem value="expense">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data *</Label>
              <Input type="date" value={form.date} onChange={(e) => update("date", e.target.value)} required className="mt-1" />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <Label>Descrição *</Label>
              {classifying && (
                <span className="flex items-center gap-1 text-xs text-primary">
                  <Loader2 className="h-3 w-3 animate-spin" /> Classificando...
                </span>
              )}
              {aiSuggested && !classifying && (
                <span className="flex items-center gap-1 text-xs text-revenue">
                  <Sparkles className="h-3 w-3" /> IA sugeriu
                </span>
              )}
            </div>
            <Textarea 
              value={form.description} 
              onChange={(e) => update("description", e.target.value)} 
              onBlur={() => debouncedClassify(form.description)}
              placeholder="Descreva o lançamento e a IA sugere a classificação..." 
              required 
              className="mt-1 min-h-[60px]" 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Valor (R$) *</Label>
              <Input value={form.amount} onChange={(e) => update("amount", e.target.value)} placeholder="0,00" required className="mt-1" />
            </div>
            <div>
              <Label>Forma de Pagamento</Label>
              <Select value={form.payment_method} onValueChange={(v) => update("payment_method", v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Conta Contábil *</Label>
            <Select value={form.account_id} onValueChange={(v) => update("account_id", v)}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione uma conta..." /></SelectTrigger>
              <SelectContent>
                {filteredAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.code ? `${a.code} - ` : ""}{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Centro de Custo *</Label>
              <Select value={form.cost_center_id} onValueChange={(v) => update("cost_center_id", v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {costCenters.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Conta Bancária</Label>
              <Select value={form.bank_account_id} onValueChange={(v) => update("bank_account_id", v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Projeto (opcional)</Label>
            <Input value={form.project} onChange={(e) => update("project", e.target.value)} placeholder="Ex: Projeto Alpha, Cliente XYZ..." className="mt-1" />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" variant="accent" className="flex-1" disabled={loading}>{loading ? "Salvando..." : "Salvar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
