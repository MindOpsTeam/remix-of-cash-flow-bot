import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TaxGuideInput } from "@/hooks/useTaxGuides";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: TaxGuideInput) => void;
  initialData?: Partial<TaxGuideInput> & { id?: string };
  isPending?: boolean;
}

const TIPOS = ["DAS", "DARF - IRPJ", "DARF - CSLL", "ISS", "ICMS", "PIS", "COFINS", "INSS"];

export function TaxGuideFormDialog({ open, onOpenChange, onSubmit, initialData, isPending }: Props) {
  const isEdit = !!initialData?.id;
  const [tipo, setTipo] = useState(initialData?.tipo ?? "");
  const [competencia, setCompetencia] = useState(initialData?.competencia ?? "");
  const [vencimento, setVencimento] = useState(initialData?.vencimento ?? "");
  const [valor, setValor] = useState(initialData?.valor?.toString() ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tipo || !competencia || !vencimento || !valor) return;
    onSubmit({ tipo, competencia, vencimento, valor: parseFloat(valor) });
    if (!isEdit) { setTipo(""); setCompetencia(""); setVencimento(""); setValor(""); }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Guia" : "Adicionar Guia"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
              <SelectContent>
                {TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Competência</Label>
            <Input placeholder="MM/YYYY" value={competencia} onChange={e => setCompetencia(e.target.value)} />
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
