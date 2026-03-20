import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

type BillStatus = "a_vencer" | "vencido" | "pago";

interface Bill {
  id: string;
  fornecedor: string;
  descricao: string;
  valor: number;
  vencimento: string;
  status: BillStatus;
}

const mockBills: Bill[] = [
  { id: "1", fornecedor: "Algar Telecom", descricao: "Internet fibra — março", valor: 249.90, vencimento: "2026-03-25", status: "a_vencer" },
  { id: "2", fornecedor: "CEMIG", descricao: "Energia elétrica", valor: 487.32, vencimento: "2026-03-10", status: "vencido" },
  { id: "3", fornecedor: "Contabilidade Silva", descricao: "Honorários contábeis", valor: 1200.00, vencimento: "2026-04-05", status: "a_vencer" },
  { id: "4", fornecedor: "Google Cloud", descricao: "Infraestrutura cloud", valor: 890.00, vencimento: "2026-03-28", status: "a_vencer" },
  { id: "5", fornecedor: "Aluguel Sede", descricao: "Aluguel escritório", valor: 3500.00, vencimento: "2026-03-05", status: "pago" },
  { id: "6", fornecedor: "Seguro Empresarial", descricao: "Parcela 4/12", valor: 620.00, vencimento: "2026-03-15", status: "pago" },
];

const statusConfig: Record<BillStatus, { label: string; className: string; icon: typeof Clock }> = {
  a_vencer: { label: "A Vencer", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: Clock },
  vencido: { label: "Vencido", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: AlertTriangle },
  pago: { label: "Pago", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: CheckCircle2 },
};

export default function BillsPayable() {
  const [bills] = useState(mockBills);

  const totals = {
    aVencer: bills.filter(b => b.status === "a_vencer").reduce((s, b) => s + b.valor, 0),
    vencido: bills.filter(b => b.status === "vencido").reduce((s, b) => s + b.valor, 0),
    pago: bills.filter(b => b.status === "pago").reduce((s, b) => s + b.valor, 0),
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Contas a Pagar</h1>
            <p className="text-sm text-muted-foreground mt-1">Boletos e contas do OCR ou cadastro manual</p>
          </div>
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" /> Adicionar Boleto
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {([
            { label: "A Vencer", value: totals.aVencer, color: "amber", Icon: Clock },
            { label: "Vencido", value: totals.vencido, color: "red", Icon: AlertTriangle },
            { label: "Pago", value: totals.pago, color: "emerald", Icon: CheckCircle2 },
          ] as const).map(({ label, value, color, Icon }) => (
            <Card key={label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`h-9 w-9 rounded-lg bg-${color}-100 dark:bg-${color}-900/30 flex items-center justify-center`}>
                  <Icon className={`h-4 w-4 text-${color}-600`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-lg font-semibold tabular-nums">{formatCurrency(value)}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Fornecedor</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Descrição</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Vencimento</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Valor</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map(b => (
                    <tr key={b.id} className="border-b last:border-b-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium">{b.fornecedor}</td>
                      <td className="px-4 py-3 text-muted-foreground">{b.descricao}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(b.vencimento)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">{formatCurrency(b.valor)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium ${statusConfig[b.status].className}`}>
                          {statusConfig[b.status].label}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
