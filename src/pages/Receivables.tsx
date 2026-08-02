import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useQuery } from "@tanstack/react-query";
import { mensagemDeErro } from "@/lib/erros";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Clock, AlertTriangle, CheckCircle2, FileText, MoreHorizontal, Pencil, Trash2, Check, Ban, ExternalLink, CreditCard, Loader2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useReceivables, type Receivable, type ReceivableInput } from "@/hooks/useReceivables";
import { ReceivableFormDialog } from "@/components/receivables/ReceivableFormDialog";
import { DeleteConfirmDialog } from "@/components/fiscal/DeleteConfirmDialog";
import { LinhaDetalhe } from "@/components/detalhe/LinhaDetalhe";

const statusConfig: Record<string, { label: string; className: string }> = {
  a_receber: { label: "A receber", className: "bg-warning/[0.08] text-warning dark:bg-warning/[0.08] dark:text-warning" },
  vencido: { label: "Vencido", className: "bg-destructive/[0.08] text-destructive dark:bg-destructive/[0.08] dark:text-destructive" },
  recebido: { label: "Recebido", className: "bg-success/[0.08] text-success dark:bg-success/[0.08] dark:text-success" },
  cancelado: { label: "Cancelado", className: "bg-muted text-muted-foreground" },
};

const sourceLabel: Record<string, string> = { manual: "Manual", contrato: "Contrato", asaas: "Asaas", stripe: "Stripe" };

export default function Receivables() {
  const { receivables, isLoading, createReceivable, updateReceivable, markAsReceived, cancelReceivable, deleteReceivable } = useReceivables();
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<(ReceivableInput & { id: string }) | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [cobrando, setCobrando] = useState<string | null>(null);
  const { company } = useCompany();

  // Canais Stripe da empresa. Com mais de um, o menu passa a listar cada canal:
  // cobrar sem dizer onde colocaria o dinheiro na conta errada.
  const { data: canaisStripe } = useQuery({
    queryKey: ["stripe-canais-cobranca", company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stripe_config")
        .select("id, apelido")
        .eq("company_id", company!.id)
        .not("secret_key_preview", "is", null)
        .order("apelido");
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; apelido: string }>;
    },
  });

  /**
   * Gera (ou reaproveita) o link de pagamento por cartão do título.
   *
   * Reaproveitar importa: dois links para o mesmo título são dois payment_intents,
   * e o webhook poderia baixar o mesmo recebível duas vezes.
   */
  const cobrarNoCartao = async (r: Receivable, configId?: string) => {
    if (!company?.id) return;
    setCobrando(r.id);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-api", {
        body: { action: "cobrar", company_id: company.id, receivable_id: r.id, config_id: configId },
      });
      if (error) throw error;
      const resp = data as { url?: string; error?: string };
      if (resp?.error) throw new Error(resp.error);
      if (!resp?.url) throw new Error("O Stripe não devolveu o link.");
      window.open(resp.url, "_blank", "noopener,noreferrer");
      toast.success("Link de pagamento aberto. Envie ao cliente para receber no cartão.");
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setCobrando(null);
    }
  };

  const totals = {
    aReceber: receivables.filter((r) => r.status === "a_receber").reduce((s, r) => s + Number(r.amount), 0),
    vencido: receivables.filter((r) => r.status === "vencido").reduce((s, r) => s + Number(r.amount), 0),
    recebido: receivables.filter((r) => r.status === "recebido").reduce((s, r) => s + Number(r.amount), 0),
  };

  const openLink = (r: Receivable) => {
    const url = r.boleto_url || r.pix_url;
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Contas a Receber</h1>
            <p className="text-sm text-muted-foreground mt-1">Cobranças manuais, de contratos e do Asaas — a baixa vira receita no DRE</p>
          </div>
          <Button size="sm" className="gap-2" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> Nova conta
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {([
            { label: "A receber", value: totals.aReceber, className: "bg-warning/[0.08] dark:bg-warning/[0.08]", iconClass: "text-warning", Icon: Clock },
            { label: "Vencido", value: totals.vencido, className: "bg-destructive/[0.08] dark:bg-destructive/[0.08]", iconClass: "text-destructive", Icon: AlertTriangle },
            { label: "Recebido", value: totals.recebido, className: "bg-success/[0.08] dark:bg-success/[0.08]", iconClass: "text-success", Icon: CheckCircle2 },
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
              <div className="p-4 space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : receivables.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Nenhuma conta a receber cadastrada</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Descrição</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Origem</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Vencimento</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Valor</th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                      <th className="w-10 px-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {receivables.map((r) => (
                      <LinhaDetalhe tipo="receivable" id={r.id} key={r.id} className="border-b last:border-b-0">
                        <td className="px-4 py-3 font-medium">{r.description}</td>
                        <td className="px-4 py-3 text-muted-foreground">{sourceLabel[r.source] ?? r.source}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(r.due_date)}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium">{formatCurrency(Number(r.amount))}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium ${statusConfig[r.status]?.className ?? ""}`}>
                            {statusConfig[r.status]?.label ?? r.status}
                          </span>
                        </td>
                        <td className="px-2 py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {r.status !== "recebido" && r.status !== "cancelado" && (
                                <DropdownMenuItem onClick={() => markAsReceived.mutate(r)}>
                                  <Check className="h-4 w-4 mr-2" /> Dar baixa (receber)
                                </DropdownMenuItem>
                              )}
                              {r.status !== "recebido" && r.status !== "cancelado" && (
                                (canaisStripe ?? []).length > 1 && !r.stripe_checkout_url ? (
                                  (canaisStripe ?? []).map((canal) => (
                                    <DropdownMenuItem
                                      key={canal.id}
                                      disabled={cobrando === r.id}
                                      onClick={() => cobrarNoCartao(r, canal.id)}
                                    >
                                      {cobrando === r.id
                                        ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        : <CreditCard className="h-4 w-4 mr-2" />}
                                      Cobrar no cartão · {canal.apelido}
                                    </DropdownMenuItem>
                                  ))
                                ) : (
                                  <DropdownMenuItem
                                    disabled={cobrando === r.id}
                                    onClick={() => cobrarNoCartao(r)}
                                  >
                                    {cobrando === r.id
                                      ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      : <CreditCard className="h-4 w-4 mr-2" />}
                                    {r.stripe_checkout_url ? "Abrir link do cartão" : "Cobrar no cartão"}
                                  </DropdownMenuItem>
                                )
                              )}
                              {(r.boleto_url || r.pix_url) && (
                                <DropdownMenuItem onClick={() => openLink(r)}>
                                  <ExternalLink className="h-4 w-4 mr-2" /> Abrir boleto/Pix
                                </DropdownMenuItem>
                              )}
                              {r.source === "manual" && r.status !== "recebido" && (
                                <DropdownMenuItem onClick={() => setEditItem({ id: r.id, description: r.description, amount: Number(r.amount), due_date: r.due_date, account_id: r.account_id ?? "", cost_center_id: r.cost_center_id ?? "", contact_id: r.contact_id })}>
                                  <Pencil className="h-4 w-4 mr-2" /> Editar
                                </DropdownMenuItem>
                              )}
                              {r.status !== "recebido" && r.status !== "cancelado" && (
                                <DropdownMenuItem onClick={() => cancelReceivable.mutate(r.id)}>
                                  <Ban className="h-4 w-4 mr-2" /> Cancelar
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(r.id)}>
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

      <ReceivableFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={(data) => createReceivable.mutate(data)}
        isPending={createReceivable.isPending}
      />

      {editItem && (
        <ReceivableFormDialog
          open={true}
          onOpenChange={(o) => { if (!o) setEditItem(null); }}
          initialData={editItem}
          onSubmit={(data) => updateReceivable.mutate({ id: editItem.id, ...data })}
          isPending={updateReceivable.isPending}
        />
      )}

      <DeleteConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => { if (!o) setDeleteId(null); }}
        onConfirm={() => { if (deleteId) { deleteReceivable.mutate(deleteId); setDeleteId(null); } }}
        description="A conta a receber será removida permanentemente."
      />
    </AppLayout>
  );
}
