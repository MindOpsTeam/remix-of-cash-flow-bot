import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Calendar, Plus, DollarSign, CheckCircle2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

type GuiaStatus = "a_pagar" | "pago" | "atrasado";

interface TaxGuide {
  id: string;
  tipo: string;
  competencia: string;
  vencimento: string;
  valor: number;
  status: GuiaStatus;
}

const mockGuias: TaxGuide[] = [
  { id: "1", tipo: "DAS", competencia: "02/2026", vencimento: "2026-03-20", valor: 312.45, status: "atrasado" },
  { id: "2", tipo: "DARF - IRPJ", competencia: "02/2026", vencimento: "2026-03-31", valor: 1840.00, status: "a_pagar" },
  { id: "3", tipo: "ISS", competencia: "02/2026", vencimento: "2026-03-15", valor: 520.00, status: "atrasado" },
  { id: "4", tipo: "DARF - CSLL", competencia: "02/2026", vencimento: "2026-04-15", valor: 960.00, status: "a_pagar" },
  { id: "5", tipo: "DAS", competencia: "01/2026", vencimento: "2026-02-20", valor: 298.30, status: "pago" },
  { id: "6", tipo: "ISS", competencia: "01/2026", vencimento: "2026-02-15", valor: 480.00, status: "pago" },
  { id: "7", tipo: "ICMS", competencia: "02/2026", vencimento: "2026-04-10", valor: 2150.00, status: "a_pagar" },
];

const statusConfig: Record<GuiaStatus, { label: string; className: string }> = {
  a_pagar: { label: "A Pagar", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  pago: { label: "Pago", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  atrasado: { label: "Atrasado", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

export default function TaxCalendar() {
  const [guias] = useState(mockGuias);

  const totalAPagar = guias.filter(g => g.status === "a_pagar").reduce((s, g) => s + g.valor, 0);
  const totalPago = guias.filter(g => g.status === "pago").reduce((s, g) => s + g.valor, 0);
  const totalAtrasado = guias.filter(g => g.status === "atrasado").reduce((s, g) => s + g.valor, 0);
  const overdueCount = guias.filter(g => g.status === "atrasado").length;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Calendário de Impostos</h1>
            <p className="text-sm text-muted-foreground mt-1">Guias e tributos organizados por vencimento</p>
          </div>
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" /> Adicionar Guia
          </Button>
        </div>

        {/* Alert */}
        {overdueCount > 0 && (
          <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-400">
              Você tem <strong>{overdueCount}</strong> guia{overdueCount > 1 ? "s" : ""} vencida{overdueCount > 1 ? "s" : ""} totalizando {formatCurrency(totalAtrasado)}
            </p>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">A Pagar</p>
                <p className="text-lg font-semibold tabular-nums">{formatCurrency(totalAPagar)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pago este mês</p>
                <p className="text-lg font-semibold tabular-nums">{formatCurrency(totalPago)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Atrasado</p>
                <p className="text-lg font-semibold tabular-nums">{formatCurrency(totalAtrasado)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tipo</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Competência</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Vencimento</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Valor</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {guias.map(g => (
                    <tr key={g.id} className="border-b last:border-b-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium">{g.tipo}</td>
                      <td className="px-4 py-3 text-muted-foreground">{g.competencia}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(g.vencimento)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">{formatCurrency(g.valor)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium ${statusConfig[g.status].className}`}>
                          {statusConfig[g.status].label}
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
