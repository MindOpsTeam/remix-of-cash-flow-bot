import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fornecedor || !vencimento || !valor) return;
    onSubmit({ fornecedor, descricao: descricao || null, vencimento, valor: parseFloat(valor) });
    if (!isEdit) { setFornecedor(""); setDescricao(""); setVencimento(""); setValor(""); }
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
            <Label>Vencimento</Label>
            <Input type="date" value={vencimento} onChange={e => setVencimento(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Valor (R$)</Label>
            <Input type="number" step="0.01" min="0" value={valor} onChange={e => setValor(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isPending}>{isEdit ? "Salvar" : "Adicionar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
