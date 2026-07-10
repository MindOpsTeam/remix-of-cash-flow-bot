/**
 * Formulário estruturado para emissão de NFS-e via PlugNotas.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Send } from "lucide-react";
import { ContactPicker, type ContactOption } from "./ContactPicker";
import { ProductPicker } from "./ProductPicker";
import {
  formatDocument, isValidDocument, mapNfse, extractErrorMessage,
  type NfseFormData,
} from "@/lib/plugnotas";
import { deveDestacar, extractReformaMeta } from "@/lib/plugnotas";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Props {
  prestadorCnpj: string;
  inscricaoMunicipalDefault?: string;
}

export function NfseForm({ prestadorCnpj, inscricaoMunicipalDefault }: Props) {
  const { company } = useCompany();
  const qc = useQueryClient();
  const [emitting, setEmitting] = useState(false);

  // Tomador
  const [contactId, setContactId] = useState<string | undefined>();
  const [tomadorDoc, setTomadorDoc] = useState("");
  const [tomadorNome, setTomadorNome] = useState("");
  const [tomadorEmail, setTomadorEmail] = useState("");

  // Serviço
  const [codigoServico, setCodigoServico] = useState("");
  const [itemListaServico, setItemListaServico] = useState("");
  const [cnae, setCnae] = useState("");
  const [discriminacao, setDiscriminacao] = useState("");
  const [valor, setValor] = useState<string>("");
  const [aliquotaIss, setAliquotaIss] = useState<string>("");
  const [issRetido, setIssRetido] = useState(false);

  // Extra
  const [observacoes, setObservacoes] = useState("");
  const [competencia, setCompetencia] = useState(new Date().toISOString().slice(0, 10));

  const onContact = (c: ContactOption) => {
    setContactId(c.id);
    setTomadorDoc(c.document ?? "");
    setTomadorNome(c.name);
    setTomadorEmail(c.email ?? "");
  };

  const validate = (): string | null => {
    if (!tomadorDoc) return "Documento do tomador é obrigatório";
    if (!isValidDocument(tomadorDoc)) return "CPF/CNPJ do tomador inválido";
    if (!tomadorNome) return "Razão social/nome do tomador é obrigatória";
    if (!codigoServico) return "Código de tributação do município é obrigatório";
    if (!itemListaServico) return "Item da lista de serviços (LC 116) é obrigatório";
    if (!discriminacao) return "Descrição do serviço é obrigatória";
    const v = parseFloat(valor.replace(/\./g, "").replace(",", "."));
    if (!v || v <= 0) return "Valor do serviço deve ser maior que zero";
    return null;
  };

  const handleEmit = async () => {
    if (!company) return;
    const err = validate();
    if (err) { toast.error(err); return; }

    const v = parseFloat(valor.replace(/\./g, "").replace(",", "."));
    const aliq = aliquotaIss ? parseFloat(aliquotaIss.replace(",", ".")) : undefined;

    const data: NfseFormData = {
      prestadorCnpj,
      inscricaoMunicipal: inscricaoMunicipalDefault,
      tomador: {
        cpfCnpj: tomadorDoc,
        razaoSocial: tomadorNome,
        email: tomadorEmail || undefined,
      },
      servico: {
        codigoTributacaoMunicipio: codigoServico,
        itemListaServico,
        cnae: cnae || undefined,
        discriminacao,
        valorServico: v,
        aliquotaIss: aliq,
        issRetido,
      },
      observacoes: observacoes || undefined,
      competencia,
    };

    setEmitting(true);
    try {
      // 1) cria registro local em invoices (draft)
      const { data: invoice, error: invErr } = await (supabase as any)
        .from("invoices")
        .insert({
          company_id: company.id,
          contact_id: contactId ?? null,
          type: "nfse",
          status: "draft",
          issue_date: competencia,
          total: v,
          notes: discriminacao,
        })
        .select("id")
        .single();
      if (invErr) throw new Error("Erro ao criar invoice local: " + invErr.message);

      // 2) chama edge function
      const reformaOpts = deveDestacar(company.regimeTributario, "nfse") ? { cClassTrib: company.cclasstribPadrao ?? undefined } : null;
      const payload = mapNfse(data, reformaOpts);
      const { data: result, error } = await supabase.functions.invoke("plugnotas-nfse", {
        body: {
          company_id: company.id,
          operation: "emitir",
          params: payload,
          invoice_id: invoice.id,
          reforma: extractReformaMeta(payload),
        },
      });
      if (error) throw new Error(error.message);

      if (result?.ok) {
        toast.success("NFS-e enviada — aguardando autorização");
        // reset
        setContactId(undefined);
        setTomadorDoc(""); setTomadorNome(""); setTomadorEmail("");
        setDiscriminacao(""); setValor(""); setAliquotaIss(""); setObservacoes("");
      } else {
        toast.error(extractErrorMessage(result?.data));
        await (supabase as any).from("invoices").update({ status: "denied" }).eq("id", invoice.id);
      }

      qc.invalidateQueries({ queryKey: ["plugnotas_documents", company.id] });
      qc.invalidateQueries({ queryKey: ["invoices", company.id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setEmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Tomador */}
      <Card>
        <CardContent className="py-4 px-5 space-y-3">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Tomador do serviço</Label>
            <div className="mt-2">
              <ContactPicker value={contactId} onSelect={onContact} type="customer" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">CPF/CNPJ *</Label>
              <Input
                value={tomadorDoc}
                onChange={(e) => setTomadorDoc(e.target.value)}
                onBlur={(e) => setTomadorDoc(formatDocument(e.target.value))}
                placeholder="00.000.000/0000-00"
                className="font-mono text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Razão social / nome *</Label>
              <Input value={tomadorNome} onChange={(e) => setTomadorNome(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Email</Label>
            <Input
              type="email"
              value={tomadorEmail}
              onChange={(e) => setTomadorEmail(e.target.value)}
              placeholder="cliente@empresa.com"
            />
          </div>
        </CardContent>
      </Card>

      {/* Serviço */}
      <Card>
        <CardContent className="py-4 px-5 space-y-3">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Serviço prestado</Label>
          <div>
            <Label className="text-xs">Carregar de produto/serviço</Label>
            <ProductPicker
              productType="service"
              placeholder="Buscar serviço cadastrado..."
              onSelect={(p) => {
                setDiscriminacao(p.description ?? p.name);
                if (p.sell_price) setValor(p.sell_price.toFixed(2).replace(".", ","));
              }}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Cód. tributação municipal *</Label>
              <Input
                value={codigoServico}
                onChange={(e) => setCodigoServico(e.target.value)}
                placeholder="010101"
                className="font-mono text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Item LC 116 *</Label>
              <Input
                value={itemListaServico}
                onChange={(e) => setItemListaServico(e.target.value)}
                placeholder="1.01"
                className="font-mono text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">CNAE</Label>
              <Input
                value={cnae}
                onChange={(e) => setCnae(e.target.value)}
                placeholder="6201500"
                className="font-mono text-sm"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Discriminação do serviço *</Label>
            <Textarea
              value={discriminacao}
              onChange={(e) => setDiscriminacao(e.target.value)}
              rows={3}
              placeholder="Descrição clara do serviço prestado"
            />
          </div>
        </CardContent>
      </Card>

      {/* Valores */}
      <Card>
        <CardContent className="py-4 px-5 space-y-3">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Valores</Label>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Valor do serviço (R$) *</Label>
              <Input
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
                className="font-mono text-sm"
                inputMode="decimal"
              />
            </div>
            <div>
              <Label className="text-xs">Alíquota ISS (%)</Label>
              <Input
                value={aliquotaIss}
                onChange={(e) => setAliquotaIss(e.target.value)}
                placeholder="2,00"
                className="font-mono text-sm"
                inputMode="decimal"
              />
            </div>
            <div className="flex items-center justify-between pt-5">
              <Label className="text-xs">ISS retido</Label>
              <Switch checked={issRetido} onCheckedChange={setIssRetido} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Competência e observações */}
      <Card>
        <CardContent className="py-4 px-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Competência</Label>
              <Input type="date" value={competencia} onChange={(e) => setCompetencia(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={handleEmit} disabled={emitting} size="lg" className="gap-2">
          {emitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {emitting ? "Emitindo..." : "Emitir NFS-e"}
        </Button>
        <p className="text-xs text-muted-foreground">
          A nota é registrada em <code className="bg-muted px-1 rounded">invoices</code> e o status sincroniza automaticamente.
        </p>
      </div>
    </div>
  );
}
