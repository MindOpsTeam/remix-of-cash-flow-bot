import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Clock, AlertTriangle, CheckCircle2, FileText, MoreHorizontal, Pencil, Trash2, Check, Repeat } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useBillsPayable, type BillInput } from "@/hooks/useBillsPayable";
import { BillFormDialog } from "@/components/fiscal/BillFormDialog";
import { DeleteConfirmDialog } from "@/components/fiscal/DeleteConfirmDialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LinhaDetalhe } from "@/components/detalhe/LinhaDetalhe";

const statusConfig: Record<string, { label: string; className: string; icon: typeof Clock }> = {
  a_vencer: { label: "A Vencer", className: "bg-warning/[0.08] text-warning dark:bg-warning/[0.08] dark:text-warning", icon: Clock },
  vencido: { label: "Vencido", className: "bg-destructive/[0.08] text-destructive dark:bg-destructive/[0.08] dark:text-destructive", icon: AlertTriangle },
  pago: { label: "Pago", className: "bg-success/[0.08] text-success dark:bg-success/[0.08] dark:text-success", icon: CheckCircle2 },
};

export default function BillsPayable() {
  const { bills, isLoading, createBill, updateBill, deleteBill, markAsPaid, decideBill, tornarRecorrente, encerrarRecorrencia } = useBillsPayable();
  const [recorrer, setRecorrer] = useState<{ id: string; fornecedor: string } | null>(null);
  const [ocorrencias, setOcorrencias] = useState("12");
  const [periodicidade, setPeriodicidade] = useState("mensal");
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<(BillInput & { id: string }) | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

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
          <Button size="sm" className="gap-2" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> Adicionar Boleto
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {([
            { label: "A Vencer", value: totals.aVencer, className: "bg-warning/[0.08] dark:bg-warning/[0.08]", iconClass: "text-warning", Icon: Clock },
            { label: "Vencido", value: totals.vencido, className: "bg-destructive/[0.08] dark:bg-destructive/[0.08]", iconClass: "text-destructive", Icon: AlertTriangle },
            { label: "Pago", value: totals.pago, className: "bg-success/[0.08] dark:bg-success/[0.08]", iconClass: "text-success", Icon: CheckCircle2 },
          ] as const).map(({ label, value, className, iconClass, Icon }) => (
            <Card key={label}><CardContent className="p-4 flex items-center gap-3">
              <div className={`h-9 w-9 rounded-lg ${className} flex items-center justify-center`}><Icon className={`h-4 w-4 ${iconClass}`} /></div>
              <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-lg font-semibold tabular-nums">{formatCurrency(value)}</p></div>
            </CardContent></Card>
          ))}
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : bills.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Nenhuma conta cadastrada</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Fornecedor</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Descrição</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Vencimento</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Valor</th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                      <th className="w-10 px-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {bills.map(b => (
                      <LinhaDetalhe tipo="bill" id={b.id} key={b.id} className="border-b last:border-b-0">
                        <td className="px-4 py-3 font-medium">{b.fornecedor}</td>
                        <td className="px-4 py-3 text-muted-foreground">{b.descricao ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(b.vencimento)}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium">{formatCurrency(b.valor)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium ${statusConfig[b.status]?.className ?? ""}`}>
                            {statusConfig[b.status]?.label ?? b.status}
                          </span>
                          {b.approval_status === "awaiting_approval" && (
                            <span className="ml-1 inline-flex items-center rounded-sm bg-warning/[0.08] px-2 py-0.5 text-xs font-medium text-warning dark:bg-warning/[0.08] dark:text-warning">
                              Aguardando aprovação
                            </span>
                          )}
                          {b.approval_status === "rejected" && (
                            <span className="ml-1 inline-flex items-center rounded-sm bg-destructive/[0.08] px-2 py-0.5 text-xs font-medium text-destructive dark:bg-destructive/[0.08] dark:text-destructive">
                              Rejeitada
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {b.approval_status === "awaiting_approval" && (
                                <>
                                  <DropdownMenuItem onClick={() => decideBill.mutate({ id: b.id, valor: b.valor, approve: true })}>
                                    <Check className="h-4 w-4 mr-2" /> Aprovar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => decideBill.mutate({ id: b.id, valor: b.valor, approve: false })}>
                                    <Trash2 className="h-4 w-4 mr-2" /> Rejeitar
                                  </DropdownMenuItem>
                                </>
                              )}
                              {b.status !== "pago" && b.approval_status !== "awaiting_approval" && b.approval_status !== "rejected" && (
                                <DropdownMenuItem onClick={() => markAsPaid.mutate({ id: b.id, approval_status: b.approval_status })}>
                                  <Check className="h-4 w-4 mr-2" /> Marcar como Pago
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => setEditItem({ id: b.id, fornecedor: b.fornecedor, descricao: b.descricao, vencimento: b.vencimento, valor: b.valor })}>
                                <Pencil className="h-4 w-4 mr-2" /> Editar
                              </DropdownMenuItem>
                              {b.recurrence_group_id ? (
                                <DropdownMenuItem onClick={() => encerrarRecorrencia.mutate(b.recurrence_group_id!)}>
                                  <Repeat className="h-4 w-4 mr-2" /> Encerrar recorrência
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => setRecorrer({ id: b.id, fornecedor: b.fornecedor })}>
                                  <Repeat className="h-4 w-4 mr-2" /> Repetir todo mês
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(b.id)}>
                                <Trash2 className="h-4 w-4 mr-2" /> Excluir
                              </DropdownMenuItem>
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

      <BillFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={(data) => createBill.mutate(data)}
        isPending={createBill.isPending}
      />

      {editItem && (
        <BillFormDialog
          open={true}
          onOpenChange={(o) => { if (!o) setEditItem(null); }}
          initialData={editItem}
          onSubmit={(data) => updateBill.mutate({ id: editItem.id, ...data })}
          isPending={updateBill.isPending}
        />
      )}

      <DeleteConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => { if (!o) setDeleteId(null); }}
        onConfirm={() => { if (deleteId) { deleteBill.mutate(deleteId); setDeleteId(null); } }}
        description="A conta será removida permanentemente."
      />

      <Dialog open={!!recorrer} onOpenChange={(v) => !v && setRecorrer(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Repetir esta conta</DialogTitle>
            <DialogDescription>
              {recorrer?.fornecedor}. As ocorrências são criadas de uma vez, para aparecerem no fluxo de caixa
              projetado em vez de surgirem só no mês que vencem.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Quantas vezes</Label>
              <Input
                className="mt-1" type="number" min={2} max={60}
                value={ocorrencias} onChange={(e) => setOcorrencias(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">A cada</Label>
              <Select value={periodicidade} onValueChange={setPeriodicidade}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semanal">Semana</SelectItem>
                  <SelectItem value="quinzenal">Quinzena</SelectItem>
                  <SelectItem value="mensal">Mês</SelectItem>
                  <SelectItem value="bimestral">2 meses</SelectItem>
                  <SelectItem value="trimestral">Trimestre</SelectItem>
                  <SelectItem value="semestral">Semestre</SelectItem>
                  <SelectItem value="anual">Ano</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRecorrer(null)}>Cancelar</Button>
            <Button
              disabled={tornarRecorrente.isPending}
              onClick={() => {
                if (!recorrer) return;
                tornarRecorrente.mutate(
                  { billId: recorrer.id, ocorrencias: Number(ocorrencias) || 12, periodicidade },
                  { onSuccess: () => setRecorrer(null) },
                );
              }}
            >
              Criar recorrência
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
