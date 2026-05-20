/**
 * MDF-e: Manifesto Eletrônico de Documentos Fiscais.
 * Form simplificado — vincula NF-es e/ou CT-es por chave de acesso.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send, Plus, Trash2 } from "lucide-react";
import { mapMdfe, extractErrorMessage, type MdfeFormData } from "@/lib/plugnotas";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Props { emitenteCnpj: string }

const MODAIS = [
  { value: "1", label: "Rodoviário" },
  { value: "2", label: "Aéreo" },
  { value: "3", label: "Aquaviário" },
  { value: "4", label: "Ferroviário" },
];

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

export function MdfeForm({ emitenteCnpj }: Props) {
  const { company } = useCompany();
  const qc = useQueryClient();
  const [emitting, setEmitting] = useState(false);

  const [modal, setModal] = useState("1");
  const [ufOrigem, setUfOrigem] = useState("");
  const [ufDestino, setUfDestino] = useState("");
  const [placa, setPlaca] = useState("");
  const [peso, setPeso] = useState<string>("");
  const [chaves, setChaves] = useState<string[]>([""]);
  const [obs, setObs] = useState("");

  const updateChave = (idx: number, v: string) => {
    setChaves((arr) => arr.map((c, i) => i === idx ? v.replace(/\D/g, "").slice(0, 44) : c));
  };

  const validate = (): string | null => {
    if (!ufOrigem) return "UF de origem obrigatória";
    if (!ufDestino) return "UF de destino obrigatória";
    if (!placa || placa.length < 7) return "Placa do veículo inválida";
    const p = parseFloat(peso.replace(",", "."));
    if (!p || p <= 0) return "Peso bruto inválido";
    const validKeys = chaves.filter((c) => c.length === 44);
    if (validKeys.length === 0) return "Inclua ao menos uma chave de acesso (44 dígitos)";
    return null;
  };

  const handleEmit = async () => {
    if (!company) return;
    const err = validate();
    if (err) { toast.error(err); return; }

    const data: MdfeFormData = {
      emitenteCnpj,
      modal,
      ufOrigem,
      ufDestino,
      veiculoPlaca: placa.toUpperCase(),
      documentosVinculados: chaves.filter((c) => c.length === 44),
      pesoBruto: parseFloat(peso.replace(",", ".")),
      observacoes: obs || undefined,
    };

    setEmitting(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("plugnotas-mdfe", {
        body: { company_id: company.id, operation: "emitir", params: mapMdfe(data) },
      });
      if (error) throw new Error(error.message);
      if (result?.ok) {
        toast.success("MDF-e enviado — aguardando autorização");
        setChaves([""]); setPlaca(""); setPeso(""); setObs("");
      } else {
        toast.error(extractErrorMessage(result?.data));
      }
      qc.invalidateQueries({ queryKey: ["plugnotas_documents", company.id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setEmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="py-4 px-5 space-y-3">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Trânsito</Label>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Modal *</Label>
              <Select value={modal} onValueChange={setModal}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODAIS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">UF Origem *</Label>
              <Select value={ufOrigem} onValueChange={setUfOrigem}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {UFS.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">UF Destino *</Label>
              <Select value={ufDestino} onValueChange={setUfDestino}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {UFS.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Placa do veículo *</Label>
              <Input value={placa} onChange={(e) => setPlaca(e.target.value.toUpperCase())} placeholder="ABC1D23" className="font-mono text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Peso bruto (kg) *</Label>
              <Input value={peso} onChange={(e) => setPeso(e.target.value)} className="font-mono text-sm" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-4 px-5 space-y-3">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Documentos vinculados</Label>
          <p className="text-[11px] text-muted-foreground">
            Chave de acesso (44 dígitos) de cada NF-e ou CT-e transportado.
          </p>
          {chaves.map((chave, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                value={chave}
                onChange={(e) => updateChave(idx, e.target.value)}
                placeholder="00000000000000000000000000000000000000000000"
                className="font-mono text-xs"
              />
              <Button
                variant="ghost" size="icon" type="button" className="h-8 w-8 shrink-0"
                onClick={() => setChaves((arr) => arr.length > 1 ? arr.filter((_, i) => i !== idx) : arr)}
                disabled={chaves.length === 1}
              >
                <Trash2 className="h-3.5 w-3.5 text-expense" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setChaves((arr) => [...arr, ""])} type="button" className="gap-1">
            <Plus className="h-3.5 w-3.5" /> Adicionar chave
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-4 px-5">
          <Label className="text-xs">Observações</Label>
          <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} className="mt-1" />
        </CardContent>
      </Card>

      <Button onClick={handleEmit} disabled={emitting} size="lg" className="gap-2">
        {emitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Emitir MDF-e
      </Button>
    </div>
  );
}
