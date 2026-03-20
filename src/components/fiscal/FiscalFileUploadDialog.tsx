import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { file: File; tipo: string }) => void;
  isPending?: boolean;
}

const TIPOS = [
  { value: "contrato", label: "Contrato" },
  { value: "xml", label: "XML" },
  { value: "certificado", label: "Certificado" },
  { value: "outro", label: "Outro" },
];

export function FiscalFileUploadDialog({ open, onOpenChange, onSubmit, isPending }: Props) {
  const [tipo, setTipo] = useState("outro");
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    onSubmit({ file, tipo });
    setFile(null);
    setTipo("outro");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Documento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Arquivo</Label>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept=".pdf,.xml,.pfx,.p12,.doc,.docx,.jpg,.png"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2 justify-start"
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              {file ? file.name : "Selecionar arquivo"}
            </Button>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isPending || !file}>Enviar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
