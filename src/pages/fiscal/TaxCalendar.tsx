import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertTriangle, Calendar, Plus, DollarSign, CheckCircle2, MoreHorizontal, Pencil, Trash2, Check } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useTaxGuides, type TaxGuideInput } from "@/hooks/useTaxGuides";
import { TaxGuideFormDialog } from "@/components/fiscal/TaxGuideFormDialog";
import { DeleteConfirmDialog } from "@/components/fiscal/DeleteConfirmDialog";
import { LinhaDetalhe } from "@/components/detalhe/LinhaDetalhe";

const statusConfig: Record<string, { label: string; className: string }> = {
  a_pagar: { label: "A Pagar", className: "bg-warning/[0.08] text-warning dark:bg-warning/[0.08] dark:text-warning" },
  pago: { label: "Pago", className: "bg-success/[0.08] text-success dark:bg-success/[0.08] dark:text-success" },
  atrasado: { label: "Atrasado", className: "bg-destructive/[0.08] text-destructive dark:bg-destructive/[0.08] dark:text-destructive" },
};

export default function TaxCalendar() {
  const { guides, isLoading, createGuide, updateGuide, deleteGuide, markAsPaid } = useTaxGuides();
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<(TaxGuideInput & { id: string }) | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const totalAPagar = guides.filter(g => g.status === "a_pagar").reduce((s, g) => s + g.valor, 0);
  const totalPago = guides.filter(g => g.status === "pago").reduce((s, g) => s + g.valor, 0);
  const totalAtrasado = guides.filter(g => g.status === "atrasado").reduce((s, g) => s + g.valor, 0);
  const overdueCount = guides.filter(g => g.status === "atrasado").length;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Calendário de Impostos</h1>
            <p className="text-sm text-muted-foreground mt-1">Guias e tributos organizados por vencimento</p>
          </div>
          <Button size="sm" className="gap-2" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> Adicionar Guia
          </Button>
        </div>

        {overdueCount > 0 && (
          <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/[0.08] dark:border-destructive/30 dark:bg-destructive/[0.08] px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
            <p className="text-sm text-destructive dark:text-destructive">
              Você tem <strong>{overdueCount}</strong> guia{overdueCount > 1 ? "s" : ""} vencida{overdueCount > 1 ? "s" : ""} totalizando {formatCurrency(totalAtrasado)}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-warning/[0.08] dark:bg-warning/[0.08] flex items-center justify-center"><DollarSign className="h-4 w-4 text-warning" /></div>
            <div><p className="text-xs text-muted-foreground">A Pagar</p><p className="text-lg font-semibold tabular-nums">{formatCurrency(totalAPagar)}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-success/[0.08] dark:bg-success/[0.08] flex items-center justify-center"><CheckCircle2 className="h-4 w-4 text-success" /></div>
            <div><p className="text-xs text-muted-foreground">Pago este mês</p><p className="text-lg font-semibold tabular-nums">{formatCurrency(totalPago)}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-destructive/[0.08] dark:bg-destructive/[0.08] flex items-center justify-center"><AlertTriangle className="h-4 w-4 text-destructive" /></div>
            <div><p className="text-xs text-muted-foreground">Atrasado</p><p className="text-lg font-semibold tabular-nums">{formatCurrency(totalAtrasado)}</p></div>
          </CardContent></Card>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : guides.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Nenhuma guia cadastrada</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tipo</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Competência</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Vencimento</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Valor</th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                      <th className="w-10 px-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {guides.map(g => (
                      <LinhaDetalhe tipo="tax_guide" id={g.id} key={g.id} className="border-b last:border-b-0">
                        <td className="px-4 py-3 font-medium">{g.tipo}</td>
                        <td className="px-4 py-3 text-muted-foreground">{g.competencia}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(g.vencimento)}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium">{formatCurrency(g.valor)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium ${statusConfig[g.status]?.className ?? ""}`}>
                            {statusConfig[g.status]?.label ?? g.status}
                          </span>
                        </td>
                        <td className="px-2 py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {g.status !== "pago" && (
                                <DropdownMenuItem onClick={() => markAsPaid.mutate(g.id)}>
                                  <Check className="h-4 w-4 mr-2" /> Marcar como Pago
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => { setEditItem({ id: g.id, tipo: g.tipo, competencia: g.competencia, vencimento: g.vencimento, valor: g.valor }); }}>
                                <Pencil className="h-4 w-4 mr-2" /> Editar
                              </DropdownMenuItem>
                              {g.source === "manual" && (
                                <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(g.id)}>
                                  <Trash2 className="h-4 w-4 mr-2" /> Excluir
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </LinhaDetalhe>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <TaxGuideFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={(data) => createGuide.mutate(data)}
        isPending={createGuide.isPending}
      />

      {editItem && (
        <TaxGuideFormDialog
          open={true}
          onOpenChange={(o) => { if (!o) setEditItem(null); }}
          initialData={editItem}
          onSubmit={(data) => updateGuide.mutate({ id: editItem.id, ...data })}
          isPending={updateGuide.isPending}
        />
      )}

      <DeleteConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => { if (!o) setDeleteId(null); }}
        onConfirm={() => { if (deleteId) { deleteGuide.mutate(deleteId); setDeleteId(null); } }}
        description="A guia será removida permanentemente."
      />
    </AppLayout>
  );
}
