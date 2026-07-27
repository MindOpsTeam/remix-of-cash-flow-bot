import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Repeat } from "lucide-react";
import type { BillInput } from "@/hooks/useBillsPayable";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: BillInput) => void;
  initialData?: Partial<BillInput> & { id?: string };
  isPending?: boolean;
}

export function BillFormDialog({ open, onOpenChange, onSubmit, initialData, isPending }: Props) {
  const isEdit = !!initialData?.id;
  const [fornecedor, setFornecedor] = useState(initialData?.fornecedor ?? "");
  const [descricao, setDescricao] = useState(initialData?.descricao ?? "");
  const [vencimento, setVencimento] = useState(initialData?.vencimento ?? "");
  const [valor, setValor] = useState(initialData?.valor?.toString() ?? "");
  const [isRecurring, setIsRecurring] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fornecedor || !vencimento || !valor) return;
    onSubmit({
      fornecedor,
      descricao: descricao || null,
      vencimento,
      valor: parseFloat(valor),
      ...(isEdit ? {} : { is_recurring: isRecurring, recurrence_months: isRecurring ? 12 : undefined }),
    });
    if (!isEdit) {
      setFornecedor(""); setDescricao(""); setVencimento(""); setValor(""); setIsRecurring(false);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Conta" : "Adicionar Boleto"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Fornecedor</Label>
            <Input value={fornecedor} onChange={e => setFornecedor(e.target.value)} placeholder="Nome do fornecedor" />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descrição (opcional)" />
          </div>
          <div className="space-y-2">
            <Label>{isRecurring && !isEdit ? "Primeiro vencimento" : "Vencimento"}</Label>
            <Input type="date" value={vencimento} onChange={e => setVencimento(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Valor (R$)</Label>
            <Input type="number" step="0.01" min="0" value={valor} onChange={e => setValor(e.target.value)} />
          </div>

          {!isEdit && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={isRecurring}
                  onCheckedChange={(v) => setIsRecurring(v === true)}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Repeat className="h-3.5 w-3.5 text-primary" />
                    Pagamento recorrente
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Gera 12 parcelas mensais automaticamente a partir do vencimento informado.
                  </p>
                </div>
              </label>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isPending}>
              {isEdit ? "Salvar" : (isRecurring ? "Adicionar 12 parcelas" : "Adicionar")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
