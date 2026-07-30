import { useState, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeftRight, Plus, TrendingUp, TrendingDown, Scale } from "lucide-react";
import { useOwnerTransactions, OWNER_TX_TYPES, OwnerTransactionFormData, OwnerTxType } from "@/hooks/useOwnerTransactions";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

const typeColors: Record<string, string> = {
  retirada: "text-destructive",
  pro_labore: "text-destructive",
  dividendo: "text-destructive",
  emprestimo_pj_pf: "text-warning",
  aporte: "text-revenue",
  emprestimo_pf_pj: "text-warning",
};

const directionLabels: Record<string, string> = {
  retirada: "Empresa → Pessoal",
  aporte: "Pessoal → Empresa",
  pro_labore: "Empresa → Pessoal",
  dividendo: "Empresa → Pessoal",
  emprestimo_pf_pj: "Pessoal → Empresa",
  emprestimo_pj_pf: "Empresa → Pessoal",
};

const emptyForm: OwnerTransactionFormData = {
  transaction_type: "retirada",
  amount: 0,
  date: new Date().toISOString().split("T")[0],
  description: "",
  pj_bank_account_id: null,
};

export default function OwnerTransactions() {
  const { transactions, isLoading, summary, createTransaction, isCreating } = useOwnerTransactions();
  
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<OwnerTransactionFormData>({ ...emptyForm });

  const grouped = useMemo(() => {
    const groups: Record<string, typeof transactions> = {};
    for (const t of transactions) {
      const key = t.date || "sem-data";
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [transactions]);

  const handleSubmit = () => {
    if (!form.amount || form.amount <= 0) return;
    createTransaction(form, {
      onSuccess: () => {
        setFormOpen(false);
        setForm({ ...emptyForm });
      },
    });
  };

  const typeLabel = (type: string) =>
    OWNER_TX_TYPES.find((t) => t.value === type)?.label || type;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em]">
              Sócio ↔ Empresa
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Retiradas, aportes, pró-labore e movimentações entre patrimônios
            </p>
          </div>
          <Button className="gap-2" variant="accent" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> Nova Movimentação
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Empresa → Pessoal</p>
              <p className="text-xl font-bold font-mono text-destructive">
                {fmt(summary.pjToPf)}
              </p>
              <p className="text-[10px] text-muted-foreground">
                retiradas, pró-labore, dividendos
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Pessoal → Empresa</p>
              <p className="text-xl font-bold font-mono text-revenue">
                {fmt(summary.pfToPj)}
              </p>
              <p className="text-[10px] text-muted-foreground">aportes, empréstimos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Fluxo Líquido</p>
              <p
                className={`text-xl font-bold font-mono ${
                  summary.netFlow >= 0 ? "text-revenue" : "text-destructive"
                }`}
              >
                {fmt(summary.netFlow)}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {summary.netFlow >= 0
                  ? "sócio aportou mais"
                  : "sócio retirou mais"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Total de Movimentações</p>
              <p className="text-xl font-bold font-mono">{summary.count}</p>
            </CardContent>
          </Card>
        </div>

        {/* Transactions List */}
        <div className="space-y-2">
          {isLoading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                Carregando...
              </CardContent>
            </Card>
          ) : grouped.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Scale className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground text-sm">
                  Nenhuma movimentação sócio ↔ empresa registrada.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Registre retiradas, aportes e pró-labore para manter o patrimônio organizado.
                </p>
              </CardContent>
            </Card>
          ) : (
            grouped.map(([dateKey, items]) => (
              <div key={dateKey}>
                <div className="px-2 py-1.5">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {dateKey === "sem-data"
                      ? "Sem data"
                      : format(parseISO(dateKey), "dd 'de' MMM yyyy", {
                          locale: ptBR,
                        })}
                  </span>
                </div>
                <div className="bg-card border border-border rounded-lg divide-y divide-border">
                  {items.map((t) => {
                    const isPjToPf = [
                      "retirada",
                      "pro_labore",
                      "dividendo",
                      "emprestimo_pj_pf",
                    ].includes(t.transaction_type);
                    return (
                      <div
                        key={t.id}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
                      >
                        <div
                          className={`flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center ${
                            isPjToPf
                              ? "bg-destructive/10 text-destructive"
                              : "bg-revenue/10 text-revenue"
                          }`}
                        >
                          {isPjToPf ? (
                            <TrendingDown className="h-4 w-4" />
                          ) : (
                            <TrendingUp className="h-4 w-4" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <p className="text-sm font-medium">
                            {typeLabel(t.transaction_type)}
                          </p>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span>{directionLabels[t.transaction_type]}</span>
                            {t.description && <span>• {t.description}</span>}
                          </div>
                        </div>
                        <span
                          className={`text-sm font-semibold font-mono ${
                            typeColors[t.transaction_type] || ""
                          }`}
                        >
                          {fmt(Number(t.amount))}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Movimentação Sócio ↔ Empresa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo de Movimentação</Label>
              <Select
                value={form.transaction_type}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    transaction_type: v as OwnerTxType,
                  }))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OWNER_TX_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valor</Label>
                <Input
                  inputMode="numeric"
                  value={form.amount ? new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(form.amount) : ""}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "");
                    setForm((f) => ({
                      ...f,
                      amount: parseInt(digits || "0", 10) / 100,
                    }));
                  }}
                  placeholder="0,00"
                />
              </div>
              <div>
                <Label>Data</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, date: e.target.value }))
                  }
                />
              </div>
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Input
                value={form.description || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Ex: Pró-labore janeiro 2026"
              />
            </div>
            <div className="bg-muted/50 rounded-md p-3 text-xs text-muted-foreground">
              <ArrowLeftRight className="h-3.5 w-3.5 inline mr-1.5" />
              Registra a movimentação e o lançamento correspondente na{" "}
              <strong>empresa (PJ)</strong>, com a direção correta (retirada/dividendo saem; aporte entra).
            </div>
            <Button
              onClick={handleSubmit}
              disabled={isCreating || !form.amount}
              className="w-full"
            >
              {isCreating ? "Registrando..." : "Registrar Movimentação"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
