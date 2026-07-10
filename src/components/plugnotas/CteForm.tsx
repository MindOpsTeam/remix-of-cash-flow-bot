/**
 * CT-e: Conhecimento de Transporte Eletrônico.
 * Form simplificado — campos essenciais. Cenários complexos
 * (subcontratação, redespacho, multimodal) exigem ajuste do payload.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send } from "lucide-react";
import { ContactPicker, type ContactOption } from "./ContactPicker";
import {
  formatDocument, isValidDocument, mapCte, extractErrorMessage,
  type CteFormData,
} from "@/lib/plugnotas";
import { deveDestacar, extractReformaMeta } from "@/lib/plugnotas";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Props { emitenteCnpj: string }

const MODAIS = [
  { value: "01", label: "Rodoviário" },
  { value: "02", label: "Aéreo" },
  { value: "03", label: "Aquaviário" },
  { value: "04", label: "Ferroviário" },
  { value: "05", label: "Dutoviário" },
  { value: "06", label: "Multimodal" },
];

const TOMADORES = [
  { value: "remetente", label: "Remetente" },
  { value: "destinatario", label: "Destinatário" },
  { value: "expedidor", label: "Expedidor" },
  { value: "recebedor", label: "Recebedor" },
  { value: "outros", label: "Outros" },
];

export function CteForm({ emitenteCnpj }: Props) {
  const { company } = useCompany();
  const qc = useQueryClient();
  const [emitting, setEmitting] = useState(false);

  const [natureza, setNatureza] = useState("Prestação de serviço de transporte");
  const [modal, setModal] = useState("01");
  const [tomador, setTomador] = useState<"remetente" | "destinatario" | "expedidor" | "recebedor" | "outros">("remetente");

  const [remDoc, setRemDoc] = useState("");
  const [remNome, setRemNome] = useState("");
  const [destDoc, setDestDoc] = useState("");
  const [destNome, setDestNome] = useState("");

  const [valor, setValor] = useState<string>("");
  const [peso, setPeso] = useState<string>("");
  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [obs, setObs] = useState("");

  const onRem = (c: ContactOption) => { setRemDoc(c.document ?? ""); setRemNome(c.name); };
  const onDest = (c: ContactOption) => { setDestDoc(c.document ?? ""); setDestNome(c.name); };

  const validate = (): string | null => {
    if (!isValidDocument(remDoc)) return "Documento do remetente inválido";
    if (!remNome) return "Razão social do remetente é obrigatória";
    if (!isValidDocument(destDoc)) return "Documento do destinatário inválido";
    if (!destNome) return "Razão social do destinatário é obrigatória";
    const v = parseFloat(valor.replace(/\./g, "").replace(",", "."));
    const p = parseFloat(peso.replace(",", "."));
    if (!v || v <= 0) return "Valor da prestação inválido";
    if (!p || p <= 0) return "Peso bruto inválido";
    if (!origem) return "Município de origem obrigatório";
    if (!destino) return "Município de destino obrigatório";
    return null;
  };

  const handleEmit = async () => {
    if (!company) return;
    const err = validate();
    if (err) { toast.error(err); return; }

    const data: CteFormData = {
      emitenteCnpj,
      naturezaOperacao: natureza,
      modal,
      remetente: { cpfCnpj: remDoc, razaoSocial: remNome },
      destinatario: { cpfCnpj: destDoc, razaoSocial: destNome },
      tomador,
      valorTotal: parseFloat(valor.replace(/\./g, "").replace(",", ".")),
      pesoBruto: parseFloat(peso.replace(",", ".")),
      origemMunicipio: origem,
      destinoMunicipio: destino,
      observacoes: obs || undefined,
    };

    setEmitting(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("plugnotas-cte", {
        body: (() => { const p = mapCte(data, deveDestacar(company.regimeTributario, "cte") ? { cClassTrib: company.cclasstribPadrao ?? undefined } : null); return { company_id: company.id, operation: "emitir", params: p, reforma: extractReformaMeta(p) }; })(),
      });
      if (error) throw new Error(error.message);
      if (result?.ok) {
        toast.success("CT-e enviado — aguardando autorização");
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
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Operação</Label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Natureza *</Label>
              <Input value={natureza} onChange={(e) => setNatureza(e.target.value)} />
            </div>
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
              <Label className="text-xs">Tomador do serviço *</Label>
              <Select value={tomador} onValueChange={(v) => setTomador(v as typeof tomador)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TOMADORES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="py-4 px-5 space-y-3">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Remetente</Label>
            <ContactPicker onSelect={onRem} />
            <div>
              <Label className="text-xs">CNPJ/CPF *</Label>
              <Input value={remDoc} onChange={(e) => setRemDoc(e.target.value)} onBlur={(e) => setRemDoc(formatDocument(e.target.value))} className="font-mono text-sm" />
            </div>
            <div>
              <Label className="text-xs">Razão social *</Label>
              <Input value={remNome} onChange={(e) => setRemNome(e.target.value)} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 px-5 space-y-3">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Destinatário</Label>
            <ContactPicker onSelect={onDest} />
            <div>
              <Label className="text-xs">CNPJ/CPF *</Label>
              <Input value={destDoc} onChange={(e) => setDestDoc(e.target.value)} onBlur={(e) => setDestDoc(formatDocument(e.target.value))} className="font-mono text-sm" />
            </div>
            <div>
              <Label className="text-xs">Razão social *</Label>
              <Input value={destNome} onChange={(e) => setDestNome(e.target.value)} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="py-4 px-5 space-y-3">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Prestação e carga</Label>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Valor da prestação (R$) *</Label>
              <Input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" className="font-mono text-sm" />
            </div>
            <div>
              <Label className="text-xs">Peso bruto (kg) *</Label>
              <Input value={peso} onChange={(e) => setPeso(e.target.value)} placeholder="0" className="font-mono text-sm" />
            </div>
            <div>
              <Label className="text-xs">Município origem *</Label>
              <Input value={origem} onChange={(e) => setOrigem(e.target.value)} placeholder="São Paulo" />
            </div>
            <div>
              <Label className="text-xs">Município destino *</Label>
              <Input value={destino} onChange={(e) => setDestino(e.target.value)} placeholder="Rio de Janeiro" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleEmit} disabled={emitting} size="lg" className="gap-2">
        {emitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Emitir CT-e
      </Button>
    </div>
  );
}
