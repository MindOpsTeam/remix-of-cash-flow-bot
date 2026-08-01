import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { ReajustesPendentes } from "@/components/contratos/ReajustesPendentes";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, FileSignature, MoreHorizontal, Pause, Play, Square, Trash2, Zap, CalendarClock } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useContracts } from "@/hooks/useContracts";
import { ContractFormDialog } from "@/components/contracts/ContractFormDialog";
import { DeleteConfirmDialog } from "@/components/fiscal/DeleteConfirmDialog";
import { CYCLE_LABEL } from "@/lib/receivables";
import { LinhaDetalhe } from "@/components/detalhe/LinhaDetalhe";

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: "Ativo", className: "bg-success/[0.08] text-success dark:bg-success/[0.08] dark:text-success" },
  paused: { label: "Pausado", className: "bg-warning/[0.08] text-warning dark:bg-warning/[0.08] dark:text-warning" },
  ended: { label: "Encerrado", className: "bg-muted text-muted-foreground" },
};

export default function Contracts() {
  const { contracts, isLoading, createContract, setStatus, deleteContract } = useContracts();
  const [formOpen, setFormOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const activeMrr = contracts
    .filter((c) => c.status === "active" && c.cycle === "MONTHLY")
    .reduce((s, c) => s + Number(c.amount), 0);
  const activeCount = contracts.filter((c) => c.status === "active").length;
  const autoCount = contracts.filter((c) => c.status === "active" && c.asaas_subscription_id).length;

  return (
    <AppLayout>
      <div className="space-y-6">
        <ReajustesPendentes />

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Contratos</h1>
            <p className="text-sm text-muted-foreground mt-1">Serviços recorrentes — cada ciclo gera uma conta a receber e o boleto</p>
          </div>
          <Button size="sm" className="gap-2" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> Novo contrato
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {([
            { label: "Receita recorrente mensal", value: formatCurrency(activeMrr), Icon: CalendarClock, className: "bg-success/[0.08] dark:bg-success/[0.08]", iconClass: "text-success" },
            { label: "Contratos ativos", value: String(activeCount), Icon: FileSignature, className: "bg-primary/[0.08] dark:bg-primary/[0.08]", iconClass: "text-primary" },
            { label: "Cobrança automática (Asaas)", value: String(autoCount), Icon: Zap, className: "bg-primary/[0.08] dark:bg-primary/[0.08]", iconClass: "text-primary" },
          ] as const).map(({ label, value, Icon, className, iconClass }) => (
            <Card key={label}><CardContent className="p-4 flex items-center gap-3">
              <div className={`h-9 w-9 rounded-lg ${className} flex items-center justify-center`}><Icon className={`h-4 w-4 ${iconClass}`} /></div>
              <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-lg font-semibold tabular-nums">{value}</p></div>
            </CardContent></Card>
          ))}
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : contracts.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <FileSignature className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Nenhum contrato cadastrado</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Descrição</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Periodicidade</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Próx. cobrança</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Valor</th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground">Cobrança</th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                      <th className="w-10 px-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {contracts.map((c) => (
                      <LinhaDetalhe tipo="contract" id={c.id} key={c.id} className="border-b last:border-b-0">
                        <td className="px-4 py-3 font-medium">{c.description}</td>
                        <td className="px-4 py-3 text-muted-foreground">{CYCLE_LABEL[c.cycle] ?? c.cycle} · dia {c.billing_day}</td>
                        <td className="px-4 py-3 text-muted-foreground">{c.next_due_date ? formatDate(c.next_due_date) : "—"}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium">{formatCurrency(Number(c.amount))}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium ${c.asaas_subscription_id ? "bg-primary/[0.08] text-primary dark:bg-primary/[0.08] dark:text-primary" : "bg-muted text-muted-foreground"}`}>
                            {c.asaas_subscription_id ? "Automática" : "Manual"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium ${statusConfig[c.status]?.className ?? ""}`}>
                            {statusConfig[c.status]?.label ?? c.status}
                          </span>
                        </td>
                        <td className="px-2 py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {c.status === "active" && (
                                <DropdownMenuItem onClick={() => setStatus.mutate({ id: c.id, status: "paused" })}>
                                  <Pause className="h-4 w-4 mr-2" /> Pausar
                                </DropdownMenuItem>
                              )}
                              {c.status === "paused" && (
                                <DropdownMenuItem onClick={() => setStatus.mutate({ id: c.id, status: "active" })}>
                                  <Play className="h-4 w-4 mr-2" /> Reativar
                                </DropdownMenuItem>
                              )}
                              {c.status !== "ended" && (
                                <DropdownMenuItem onClick={() => setStatus.mutate({ id: c.id, status: "ended" })}>
                                  <Square className="h-4 w-4 mr-2" /> Encerrar
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(c.id)}>
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

      <ContractFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={(data) => createContract.mutate(data)}
        isPending={createContract.isPending}
      />

      <DeleteConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => { if (!o) setDeleteId(null); }}
        onConfirm={() => { if (deleteId) { deleteContract.mutate(deleteId); setDeleteId(null); } }}
        description="O contrato será removido. As contas a receber já geradas permanecem."
      />
    </AppLayout>
  );
}
